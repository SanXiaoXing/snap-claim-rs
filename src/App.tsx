import { useState, useCallback } from 'react'
import './styles/globals.css'
import { Header } from './components/Header'
import { LeftPanel, RightPanel } from './components/Panels'
import { DragMask } from './components/DragMask'
import { pickPdfs, recognizeInvoices } from './lib/tauri'
import type { InvoiceRecord, Totals, PreviewRow } from './types'

const EMPTY_TOTALS: Totals = {
  train: 0, flight: 0, hotel: 0, car: 0, invoice: 0,
  subsidy: 0, advance: 0, refund: 0, total: 0, chinese: '零元整',
}

function App() {
  const [currentTheme, setCurrentTheme] = useState('清爽办公风')
  const [files, setFiles] = useState<string[]>([])
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [status, setStatus] = useState('等待上传文件...')
  const [qrResults, setQrResults] = useState<{ page: number; urls: string[]; filename: string }[]>([])
  const [days, setDays] = useState(1)
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [showDragMask, setShowDragMask] = useState(false)

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

    setIsRecognizing(true)
    setProgress(0)
    setProgressTotal(files.length)
    setStatus('正在识别...')
    setQrResults([])

    try {
      const result = await recognizeInvoices(files, days, (cur, total) => {
        setProgress(cur)
        setProgressTotal(total)
      }, (items) => {
        setQrResults((prev) => [...prev, ...items])
      })

      setRecords(result.records)
      setTotals(result.totals)
      setPreviewRows(result.previewRows)
      setStatus(`识别完成，共 ${result.records.length} 条记录`)
    } catch (e) {
      setStatus(`识别失败: ${String(e)}`)
    } finally {
      setIsRecognizing(false)
    }
  }, [files, days])

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
    setQrResults([])
    setStatus('等待上传文件...')
  }, [])

  // 合并 PDF（暂未实现）
  const handleMergePdf = useCallback(() => {
    setStatus('合并 PDF 功能即将上线')
  }, [])

  // 导出报销单（暂未实现）
  const handleExportReport = useCallback(() => {
    setStatus('导出报销单功能即将上线')
  }, [])

  // 主题切换
  const handleThemeChange = useCallback((theme: string) => {
    setCurrentTheme(theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  // 拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setShowDragMask(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setShowDragMask(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setShowDragMask(false)
    // ponytail: 拖拽文件暂用 Tauri drag-drop 事件，后续接入
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => (f as any).path || f.name)
      .filter((p) => p.toLowerCase().endsWith('.pdf'))
    if (paths.length > 0) {
      setFiles((prev) => [...prev, ...paths.filter((f) => !prev.includes(f))])
      setStatus(`已添加 ${files.length + paths.length} 个文件（拖拽）`)
    }
  }, [files.length])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        onMergePdf={handleMergePdf}
        onExportReport={handleExportReport}
      />

      <main className="flex-1 flex overflow-hidden">
        <LeftPanel
          files={files}
          onAddFiles={handleAddFiles}
          onDeleteSelected={handleDeleteSelected}
          onClear={handleClear}
          onStartRecognition={handleStartRecognition}
          isRecognizing={isRecognizing}
          progress={progress}
          progressTotal={progressTotal}
          status={status}
          qrResults={qrResults}
          days={days}
          onDaysChange={setDays}
          totals={totals}
        />
        <RightPanel records={records} previewRows={previewRows} />
      </main>

      <DragMask isVisible={showDragMask} />
    </div>
  )
}

export default App