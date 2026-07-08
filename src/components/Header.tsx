import { useState } from 'react'

const themes = ['清爽办公风', '高对比效率风', '深色专业风', '柔和极简风', '企业可信风']

export function Header({
  currentTheme,
  onThemeChange,
  onMergePdf,
  onExportReport,
}: {
  currentTheme: string
  onThemeChange: (theme: string) => void
  onMergePdf: () => void
  onExportReport: () => void
}) {
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  return (
    <header className="h-12 bg-[var(--card)] border-b border-[var(--border)] flex items-center px-4">
      {/* Logo/标题 */}
      <div className="font-bold text-lg">发票报销单自动生成系统</div>

      {/* 菜单栏 */}
      <nav className="ml-8 flex gap-4">
        <button className="hover:bg-[var(--border)] px-3 py-1 rounded">文件</button>
        <button
          className="hover:bg-[var(--border)] px-3 py-1 rounded"
          onClick={() => setShowThemeMenu(!showThemeMenu)}
        >
          视图
          {showThemeMenu && (
            <div className="absolute top-10 left-0 bg-[var(--card)] border border-[var(--border)] rounded shadow-lg">
              {themes.map((theme) => (
                <button
                  key={theme}
                  className={`block w-full px-4 py-2 hover:bg-[var(--border)] ${theme === currentTheme ? 'bg-[var(--accent-light)]' : ''}`}
                  onClick={() => {
                    onThemeChange(theme)
                    setShowThemeMenu(false)
                  }}
                >
                  {theme}
                </button>
              ))}
            </div>
          )}
        </button>
        <button className="hover:bg-[var(--border)] px-3 py-1 rounded">帮助</button>
      </nav>

      {/* 右侧快捷按钮 */}
      <div className="ml-auto flex gap-2">
        <button
          className="px-3 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-light)]"
          onClick={onMergePdf}
        >
          合并 PDF
        </button>
        <button
          className="px-3 py-1 bg-[var(--success)] text-white rounded hover:opacity-80"
          onClick={onExportReport}
        >
          导出报销单
        </button>
      </div>
    </header>
  )
}