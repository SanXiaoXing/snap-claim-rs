import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import './styles/globals.css'
import { LeftPanel, RightPanel } from './components/Panels'
import { DragMask } from './components/DragMask'
import { DateRangeModal } from './components/DateRangeModal'
import { AboutModal } from './components/AboutModal'
import { CarClassifyModal } from './components/CarClassifyModal'
import { MergePdfModal } from './components/MergePdfModal'
import { UpdateDialog } from './components/UpdateDialog'
import { UpdateProgressWidget } from './components/UpdateProgressWidget'
import { pickFiles, recognizeInvoices, recognizeFromText, readImageBytes, mimeFromExt, isImagePath, isPdfPath, mergePdfs, pickSavePath, exportExcel, checkForUpdate, downloadUpdate, installDownloadedUpdate } from './lib/tauri'
import { useGsapMount } from './lib/gsap-hooks'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { InvoiceRecord, Totals, PreviewRow, UpdateInfo } from './types'
import type { ImageRecognitionService } from './services/recognition/ImageRecognitionService'

const EMPTY_TOTALS: Totals = {
  train: 0, flight: 0, hotel: 0, car: 0, invoice: 0,
  subsidy: 0, advance: 0, refund: 0, total: 0, chinese: '零元整',
}

function App() {
  const [files, setFiles] = useState<string[]>([])
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [status, setStatus] = useState('等待上传文件...')
  // ponytail: 出差日期通过日历弹窗选择，days 由日期差派生（+1 含首尾）
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate + 'T00:00:00').getTime()
    const e = new Date(endDate + 'T00:00:00').getTime()
    if (isNaN(s) || isNaN(e) || e < s) return 0
    return Math.floor((e - s) / 86400000) + 1
  }, [startDate, endDate])
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [showDragMask, setShowDragMask] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showCarClassify, setShowCarClassify] = useState(false)
  const [showMergePdf, setShowMergePdf] = useState(false)
  // ponytail: 识别完成且有 car 记录时进入"待分类"态——弹窗自动开 + 报销预览暂隐，
  // 用户确认或取消后解除。手动点按钮二次分类不进入此态（预览已有，无需藏）。
  const [carClassifyPending, setCarClassifyPending] = useState(false)
  // GSAP mount timeline 作用域：覆盖 main 内的卡片 + 右侧表格区
  const mainRef = useRef<HTMLElement>(null)
  useGsapMount(mainRef, '.gsap-enter', 0.08)

  // ponytail: 图片识别服务懒加载——PaddleOCR.js 体积大且依赖 ONNX/OpenCV 运行时，
  // 动态 import 确保应用启动时不加载它，只在用户首次识别图片时才加载。
  // Worker 模式下 OCR 推理在独立线程，不阻塞 UI。
  const imageRecognitionRef = useRef<ImageRecognitionService | null>(null)
  const getImageRecognition = useCallback(async () => {
    if (imageRecognitionRef.current === null) {
      const [{ ImageRecognitionService }, { PaddleOcrService }] = await Promise.all([
        import('./services/recognition/ImageRecognitionService'),
        import('./services/ocr/PaddleOcrService'),
      ])
      imageRecognitionRef.current = new ImageRecognitionService(
        new PaddleOcrService(),
        recognizeFromText,
      )
    }
    return imageRecognitionRef.current
  }, [])

  // 自动更新：启动时检查一次，发现新版本弹窗
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number | null } | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  // 添加文件（Tauri 原生文件选择对话框，支持 PDF + 图片）
  const handleAddFiles = useCallback(async () => {
    const selected = await pickFiles()
    if (selected.length === 0) return
    setFiles((prev) => {
      const newFiles = selected.filter((f) => !prev.includes(f))
      return [...prev, ...newFiles]
    })
    setStatus(`已添加 ${files.length + selected.length} 个文件，点击「开始识别」`)
  }, [files.length])

  // 开始识别：按扩展名分流——PDF 走 Rust recognizeInvoices，图片走前端 OCR + recognizeFromText。
  // ponytail: 两条路径产物都是 InvoiceRecord，用局部变量 accumulated 累积，最后一次性重算汇总。
  const handleStartRecognition = useCallback(async () => {
    if (files.length === 0) {
      setStatus('请先上传 PDF 或图片文件')
      return
    }

    const recognizedPaths = new Set(records.map((r) => r.fullPath))
    const newFiles = files.filter((f) => !recognizedPaths.has(f))
    const newPdfs = newFiles.filter(isPdfPath)
    const newImages = newFiles.filter(isImagePath)

    setIsRecognizing(true)
    setProgress(0)
    setProgressTotal(newFiles.length)
    setStatus(newFiles.length > 0 ? `正在识别 ${newFiles.length} 个新文件...` : '正在重新计算汇总...')

    try {
      // ponytail: 用局部变量追踪最新 records，避免依赖 React 重渲染更新 recordsRef.current
      let currentRecords = records

      // 1. PDF 走 Rust 批量识别（进度 + 单条推送由后端 emit recognition://record）
      if (newPdfs.length > 0) {
        const pdfResult = await recognizeInvoices(
          newPdfs,
          days,
          currentRecords,
          (cur, total) => {
            setProgress(cur)
            setProgressTotal(total)
          },
          (_record) => {
            // 增量推送仅做 UI 反馈，currentRecords 由 pdfResult.records 统一对齐
          },
        )
        currentRecords = pdfResult.records
        setRecords(currentRecords)
      }

      // 2. 图片走前端 OCR 逐张识别；前端主导流程——PaddleOCR 出文本后逐段调 Rust 解析，
      //    每段完成通过 onRecord 回调即时更新 UI，用户能看到记录逐条出现
      if (newImages.length > 0) {
        const imageService = await getImageRecognition()
        // debounce 150ms 重算汇总，避免每条记录都触发 Rust invoke
        let recalcTimer: ReturnType<typeof setTimeout> | null = null
        const scheduleRecalc = () => {
          if (recalcTimer) clearTimeout(recalcTimer)
          recalcTimer = setTimeout(async () => {
            try {
              const result = await recognizeInvoices([], days, currentRecords)
              setTotals(result.totals)
              setPreviewRows(result.previewRows)
            } catch { /* 非关键，忽略 */ }
          }, 150)
        }
        for (let i = 0; i < newImages.length; i++) {
          const imgPath = newImages[i]
          const filename = imgPath.split(/[\\/]/).pop() ?? imgPath
          try {
            const bytes = await readImageBytes(imgPath)
            const file = new File([bytes], filename, { type: mimeFromExt(imgPath) })
            // onRecord：每段 Rust 解析完成后立即追加到 records，UI 即时可见
            await imageService.recognizeAll(file, imgPath, (record) => {
              currentRecords = [...currentRecords, record]
              setRecords(currentRecords)
              scheduleRecalc()
            })
          } catch (e) {
            // 单张图片失败不中断整批，记录错误状态继续
            console.error(`图片识别失败 ${filename}:`, e)
            setStatus(`图片 ${filename} 识别失败: ${String(e)}，继续识别其余文件...`)
          }
          setProgress((newPdfs.length || 0) + i + 1)
        }
        // 清理 debounce 定时器
        if (recalcTimer) clearTimeout(recalcTimer)
      }

      // 3. 全量重算汇总/预览（空文件路径走 Rust 重算路径）
      const final = await recognizeInvoices([], days, currentRecords)
      setTotals(final.totals)
      setPreviewRows(final.previewRows)
      setRecords(final.records)

      // ponytail: 只有新增了用车记录才弹分类窗；已分类过的不再打扰，全部清除后重新上传也会弹
      const prevCarPaths = new Set(records.filter((r) => r.type === 'car').map((r) => r.fullPath))
      const hasNewCars = final.records.some((r) => r.type === 'car' && !prevCarPaths.has(r.fullPath))
      if (hasNewCars) {
        setCarClassifyPending(true)
        setShowCarClassify(true)
        setStatus(`识别完成，共 ${final.records.length} 条记录，请先分类用车记录`)
      } else {
        setCarClassifyPending(false)
        setStatus(`识别完成，共 ${final.records.length} 条记录`)
      }
    } catch (e) {
      setStatus(`识别失败: ${String(e)}`)
    } finally {
      setIsRecognizing(false)
    }
  }, [files, days, records])

  // 删除选中：同时移除对应 records 并重算汇总
  const handleDeleteSelected = useCallback(async (indices: Set<number>) => {
    if (indices.size === 0) return
    const deletedPaths = new Set(files.filter((_, i) => indices.has(i)))
    const keptFiles = files.filter((_, i) => !indices.has(i))
    const keptRecords = records.filter((r) => !deletedPaths.has(r.fullPath))
    setFiles(keptFiles)
    setRecords(keptRecords)
    try {
      const result = await recognizeInvoices([], days, keptRecords)
      setTotals(result.totals)
      setPreviewRows(result.previewRows)
    } catch { /* 非关键 */ }
    setStatus(`已删除 ${indices.size} 个文件`)
  }, [files, records, days])

  // 清空
  const handleClear = useCallback(() => {
    setFiles([])
    setRecords([])
    setTotals(EMPTY_TOTALS)
    setPreviewRows([])
    setStatus('等待上传文件...')
  }, [])

  // 合并 PDF：打开弹窗让用户拖拽调整顺序，确认后执行合并
  const handleMergePdf = useCallback(() => {
    if (files.length === 0) {
      setStatus('请先添加 PDF 文件')
      return
    }
    setShowMergePdf(true)
  }, [files.length])

  // 弹窗确认：按用户排好的顺序选路径并合并
  const handleConfirmMerge = useCallback(async (orderedFiles: string[]) => {
    setShowMergePdf(false)
    const name = startDate && endDate
      ? `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}.pdf`
      : 'merged.pdf'
    const output = await pickSavePath(name, 'pdf')
    if (!output) return
    setStatus(`正在合并 ${orderedFiles.length} 个文件...`)
    try {
      await mergePdfs(orderedFiles, output)
      setStatus(`已合并 ${orderedFiles.length} 个文件到 ${output}`)
    } catch (e) {
      setStatus(`合并失败: ${String(e)}`)
    }
  }, [startDate, endDate])

  // 导出报销单：previewRows 直接发给后端写 .xlsx，文件名与合并 PDF 同规则（出差日期区间）
  const handleExportReport = useCallback(async () => {
    if (previewRows.length === 0) {
      setStatus('暂无可导出的报销单数据，请先识别')
      return
    }
    const name = startDate && endDate
      ? `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}.xlsx`
      : '报销单.xlsx'
    const output = await pickSavePath(name, 'xlsx')
    if (!output) return
    setStatus('正在导出报销单...')
    try {
      await exportExcel(previewRows, output)
      setStatus(`已导出到 ${output}`)
    } catch (e) {
      setStatus(`导出失败: ${String(e)}`)
    }
  }, [previewRows, startDate, endDate])

  // 主题切换
  const handleThemeChange = useCallback((theme: string) => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('snap-claim-theme', theme)
  }, [])

  // 启动时恢复已保存的主题
  useEffect(() => {
    const saved = localStorage.getItem('snap-claim-theme')
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // 批量分类用车记录：前端改 isRoundTrip，后端空 file_paths 重算 totals/preview
  // ponytail: 复用 recognize_invoices 的重算路径，不新增 Tauri 命令
  const handleApplyCarClassification = useCallback(async (updated: InvoiceRecord[]) => {
    setRecords(updated)
    setShowCarClassify(false)
    setCarClassifyPending(false)
    try {
      const result = await recognizeInvoices([], days, updated)
      setTotals(result.totals)
      setPreviewRows(result.previewRows)
      setStatus(`已分类用车记录，市内 ${result.totals.car.toFixed(2)} / 往返 ${(result.totals.roundTrip ?? 0).toFixed(2)}`)
    } catch (e) {
      setStatus(`分类后重算失败: ${String(e)}`)
    }
  }, [days])

  // ponytail: 用 Tauri 原生 drag-drop 事件——HTML5 ondrop 在 Tauri 拦截下不触发，
  // .path 也非标准；原生事件直接给 paths 且无 DOM 冒泡，顺带消除 mask 闪烁。
  // 一次性订阅，用 filesRef 读最新 files 长度（同 recordsRef 模式）。
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((e) => {
      const p = e.payload
      if (p.type === 'enter' || p.type === 'over') {
        setShowDragMask(true)
      } else if (p.type === 'leave') {
        setShowDragMask(false)
      } else if (p.type === 'drop') {
        setShowDragMask(false)
        // ponytail: 拖拽支持 PDF + 图片，按扩展名过滤
        const accepted = p.paths.filter((f) => isPdfPath(f) || isImagePath(f))
        if (accepted.length === 0) return
        const fresh = accepted.filter((f) => !filesRef.current.includes(f))
        if (fresh.length === 0) return
        setFiles((prev) => [...prev, ...fresh])
        setStatus(`已添加 ${filesRef.current.length + fresh.length} 个文件`)
      }
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  // ponytail: 从系统打开文件（拖到任务栏图标 / 右键"打开方式" / 双击关联 PDF）
  // 后端 emit file://open 事件，前端监听后去重添加——复用 filesRef 读最新状态。
  useEffect(() => {
    const unlisten = listen<string[]>('file://open', (e) => {
      const fresh = e.payload.filter((f) => !filesRef.current.includes(f))
      if (fresh.length === 0) return
      setFiles((prev) => [...prev, ...fresh])
      setStatus(`已添加 ${filesRef.current.length + fresh.length} 个文件（从系统打开）`)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  // 手动检查更新（菜单触发）：与启动静默检查不同，需给用户明确反馈。
  // 下载进行中时不重复检查，避免覆盖正在下载的更新元数据。
  const handleManualCheckUpdate = useCallback(async () => {
    if (updateProgress) {
      setStatus('正在下载更新中，请稍后再试')
      return
    }
    setStatus('正在检查更新...')
    try {
      const info = await checkForUpdate()
      if (info) {
        setUpdateInfo(info)
        setStatus(`发现新版本 ${info.version}`)
      } else {
        setStatus('已是最新版本')
      }
    } catch (e) {
      setStatus(`检查更新失败: ${String(e)}`)
    }
  }, [setStatus, updateProgress])

  // 原生菜单事件分发：后端 emit id，前端按 id 路由到现有 handler
  const handlers = useRef({ handleAddFiles, handleMergePdf, handleExportReport, handleClear, handleThemeChange, setStatus, setShowAbout, handleManualCheckUpdate })
  handlers.current = { handleAddFiles, handleMergePdf, handleExportReport, handleClear, handleThemeChange, setStatus, setShowAbout, handleManualCheckUpdate }
  useEffect(() => {
    const unlisten = listen<string>('menu://event', (e) => {
      const id = e.payload
      const h = handlers.current
      if (id.startsWith('theme_')) h.handleThemeChange(id.slice(6))
      else if (id === 'file_add') h.handleAddFiles()
      else if (id === 'file_merge') h.handleMergePdf()
      else if (id === 'file_export') h.handleExportReport()
      else if (id === 'file_clear') h.handleClear()
      else if (id === 'help_about') h.setShowAbout(true)
      else if (id === 'help_check_update') h.handleManualCheckUpdate()
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  // ponytail: days 变化时用现有 records 重算汇总/预览——后端空 file_paths 走重算路径，不重跑 PDF。
  // debounce 250ms 防止连按数字键时多次 invoke 互相覆盖（如输入 "12" 会先算 days=1 再算 days=12）。
  const recordsRef = useRef(records)
  recordsRef.current = records
  useEffect(() => {
    if (isRecognizing || recordsRef.current.length === 0) return
    const t = window.setTimeout(async () => {
      try {
        const result = await recognizeInvoices([], days, recordsRef.current)
        setTotals(result.totals)
        setPreviewRows(result.previewRows)
      } catch (e) {
        setStatus(`重算失败: ${String(e)}`)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [days, isRecognizing])

  // 自动更新：延迟 3 秒后静默检查，避免启动时阻塞 UI 渲染
  useEffect(() => {
    const t = setTimeout(() => {
      checkForUpdate().then(setUpdateInfo).catch(() => {})
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  // 点击「立即更新」：关闭弹窗，后台下载更新包，进度显示在浮动组件上。
  const handleInstallUpdate = useCallback(async () => {
    setUpdateInfo(null)
    setUpdateProgress({ downloaded: 0, total: null })
    setUpdateReady(false)
    try {
      await downloadUpdate((downloaded, total) => {
        setUpdateProgress({ downloaded, total })
      })
      setUpdateReady(true)
    } catch (e) {
      setStatus(`更新失败: ${String(e)}`)
      setUpdateProgress(null)
      setUpdateReady(false)
    }
  }, [setStatus])

  // 下载完成后点击「立即更新」：安装并重启。
  const handleApplyUpdate = useCallback(async () => {
    try {
      await installDownloadedUpdate()
    } catch (e) {
      setStatus(`安装更新失败: ${String(e)}`)
    }
  }, [setStatus])

  // 关闭更新提示（下载中或下载完成均可关闭，不影响当前使用）。
  const handleDismissUpdate = useCallback(() => {
    setUpdateInfo(null)
    setUpdateProgress(null)
    setUpdateReady(false)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ color: 'var(--fg)' }}
    >
      {/* macOS 风格背景层：为毛玻璃卡片/工具栏提供色彩底层 */}
      <div className="fixed inset-0 -z-10 pointer-events-none mac-mesh-bg" />

      <main ref={mainRef} className="flex-1 flex overflow-hidden">
        <LeftPanel
          files={files}
          records={records}
          onAddFiles={handleAddFiles}
          onDeleteSelected={handleDeleteSelected}
          onClear={handleClear}
          onStartRecognition={handleStartRecognition}
          isRecognizing={isRecognizing}
          progress={progress}
          progressTotal={progressTotal}
          status={status}
          days={days}
          startDate={startDate}
          endDate={endDate}
          onOpenDatePicker={() => setShowDatePicker(true)}
          totals={totals}
        />
        <RightPanel
          records={records}
          previewRows={previewRows}
          onOpenCarClassify={() => setShowCarClassify(true)}
          previewHidden={carClassifyPending}
        />
      </main>

      <DragMask isVisible={showDragMask} />

      <DateRangeModal
        open={showDatePicker}
        startDate={startDate}
        endDate={endDate}
        onConfirm={(s, e) => {
          setStartDate(s)
          setEndDate(e)
          setShowDatePicker(false)
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />

      <MergePdfModal
        open={showMergePdf}
        files={files}
        onConfirm={handleConfirmMerge}
        onCancel={() => setShowMergePdf(false)}
      />

      {updateInfo && (
        <UpdateDialog
          update={updateInfo}
          onInstall={handleInstallUpdate}
          onLater={handleDismissUpdate}
        />
      )}

      {updateProgress && (
        <UpdateProgressWidget
          progress={updateProgress}
          ready={updateReady}
          onInstall={handleApplyUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}

      <CarClassifyModal
        open={showCarClassify}
        records={records}
        onConfirm={handleApplyCarClassification}
        onCancel={() => {
          setShowCarClassify(false)
          setCarClassifyPending(false)
        }}
      />
    </div>
  )
}

export default App