import { X, Download, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface UpdateProgressWidgetProps {
  progress: { downloaded: number; total: number | null }
  ready: boolean
  onInstall: () => void
  onDismiss: () => void
}

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function UpdateProgressWidget({ progress, ready, onInstall, onDismiss }: UpdateProgressWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null)
  const percent =
    progress.total !== null && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null

  useEffect(() => {
    if (widgetRef.current) {
      gsap.fromTo(
        widgetRef.current,
        { opacity: 0, y: 16, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.4)" }
      )
    }
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-center gap-2">
      <div
        ref={widgetRef}
        className={[
          "relative w-14 h-14 rounded-full mac-card flex items-center justify-center select-none",
          ready ? "cursor-pointer update-ready-glow active:scale-95" : "cursor-default",
        ].join(" ")}
        onClick={ready ? onInstall : undefined}
        role={ready ? "button" : undefined}
        aria-label={ready ? "立即更新" : "下载更新中"}
        title={ready ? "点击安装更新" : "下载更新中"}
        style={{ transition: "transform 0.1s ease" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-[var(--card)] border border-[var(--border)] shadow-sm hover:bg-black/5 transition-colors"
          aria-label="关闭"
        >
          <X size={9} style={{ color: "var(--fg-muted)" }} />
        </button>

        <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
          <circle
            cx="26"
            cy="26"
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE - ((percent ?? 0) / 100) * CIRCUMFERENCE}
            style={{ transition: "stroke-dashoffset 0.35s var(--ease-out-expo)" }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          {ready ? (
            <Check size={18} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
          ) : percent !== null ? (
            <span className="text-[10px] font-semibold" style={{ color: "var(--fg)" }}>
              {percent}%
            </span>
          ) : (
            <Download size={16} style={{ color: "var(--accent)" }} />
          )}
        </div>
      </div>

      {ready && (
        <span
          className="text-xs font-medium status-fade"
          style={{ color: "var(--accent)" }}
        >
          点击安装
        </span>
      )}
    </div>
  )
}
