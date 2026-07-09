import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.4)' }
      )
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 内容卡片 */}
      <div
        ref={contentRef}
        className="relative mac-card p-8 max-w-md w-full mx-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 大标题居中 + 右侧署名链接 */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1
            className="text-4xl font-normal tracking-wide"
            style={{
              fontFamily: '"Emblema One", serif',
              color: 'var(--fg)',
            }}
          >
            SnapClaim
          </h1>
          <a
            href="https://github.com/SanXiaoXing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm opacity-60 mt-1 transition-all duration-200 hover:opacity-100 hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            by SanXiaoXing
          </a>
        </div>

        {/* 版本居中 + 仓库链接 */}
        <div className="text-sm mb-5 text-center">
          <a
            href="https://github.com/SanXiaoXing/snap-claim-rs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-200 hover:underline"
            style={{ color: 'var(--fg-muted)' }}
          >
            Version 1.0.0
          </a>
        </div>

        {/* 描述：幽默 + 功能 */}
        <div
          className="text-sm leading-relaxed max-w-[36ch] mx-auto opacity-80 text-center space-y-2"
          style={{ color: 'var(--fg)' }}
        >
          <p>发票堆成山？报销单计算难？</p>
          <p className="opacity-70">
            扔进来 —— 电子发票、车票、机票、酒店单，
            全自动识别，一键生成报销 Excel， 照抄就行。
          </p>
          <p className="opacity-60 text-xs pt-1">
            * 让你的报销都有迹可寻
          </p>
        </div>

        {/* 关闭按钮：右下角 */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}