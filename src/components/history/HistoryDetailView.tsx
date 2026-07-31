import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getHistoryDetail } from '../../lib/tauri'
import { PREVIEW_MAX_W } from '../Panels'
import type { HistoryDetail } from '../../types'

interface HistoryDetailViewProps {
  id: number
  onBack: () => void
}

export function HistoryDetailView({ id, onBack }: HistoryDetailViewProps) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDetail()
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHistoryDetail(id)
      setDetail(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v: number) => `¥${v.toFixed(2)}`

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="mac-card p-8 text-sm text-[var(--fg-muted)]">加载中...</div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mac-card p-6 text-sm text-red-500">{error || '加载失败'}</div>
        <button className="btn-secondary mt-4" onClick={onBack}>返回</button>
      </div>
    )
  }

  const totals = detail.totals

  return (
    <div className="flex-1 flex flex-col gap-4 p-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1 inline" />
            返回
          </button>
          <h1 className="text-lg font-bold">{detail.name}</h1>
        </div>
      </div>

      {/* 汇总信息卡片 */}
      <div className="flex gap-3 flex-wrap">
        <div className="mac-card p-3 min-w-[140px]">
          <div className="text-xs text-[var(--fg-muted)]">保存时间</div>
          <div className="text-sm font-medium">{detail.createdAt}</div>
        </div>
        <div className="mac-card p-3 min-w-[140px]">
          <div className="text-xs text-[var(--fg-muted)]">出差期间</div>
          <div className="text-sm font-medium">
            {detail.startDate && detail.endDate
              ? `${detail.startDate} 至 ${detail.endDate}`
              : '—'}
          </div>
        </div>
        <div className="mac-card p-3 min-w-[140px]">
          <div className="text-xs text-[var(--fg-muted)]">出差天数</div>
          <div className="text-sm font-medium">{detail.days} 天</div>
        </div>
        <div className="mac-card p-3 min-w-[140px]">
          <div className="text-xs text-[var(--fg-muted)]">总金额</div>
          <div className="text-lg font-bold text-[var(--accent)]">{fmt(totals.total)}</div>
          <div className="text-xs text-[var(--fg-muted)]">{totals.chinese}</div>
        </div>
      </div>

      {/* 费用汇总 */}
      <div className="mac-card p-4">
        <h2 className="font-bold mb-3">费用汇总</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-[var(--fg-muted)]">火车</div>
            <div className="font-medium tabular-nums">{fmt(totals.train)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">飞机</div>
            <div className="font-medium tabular-nums">{fmt(totals.flight)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">住宿</div>
            <div className="font-medium tabular-nums">{fmt(totals.hotel)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">用车</div>
            <div className="font-medium tabular-nums">{fmt(totals.car)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">补助</div>
            <div className="font-medium tabular-nums">{fmt(totals.subsidy)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">预借金额</div>
            <div className="font-medium tabular-nums">{fmt(totals.advance)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-muted)]">退补金额</div>
            <div className="font-medium tabular-nums">{fmt(totals.refund)}</div>
          </div>
        </div>
      </div>

      {/* 报销单预览 */}
      {detail.previewRows.length > 0 && (
        <div className="mac-card p-4">
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
                  <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">往返交通</th>
                  <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">补助标准</th>
                  <th className="max-w-[100px] px-2 py-1 text-center whitespace-nowrap overflow-hidden text-ellipsis">出差天数</th>
                  <th className="max-w-[120px] px-2 py-1 text-right whitespace-nowrap">合计</th>
                </tr>
              </thead>
              <tbody>
                {detail.previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {row.cells.map((cell, colIdx) => (
                        <td
                          key={colIdx}
                          style={{ maxWidth: `${PREVIEW_MAX_W[colIdx]}px` }}
                          className={`px-2 py-1 whitespace-nowrap ${
                            typeof cell === 'number' ? 'text-right' : 'text-center overflow-hidden text-ellipsis'
                          } ${row.bold ? 'font-bold bg-[var(--accent-light)]' : ''}`}
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
        </div>
      )}

      {/* 无预览数据提示 */}
      {detail.previewRows.length === 0 && (
        <div className="mac-card p-8 text-center text-sm text-[var(--fg-muted)]">
          暂无报销单预览数据
        </div>
      )}
    </div>
  )
}
