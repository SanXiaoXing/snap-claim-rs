import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import './styles/globals.css'
import { LeftPanel, RightPanel } from './components/Panels'
import { DragMask } from './components/DragMask'
import { DateRangeModal } from './components/DateRangeModal'
import { AboutModal } from './components/AboutModal'
import { CarClassifyModal } from './components/CarClassifyModal'
import { UpdateDialog } from './components/UpdateDialog'
import { pickPdfs, recognizeInvoices, mergePdfs, pickSavePath, exportExcel, checkForUpdate, installUpdate } from './lib/tauri'
import { useGsapMount } from './lib/gsap-hooks'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { InvoiceRecord, Totals, PreviewRow, UpdateInfo } from './types'

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
  // ponytail: 识别完成且有 car 记录时进入"待分类"态——弹窗自动开 + 报销预览暂隐，
  // 用户确认或取消后解除。手动点按钮二次分类不进入此态（预览已有，无需藏）。
  const [carClassifyPending, setCarClassifyPending] = useState(false)
  // GSAP mount timeline 作用域：覆盖 main 内的卡片 + 右侧表格区
  const mainRef = useRef<HTMLElement>(null)
  useGsapMount(mainRef, '.gsap-enter', 0.08)

  // 自动更新：启动时检查一次，发现新版本弹窗
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number | null } | null>(null)

  // 添加文件（Tauri 原生文件选择对话框）
  const handleAddFiles = useCallback(async () => {
    const selected = await pickPdfs()
    if (selected.length === 0) return
    setFiles((prev) => {
      const newFiles = selected.filter((f) => !prev.includes(f))
      return [...prev, ...newFiles]
    })
    setStatus(`已添加 ${files.length + selected.length} 个文件，点击「开始识别」`)
  }, [files.length])

  // 开始识别（调用 Rust 后端）
  const handleStartRecognition = useCallback(async () => {
    if (files.length === 0) {
      setStatus('请先上传 PDF 文件')
      return
    }

    // ponytail: 增量识别——只把「未识别过」的文件发给后端，已识别的复用现有 records，
    // 避免每次新增 PDF 都重跑全部文件。days 变化时后端用 existing records 重算汇总。
    const recognizedPaths = new Set(records.map((r) => r.fullPath))
    const newFiles = files.filter((f) => !recognizedPaths.has(f))

    setIsRecognizing(true)
    setProgress(0)
    setProgressTotal(newFiles.length)
    setStatus(newFiles.length > 0 ? `正在识别 ${newFiles.length} 个新文件...` : '正在重新计算汇总...')

    try {
      const result = await recognizeInvoices(
        newFiles,
        days,
        records,
        (cur, total) => {
          setProgress(cur)
          setProgressTotal(total)
        },
        (record) => {
          setRecords((prev) => [...prev, record])
        }
      )

      // 全量对齐（existing + new），totals/previewRows 最后一次性填充
      setRecords(result.records)
      setTotals(result.totals)
      setPreviewRows(result.previewRows)

      // ponytail: 识别完成若有 car 记录则自动弹分类窗——
      // 预览暂隐（pending=true）直到用户确认/取消；否则直接显示。
      const hasCars = result.records.some((r) => r.type === 'car')
      if (hasCars) {
        setCarClassifyPending(true)
        setShowCarClassify(true)
        setStatus(`识别完成，共 ${result.records.length} 条记录，请先分类用车记录`)
      } else {
        setCarClassifyPending(false)
        setStatus(`识别完成，共 ${result.records.length} 条记录`)
      }
    } catch (e) {
      setStatus(`识别失败: ${String(e)}`)
    } finally {
      setIsRecognizing(false)
    }
  }, [files, days, records])

  // 删除选中
  const handleDeleteSelected = useCallback((indices: Set<number>) => {
    if (indices.size === 0) return
    setFiles((prev) => prev.filter((_, i) => !indices.has(i)))
    setStatus(`已删除 ${indices.size} 个文件`)
  }, [])

  // 清空
  const handleClear = useCallback(() => {
    setFiles([])
    setRecords([])
    setTotals(EMPTY_TOTALS)
    setPreviewRows([])
    setStatus('等待上传文件...')
  }, [])

  // 合并 PDF：默认文件名取出差日期区间 YYYYMMDD-YYYYMMDD.pdf，缺日期回落 merged.pdf
  const handleMergePdf = useCallback(async () => {
    if (files.length === 0) {
      setStatus('请先添加 PDF 文件')
      return
    }
    const name = startDate && endDate
      ? `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}.pdf`
      : 'merged.pdf'
    const output = await pickSavePath(name, 'pdf')
    if (!output) return
    setStatus(`正在合并 ${files.length} 个文件...`)
    try {
      await mergePdfs(files, output)
      setStatus(`已合并 ${files.length} 个文件到 ${output}`)
    } catch (e) {
      setStatus(`合并失败: ${String(e)}`)
    }
  }, [files, startDate, endDate])

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
        const pdfs = p.paths.filter((f) => f.toLowerCase().endsWith('.pdf'))
        if (pdfs.length === 0) return
        const fresh = pdfs.filter((f) => !filesRef.current.includes(f))
        if (fresh.length === 0) return
        setFiles((prev) => [...prev, ...fresh])
        setStatus(`已添加 ${filesRef.current.length + fresh.length} 个文件（拖拽）`)
      }
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  // 手动检查更新（菜单触发）：与启动静默检查不同，需给用户明确反馈
  const handleManualCheckUpdate = useCallback(async () => {
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
  }, [setStatus])

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

  // 点击「立即更新」：下载安装，进度驱动 UpdateDialog 的进度条，完成后后端自动重启
  const handleInstallUpdate = useCallback(async () => {
    setUpdateProgress({ downloaded: 0, total: null })
    try {
      await installUpdate((downloaded, total) => {
        setUpdateProgress({ downloaded, total })
      })
    } catch (e) {
      setStatus(`更新失败: ${String(e)}`)
      setUpdateProgress(null)
    }
  }, [setStatus])

  const handleLaterUpdate = useCallback(() => {
    setUpdateInfo(null)
    setUpdateProgress(null)
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

      {updateInfo && (
        <UpdateDialog
          update={updateInfo}
          onInstall={handleInstallUpdate}
          onLater={handleLaterUpdate}
          progress={updateProgress}
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