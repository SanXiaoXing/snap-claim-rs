import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Trash2, Eye } from 'lucide-react'
import { getHistoryList, deleteHistory } from '../../lib/tauri'
import type { HistorySummary } from '../../types'

interface HistoryViewProps {
  onBack: () => void
  onViewDetail: (id: number) => void
}

export function HistoryView({ onBack, onViewDetail }: HistoryViewProps) {
  const [items, setItems] = useState<HistorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    loadList()
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getHistoryList()
      setItems(list)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    setDeletingId(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (deletingId === null) return
    try {
      await deleteHistory(deletingId)
      setItems((prev) => prev.filter((item) => item.id !== deletingId))
    } catch (e) {
      setError(String(e))
    } finally {
      setDeletingId(null)
    }
  }, [deletingId])

  const cancelDelete = useCallback(() => {
    setDeletingId(null)
  }, [])

  // 金额格式化
  const fmt = (v: number) => `¥${v.toFixed(2)}`

  return (
    <div className="flex-1 flex flex-col gap-4 p-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1 inline" />
            返回
          </button>
          <h1 className="text-lg font-bold">历史记录</h1>
        </div>
        <button className="btn-secondary text-xs px-3 py-1" onClick={loadList} disabled={loading}>
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mac-card p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/30">
          {error}
          <button className="ml-2 underline" onClick={loadList}>重试</button>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="mac-card p-8 text-center text-sm text-[var(--fg-muted)]">
          加载中...
        </div>
      )}

      {/* 空列表 */}
      {!loading && !error && items.length === 0 && (
        <div className="mac-card p-8 text-center text-sm text-[var(--fg-muted)]">
          暂无历史记录
        </div>
      )}

      {/* 列表 */}
      {!loading && items.length > 0 && (
        <div className="mac-card p-4">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left whitespace-nowrap">名称</th>
                  <th className="px-2 py-1 text-left whitespace-nowrap">保存时间</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">火车</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">飞机</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">住宿</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">用车</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">补助</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">预借</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">退补</th>
                  <th className="px-2 py-1 text-right whitespace-nowrap">总金额</th>
                  <th className="px-2 py-1 text-center whitespace-nowrap" colSpan={2}>单据数</th>
                  <th className="px-2 py-1 text-left whitespace-nowrap">备注</th>
                  <th className="px-2 py-1 text-center whitespace-nowrap">操作</th>
                </tr>
                <tr>
                  <th colSpan={10} />
                  <th className="px-1 py-0.5 text-center text-[10px] text-[var(--fg-muted)] font-normal">城际</th>
                  <th className="px-1 py-0.5 text-center text-[10px] text-[var(--fg-muted)] font-normal">其他</th>
                  <th colSpan={2} />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--accent-light)]/30">
                    <td className="px-2 py-1 whitespace-nowrap font-medium">{item.name}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-[var(--fg-muted)]">{item.createdAt}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.train)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.flight)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.hotel)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.car)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.subsidy)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.advance)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{fmt(item.totals.refund)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums font-bold">{fmt(item.totals.total)}</td>
                    <td className="px-1 py-1 text-center whitespace-nowrap tabular-nums">{item.intercityCount}</td>
                    <td className="px-1 py-1 text-center whitespace-nowrap tabular-nums">{item.otherCount}</td>
                    <td className="px-2 py-1 text-sm text-[var(--fg-muted)] max-w-[120px] truncate">{item.remark ?? ''}</td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="btn-secondary text-xs px-2 py-1"
                          onClick={() => onViewDetail(item.id)}
                          title="查看详情"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn-danger text-xs px-2 py-1"
                          onClick={() => handleDelete(item.id)}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="mac-card p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-lg mb-2">确认删除</h3>
            <p className="text-sm text-[var(--fg-muted)] mb-4">
              确定要删除这条历史记录吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={cancelDelete}>
                取消
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
