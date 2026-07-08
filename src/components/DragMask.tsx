export function DragMask({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center drag-mask-backdrop"
      role="status"
      aria-live="polite"
    >
      <div className="drag-mask-frame absolute inset-4 rounded-xl border-2 border-dashed border-[var(--accent)]">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <svg
            className="drag-mask-icon h-14 w-14 text-[var(--accent)]"
            viewBox="0 0 448 512"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M256 109.3L256 320c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-210.7-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 109.3zM224 400c44.2 0 80-35.8 80-80l80 0c35.3 0 64 28.7 64 64l0 32c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64l0-32c0-35.3 28.7-64 64-64l80 0c0 44.2 35.8 80 80 80zm144 24a24 24 0 1 0 0-48 24 24 0 1 0 0 48z" />
          </svg>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--fg)]">释放文件以添加 PDF</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">仅支持 .pdf 格式</p>
          </div>
        </div>
      </div>
    </div>
  )
}
