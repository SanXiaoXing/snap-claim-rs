import { useEffect, useRef, useState, useMemo } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { X, FileText, Check } from 'lucide-react'

/**
 * 合并 PDF 弹窗：点击文件按顺序选择，未被选中的文件不参与合并。
 * ponytail: 点击选择替代拖拽排序——Tauri webview 原生层拦截 drag API，
 * pointer 事件拖拽在各种边界情况都有体验问题。点击选序更简单可靠。
 */
export function MergePdfModal({
  open,
  files,
  onConfirm,
  onCancel,
}: {
  open: boolean
  files: string[]
  onConfirm: (orderedFiles: string[]) => void
  onCancel: () => void
}) {
  // 选中的文件顺序：Map<filePath, 序号从1开始>
  const [orderMap, setOrderMap] = useState<Map<string, number>>(new Map())

  // 每次打开默认全选（按原顺序）
  useEffect(() => {
    if (open) {
      const m = new Map<string, number>()
      files.forEach((f, i) => m.set(f, i + 1))
      setOrderMap(m)
    }
  }, [open, files])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // 延迟卸载
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else if (mounted) {
      const t = setTimeout(() => setMounted(false), 240)
      return () => clearTimeout(t)
    }
  }, [open, mounted])

  // GSAP 进出场
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!overlayRef.current || !cardRef.current) return
    const mm = gsap.matchMedia()
    mm.add(
      {
        normal: '(prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        const { reduce } = ctx.conditions!
        if (open) {
          gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0 : 0.2, ease: 'power2.out' })
          gsap.fromTo(cardRef.current, { autoAlpha: 0, y: 16, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: reduce ? 0 : 0.4, ease: 'back.out(1.5)' })
        } else {
          gsap.to(overlayRef.current, { autoAlpha: 0, duration: reduce ? 0 : 0.2, ease: 'expo.in' })
          gsap.to(cardRef.current, { autoAlpha: 0, y: 8, scale: 0.98, duration: reduce ? 0 : 0.22, ease: 'expo.in' })
        }
      },
    )
  }, { dependencies: [open], scope: overlayRef })

  // 点击切换选中：已选中 → 取消（后续序号前移）；未选中 → 追加到末尾
  const handleToggle = (file: string) => {
    setOrderMap((prev) => {
      const next = new Map(prev)
      if (next.has(file)) {
        // 取消选中：移除，后面的序号递减
        const removed = next.get(file)!
        next.delete(file)
        for (const [k, v] of next) {
          if (v > removed) next.set(k, v - 1)
        }
      } else {
        next.set(file, next.size + 1)
      }
      return next
    })
  }

  // 按序号排序得到最终合并顺序
  const sortedSelection = useMemo(() => {
    return [...orderMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([file]) => file)
  }, [orderMap])

  if (!mounted) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[90] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div
        ref={cardRef}
        className="relative mac-card w-[520px] max-w-[92vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-bold">合并 PDF</h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] hover:text-[var(--fg)]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 提示 */}
        <div className="px-5 py-2 text-xs text-[var(--fg-muted)] border-b border-[var(--border)]">
          点击文件选择合并顺序，未选中的文件不参与合并
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-auto px-5 py-3 min-h-0">
          {files.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)] text-center py-6">暂无文件</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {files.map((file) => {
                const name = file.split(/[\\/]/).pop() ?? file
                const order = orderMap.get(file)
                const isSelected = order !== undefined
                return (
                  <li
                    key={file}
                    onClick={() => handleToggle(file)}
                    className={`
                      mac-list-item flex items-center gap-2 px-3 py-2 cursor-pointer
                      transition-all duration-150
                      ${isSelected ? 'selected' : ''}
                    `}
                  >
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {order}
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-[var(--border)] text-[var(--fg-muted)] text-[11px] flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100" />
                    )}
                    <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'}`} />
                    <span className="text-sm truncate flex-1">{name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="text-xs text-[var(--fg-muted)]">
            已选 {orderMap.size} / {files.length} 个文件
            <button
              className="ml-2 text-[var(--accent)] hover:underline"
              onClick={() => {
                if (orderMap.size === files.length) {
                  setOrderMap(new Map())
                } else {
                  const m = new Map<string, number>()
                  files.forEach((f, i) => m.set(f, i + 1))
                  setOrderMap(m)
                }
              }}
            >
              {orderMap.size === files.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onCancel}>取消</button>
            <button
              className="btn-primary"
              onClick={() => onConfirm(sortedSelection)}
              disabled={orderMap.size === 0}
            >
              合并
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}