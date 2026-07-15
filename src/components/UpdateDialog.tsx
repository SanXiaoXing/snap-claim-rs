import { useEffect, useRef } from "react"
import { ArrowDownCircle } from "lucide-react"
import { gsap } from "gsap"
import type { UpdateInfo } from "../types"

interface UpdateDialogProps {
  update: UpdateInfo
  onInstall: () => void
  onLater: () => void
}

export function UpdateDialog({ update, onInstall, onLater }: UpdateDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.4)" }
      )
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div ref={cardRef} className="relative mac-card p-8 max-w-md w-full mx-6">
        {/* 图标 + 版本号 */}
        <div className="flex flex-col items-center mb-5">
          <ArrowDownCircle
            size={40}
            style={{ color: "var(--accent)" }}
            strokeWidth={1.5}
          />
          <h2 className="text-lg font-semibold mt-3" style={{ color: "var(--fg)" }}>
            发现新版本
          </h2>
          <span
            className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}
          >
            v{update.version}
          </span>
        </div>

        {/* 更新日志 */}
        <div
          className="text-sm whitespace-pre-line leading-relaxed mb-6 px-2"
          style={{ color: "var(--fg-muted)" }}
        >
          {update.notes}
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3">
          <button onClick={onLater} className="btn-secondary">
            稍后
          </button>
          <button onClick={onInstall} className="btn-primary">
            立即更新
          </button>
        </div>
      </div>
    </div>
  )
}
