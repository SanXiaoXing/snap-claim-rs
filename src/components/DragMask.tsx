export function DragMask({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-[var(--accent)] bg-opacity-10 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] rounded-lg p-8 border-2 border-[var(--accent)]">
        <div className="text-center">
          {/* 上传图标 SVG */}
          <svg
            className="w-16 h-16 mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 16V4m0 0L8 8m4-4l4 4M4 17l.9 2.8c.1.4.4.7.8.7h14.3c.4 0 .7-.3.8-.7L20 17" />
          </svg>
          <p className="text-lg font-bold">释放文件以添加 PDF</p>
          <p className="text-sm opacity-70 mt-1">仅支持 .pdf 格式</p>
        </div>
      </div>
    </div>
  )
}