import type { UpdateInfo } from "../types";

interface UpdateDialogProps {
  update: UpdateInfo
  onInstall: () => void
  onLater: () => void
  // 下载进度，null/undefined 表示未开始下载
  progress?: { downloaded: number; total: number | null } | null
}

export function UpdateDialog({ update, onInstall, onLater, progress }: UpdateDialogProps) {
  const percent =
    progress && progress.total !== null && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative mac-card p-8 max-w-md w-full mx-6">
        <h2 className="text-xl font-semibold text-center mb-2" style={{ color: "var(--fg)" }}>
          发现新版本 {update.version}
        </h2>
        <div className="text-sm whitespace-pre-line opacity-80 mb-6" style={{ color: "var(--fg)" }}>
          {update.notes}
        </div>
        {percent !== null && (
          <div className="mb-4">
            <div className="text-xs text-center mb-1" style={{ color: "var(--fg-muted)" }}>
              下载中 {percent}%
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "var(--fg-muted)" }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onLater}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ color: "var(--fg-muted)" }}
          >
            稍后
          </button>
          <button
            onClick={onInstall}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            立即更新
          </button>
        </div>
      </div>
    </div>
  )
}
