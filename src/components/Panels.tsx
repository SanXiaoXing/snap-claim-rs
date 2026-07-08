import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import type { InvoiceRecord, Totals, PreviewRow } from '../types'

const TYPE_MAP = {
  train: '高铁票',
  hotel: '酒店住宿',
  car: '市内用车',
  flight: '飞机票',
  invoice: '发票',
  unknown: '未知',
}

// 报销单预览各列最大宽度（px），按列顺序：出发/到达/交通/飞机/住宿/市内/补助/天数/合计
const PREVIEW_MAX_W = [140, 140, 120, 100, 100, 120, 120, 100, 120]

export function LeftPanel({
  files,
  onAddFiles,
  onDeleteSelected,
  onClear,
  onStartRecognition,
  isRecognizing,
  progress,
  progressTotal,
  status,
  days,
  startDate,
  endDate,
  onOpenDatePicker,
  totals,
}: {
  files: string[]
  onAddFiles: () => void
  onDeleteSelected: (indices: Set<number>) => void
  onClear: () => void
  onStartRecognition: () => void
  isRecognizing: boolean
  progress: number
  progressTotal: number
  status: string
  days: number
  startDate: string
  endDate: string
  onOpenDatePicker: () => void
  totals: Totals
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())

  return (
    <div className="w-[340px] flex flex-col gap-4 p-4">
      {/* 文件上传区 */}
      <section className="mac-card p-4">
        <h2 className="font-bold mb-2">上传 PDF 文件</h2>
        <p className="text-sm text-[var(--fg-muted)] mb-4">
          选择包含高铁票、酒店或用车确认单的 PDF 文件
        </p>
        <button
          className="btn-secondary w-full"
          onClick={onAddFiles}
        >
          添加 PDF 文件
        </button>

        {/* 文件列表 */}
        <div className="mt-4 flex flex-col gap-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`mac-list-item flex items-center gap-2 px-2 py-1 ${selectedFiles.has(idx) ? 'selected' : ''}`}
              onClick={() => {
                const newSet = new Set(selectedFiles)
                if (newSet.has(idx)) newSet.delete(idx)
                else newSet.add(idx)
                setSelectedFiles(newSet)
              }}
            >
              <input
                type="checkbox"
                checked={selectedFiles.has(idx)}
                onChange={() => {}}
                className="w-4 h-4"
              />
              <span className="text-sm truncate">{file}</span>
            </div>
          ))}
        </div>

        {/* 删除/清空按钮 */}
        <div className="mt-4 flex gap-2">
          <button
            className="btn-danger"
            onClick={() => {
              onDeleteSelected(selectedFiles)
              setSelectedFiles(new Set())
            }}
          >
            删除选中
          </button>
          <button
            className="btn-secondary flex-1"
            onClick={onClear}
          >
            清空列表
          </button>
        </div>
      </section>

      {/* 识别区 */}
      <section className="mac-card p-4">
        <button
          className="btn-primary w-full"
          onClick={onStartRecognition}
          disabled={isRecognizing}
        >
          {isRecognizing ? `识别中 ${progress}/${progressTotal}` : '开始识别'}
        </button>

        {/* 进度条 */}
        {isRecognizing && (
          <div className="mt-2 h-2 bg-[var(--border)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${progressTotal > 0 ? (progress / progressTotal) * 100 : 0}%` }}
            />
          </div>
        )}

        <p className="mt-2 text-sm text-center text-[var(--fg-muted)]">{status}</p>
      </section>

      {/* 出差设置 */}
      <section className="mac-card p-4">
        <h2 className="font-bold mb-2">出差设置</h2>
        <button
          className="btn-secondary w-full flex items-center justify-between"
          onClick={onOpenDatePicker}
        >
          <span className="text-sm">
            {startDate || endDate
              ? `${startDate || "—"} 至 ${endDate || "—"}`
              : "点击选择出差日期"}
          </span>
          <CalendarIcon className="h-4 w-4 opacity-60" />
        </button>
        <div className="mt-2 text-sm text-[var(--fg-muted)]">
          出差 <span className="font-bold text-[var(--accent)]">{days}</span> 天 · 补助标准：¥100/天
        </div>
      </section>

      {/* 费用汇总 */}
      <section className="mac-card p-4">
        <h2 className="font-bold mb-2">费用汇总</h2>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">
            ¥ {totals.total.toFixed(2)}
          </div>
          <div className="text-sm text-[var(--fg-muted)] mt-1">{totals.chinese}</div>

          <div className="mt-4 flex justify-around">
            <div>
              <div className="text-sm text-[var(--fg-muted)]">预借金额</div>
              <div className="font-bold">¥ {totals.advance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--fg-muted)]">退补金额</div>
              <div className="font-bold">¥ {totals.refund.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function RightPanel({
  records,
  previewRows,
}: {
  records: InvoiceRecord[]
  previewRows: PreviewRow[]
}) {
  return (
    <div className="flex-1 flex flex-col gap-4 p-4">
      {/* 识别结果表格：各列设最大宽度，总宽随内容自适应 + 固定高度 + 不换行 */}
      <section className="mac-card p-4">
        <h2 className="font-bold mb-2">识别结果</h2>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-[var(--border)]">
          <table className="data-table">
            <thead>
              <tr>
                <th className="max-w-[80px] px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">类型</th>
                <th className="max-w-[240px] px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">名称/车次</th>
                <th className="max-w-[160px] px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">日期/时间</th>
                <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">金额</th>
                <th className="max-w-[120px] px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">状态</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr key={idx}>
                  <td className="max-w-[80px] px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis">{TYPE_MAP[r.type]}</td>
                  <td className="max-w-[240px] px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.trainNumber || r.hotelName || r.flightNumber || r.filename}
                  </td>
                  <td className="max-w-[160px] px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.departureTime || r.checkInDate || r.flightDate || r.carDate}
                  </td>
                  <td className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">
                    {r.amount !== null ? `¥${r.amount.toFixed(2)}` : '-'}
                  </td>
                  <td className="max-w-[120px] px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span
                      className={`${r.amount !== null ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}
                    >
                      {r.amount !== null ? '已识别' : '未识别金额'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 报销单预览表格：各列设最大宽度，总宽随内容自适应 + 不换行 */}
      <section className="mac-card p-4">
        <h2 className="font-bold mb-2">报销单预览</h2>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="max-w-[140px] px-2 py-1 text-center whitespace-nowrap overflow-hidden text-ellipsis">出发地点</th>
                <th className="max-w-[140px] px-2 py-1 text-center whitespace-nowrap overflow-hidden text-ellipsis">到达地点</th>
                <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">交通金额</th>
                <th className="max-w-[100px] px-2 py-1 text-right whitespace-nowrap">飞机票</th>
                <th className="max-w-[100px] px-2 py-1 text-right whitespace-nowrap">住宿</th>
                <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">市内交通</th>
                <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">补助标准</th>
                <th className="max-w-[100px] px-2 py-1 text-center whitespace-nowrap overflow-hidden text-ellipsis">出差天数</th>
                <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">合计</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx}>
                  {row.cells.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      style={{ maxWidth: `${PREVIEW_MAX_W[colIdx]}px` }}
                      className={`px-2 py-1 whitespace-nowrap ${typeof cell === 'number' ? 'text-right' : 'text-center overflow-hidden text-ellipsis'} ${row.bold ? 'font-bold bg-[var(--accent-light)]' : ''}`}
                    >
                      {typeof cell === 'number' && cell !== 0
                        ? cell.toFixed(2)
                        : cell || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}