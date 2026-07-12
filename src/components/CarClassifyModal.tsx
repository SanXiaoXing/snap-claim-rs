import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { InvoiceRecord } from '../types'

export type CarCategory = 'city' | 'round_trip'

/**
 * 双态勾选批量分类弹窗。
 *
 * 核心：始终只有两类——勾选 / 未勾选，根据顶部单选做一次映射。
 *   顶部选「市内交通」：勾选 → 市内，未勾选 → 往返
 *   顶部选「往返交通」：勾选 → 往返，未勾选 → 市内
 *
 * 内部存储只是 InvoiceRecord.isRoundTrip: bool，前端做对称映射，
 * 后端按该 bool 拆 totals（car / round_trip）。
 */
export function CarClassifyModal({
  open,
  records,
  onConfirm,
  onCancel,
}: {
  open: boolean
  records: InvoiceRecord[]
  onConfirm: (updated: InvoiceRecord[]) => void
  onCancel: () => void
}) {
  // ponytail: 用车记录在 records 中的全局 index，便于回写
  const carIndices: number[] = []
  records.forEach((r, i) => {
    if (r.type === 'car') carIndices.push(i)
  })

  const [target, setTarget] = useState<CarCategory>('round_trip')
  const [checked, setChecked] = useState<Set<number>>(new Set())

  // 每次打开同步：以当前 isRoundTrip 反推 checked
  // ponytail: 把当前已是 target 类型的车记录预勾选——用户多半就是来"加几条"或"减几条"
  useEffect(() => {
    if (!open) return
    // 切换 target 时智能迁移：原本就是该 target 的车记录勾上，其余清空
    const next = new Set<number>()
    carIndices.forEach((idx) => {
      const r = records[idx]
      const isTarget = target === 'round_trip' ? r.isRoundTrip : !r.isRoundTrip
      if (isTarget) next.add(idx)
    })
    setChecked(next)
    // 仅在 open 或 target 切换时跑一次，不依赖 records 引用变化（避免回写后重置勾选）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const allChecked = carIndices.length > 0 && carIndices.every((i) => checked.has(i))
  const noneChecked = checked.size === 0

  const toggleAll = () => {
    if (allChecked) setChecked(new Set())
    else setChecked(new Set(carIndices))
  }
  const invert = () => {
    const next = new Set<number>()
    carIndices.forEach((i) => {
      if (!checked.has(i)) next.add(i)
    })
    setChecked(next)
  }
  const clear = () => setChecked(new Set())

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // 提示文案随 target 切换
  const hint =
    target === 'city'
      ? `请勾选需要归类为"市内交通"的用车记录，未勾选记录将自动归类为"往返交通"。`
      : `请勾选需要归类为"往返交通"的用车记录，未勾选记录将自动归类为"市内交通"。`

  const handleConfirm = () => {
    // ponytail: 双态映射——勾选 → target，未勾选 → 另一类
    const updated = records.map((r, i) => {
      if (r.type !== 'car') return r
      const isChecked = checked.has(i)
      const isRoundTrip =
        target === 'round_trip' ? isChecked : !isChecked
      return { ...r, isRoundTrip }
    })
    onConfirm(updated)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div
        className="relative mac-card w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-bold">用车记录批量分类</h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] hover:text-[var(--fg)]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 顶部单选 + 操作按钮 */}
        <div className="flex flex-col gap-3 px-5 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="car-target"
                checked={target === 'city'}
                onChange={() => setTarget('city')}
                className="w-4 h-4"
              />
              市内交通
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="car-target"
                checked={target === 'round_trip'}
                onChange={() => setTarget('round_trip')}
                className="w-4 h-4"
              />
              往返交通
            </label>
            <div className="ml-auto flex gap-2">
              <button
                className="btn-secondary text-xs px-3 py-1"
                onClick={toggleAll}
                disabled={carIndices.length === 0}
              >
                {allChecked ? '取消全选' : '全选'}
              </button>
              <button
                className="btn-secondary text-xs px-3 py-1"
                onClick={invert}
                disabled={carIndices.length === 0}
              >
                反选
              </button>
              <button
                className="btn-secondary text-xs px-3 py-1"
                onClick={clear}
                disabled={noneChecked}
              >
                清空
              </button>
            </div>
          </div>
          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
            {hint}
          </p>
        </div>

        {/* 用车记录列表 */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {carIndices.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)] text-center py-6">
              暂无用车记录
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {carIndices.map((idx) => {
                const r = records[idx]
                const isChecked = checked.has(idx)
                // 当前行的归类结果（双态映射后的预览）
                const willBeRoundTrip =
                  target === 'round_trip' ? isChecked : !isChecked
                const willBe = willBeRoundTrip ? '往返交通' : '市内交通'
                const wasRoundTrip = r.isRoundTrip ?? false
                const was = wasRoundTrip ? '往返交通' : '市内交通'
                const changed = willBeRoundTrip !== wasRoundTrip
                return (
                  <li
                    key={idx}
                    className={`mac-list-item flex items-center gap-3 px-3 py-2 cursor-pointer rounded ${isChecked ? 'selected' : ''}`}
                    onClick={() => toggle(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {r.filename}
                        {r.carDate && (
                          <span className="text-[var(--fg-muted)] ml-2 text-xs">
                            {r.carDate}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--fg-muted)] mt-0.5">
                        金额 {r.amount !== null ? `¥${r.amount.toFixed(2)}` : '-'}
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      <span
                        className="text-[var(--fg-muted)]"
                        style={{
                          textDecoration: changed ? 'line-through' : 'none',
                        }}
                      >
                        {was}
                      </span>
                      {changed && (
                        <>
                          <span className="mx-1 text-[var(--fg-muted)]">→</span>
                          <span className="text-[var(--accent)] font-medium">
                            {willBe}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="text-xs text-[var(--fg-muted)]">
            共 {carIndices.length} 条用车记录，已勾选 {checked.size} 条
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onCancel}>
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={carIndices.length === 0}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
