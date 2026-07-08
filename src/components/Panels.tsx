import { useState } from 'react'
import type { InvoiceRecord, Totals, PreviewRow } from '../types'

const TYPE_MAP = {
  train: '高铁票',
  hotel: '酒店住宿',
  car: '市内用车',
  flight: '飞机票',
  invoice: '发票',
  unknown: '未知',
}

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
  qrResults,
  days,
  onDaysChange,
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
  qrResults: { page: number; urls: string[]; filename: string }[]
  days: number
  onDaysChange: (days: number) => void
  totals: Totals
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())

  return (
    <div className="w-[340px] flex flex-col gap-4 p-4 bg-[var(--bg)]">
      {/* 文件上传区 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <h2 className="font-bold mb-2">上传 PDF 文件</h2>
        <p className="text-sm text-[var(--fg)] opacity-70 mb-4">
          选择包含高铁票、酒店或用车确认单的 PDF 文件
        </p>
        <button
          className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-light)]"
          onClick={onAddFiles}
        >
          添加 PDF 文件
        </button>

        {/* 文件列表 */}
        <div className="mt-4 flex flex-col gap-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-2 py-1 rounded ${selectedFiles.has(idx) ? 'bg-[var(--accent-light)]' : 'bg-[var(--border)]'}`}
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
            className="px-3 py-1 bg-[var(--danger)] text-white rounded hover:opacity-80"
            onClick={() => {
              onDeleteSelected(selectedFiles)
              setSelectedFiles(new Set())
            }}
          >
            删除选中
          </button>
          <button
            className="px-3 py-1 bg-[var(--border)] rounded hover:bg-[var(--accent)]"
            onClick={onClear}
          >
            清空列表
          </button>
        </div>
      </section>

      {/* 识别区 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <button
          className={`w-full px-4 py-2 rounded ${isRecognizing ? 'bg-[var(--border)]' : 'bg-[var(--success)] text-white hover:opacity-80'}`}
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

        <p className="mt-2 text-sm text-center text-[var(--fg)] opacity-70">{status}</p>

        {/* 二维码扫描结果 */}
        {qrResults.length > 0 && (
          <div className="mt-2 p-2 rounded bg-[var(--bg)] border border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--accent)] mb-1">二维码扫描结果:</p>
            {qrResults.map((qr, i) => (
              <div key={i} className="text-xs text-[var(--fg)] opacity-80 mb-1">
                <span className="opacity-50">{qr.filename} 第{qr.page}页:</span>
                {qr.urls.map((url, j) => (
                  <div key={j} className="ml-2 break-all font-mono">{url}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 出差设置 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <h2 className="font-bold mb-2">出差设置</h2>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={days}
            onChange={(e) => onDaysChange(parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1 border border-[var(--border)] rounded bg-[var(--bg)]"
            min={0}
            max={999}
          />
          <span className="text-sm">天</span>
          <span className="text-sm opacity-70">补助标准：¥100/天</span>
        </div>
      </section>

      {/* 费用汇总 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <h2 className="font-bold mb-2">费用汇总</h2>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">
            ¥ {totals.total.toFixed(2)}
          </div>
          <div className="text-sm text-[var(--fg)] opacity-70 mt-1">{totals.chinese}</div>

          <div className="mt-4 flex justify-around">
            <div>
              <div className="text-sm opacity-70">预借金额</div>
              <div className="font-bold">¥ {totals.advance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm opacity-70">退补金额</div>
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
    <div className="flex-1 flex flex-col gap-4 p-4 bg-[var(--bg)]">
      {/* 识别结果表格 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <h2 className="font-bold mb-2">识别结果</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-2 py-1 text-left">类型</th>
              <th className="px-2 py-1 text-left">名称/车次</th>
              <th className="px-2 py-1 text-left">日期/时间</th>
              <th className="px-2 py-1 text-right">金额</th>
              <th className="px-2 py-1 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={idx} className="border-b border-[var(--border)]">
                <td className="px-2 py-1">{TYPE_MAP[r.type]}</td>
                <td className="px-2 py-1">
                  {r.trainNumber || r.hotelName || r.flightNumber || r.filename}
                </td>
                <td className="px-2 py-1">
                  {r.departureTime || r.checkInDate || r.flightDate || r.carDate}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.amount !== null ? `¥${r.amount.toFixed(2)}` : '-'}
                </td>
                <td className="px-2 py-1">
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
      </section>

      {/* 报销单预览表格 */}
      <section className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
        <h2 className="font-bold mb-2">报销单预览</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-2 py-1 text-center">出发地点</th>
              <th className="px-2 py-1 text-center">到达地点</th>
              <th className="px-2 py-1 text-right">交通金额</th>
              <th className="px-2 py-1 text-right">飞机票</th>
              <th className="px-2 py-1 text-right">住宿</th>
              <th className="px-2 py-1 text-right">市内交通</th>
              <th className="px-2 py-1 text-right">补助标准</th>
              <th className="px-2 py-1 text-center">出差天数</th>
              <th className="px-2 py-1 text-right">合计</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, idx) => (
              <tr key={idx} className="border-b border-[var(--border)]">
                {row.cells.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-2 py-1 ${typeof cell === 'number' ? 'text-right' : 'text-center'} ${row.bold ? 'font-bold bg-[var(--accent-light)]' : ''}`}
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
      </section>
    </div>
  )
}