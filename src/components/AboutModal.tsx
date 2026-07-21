import { useEffect, useRef, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-shell'
import { gsap } from 'gsap'
import VERSION_HISTORY from '../version-history.json'

// ponytail: Tauri shell plugin 的 open() API 打开外部链接
const openExternal = (url: string) => {
  open(url).catch((err: unknown) => console.error('打开链接失败:', err))
}

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [version, setVersion] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (open && contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.4)' }
      )
    }
  }, [open])

  // ponytail: 版本取自 tauri.conf.json（与 Cargo.toml 保持一致），用原生 API 避免硬编码漂移
  useEffect(() => {
    if (!version) getVersion().then(setVersion).catch(() => setVersion(''))
  }, [version])

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
          <button
            onClick={() => openExternal('https://github.com/SanXiaoXing')}
            className="text-sm opacity-60 mt-1 transition-all duration-200 hover:opacity-100 hover:underline cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            by SanXiaoXing
          </button>
        </div>

        {/* 版本居中 + 仓库链接 */}
        <div className="text-sm mb-2 text-center">
          <button
            onClick={() => openExternal('https://github.com/SanXiaoXing/snap-claim-rs')}
            className="transition-all duration-200 hover:underline cursor-pointer"
            style={{ color: 'var(--fg-muted)' }}
          >
            Version {version || '...'}
          </button>
        </div>

        {/* 版本历史链接 */}
        <div className="text-center mb-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs opacity-60 hover:opacity-100 transition-all duration-200 hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {showHistory ? '隐藏版本历史' : '查看版本历史'}
          </button>
        </div>

        {/* 版本历史展开区域 */}
        {showHistory && (
          <div className="mb-5 max-h-48 overflow-y-auto text-xs leading-relaxed px-2" style={{ color: 'var(--fg-muted)' }}>
            {VERSION_HISTORY.slice(0, 3).map((v, idx) => (
              <div key={v.version} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium" style={{ color: 'var(--fg)' }}>v{v.version}</span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}>
                      当前
                    </span>
                  )}
                  {idx > 0 && (
                    <button
                      onClick={() => openExternal(`https://github.com/SanXiaoXing/snap-claim-rs/releases/download/v${v.version}/SnapClaim_${v.version}_x64-setup.exe`)}
                      className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ color: 'var(--accent)' }}
                    >
                      下载
                    </button>
                  )}
                </div>
                <ul className="ml-3 space-y-0.5">
                  {v.changes.map((change, i) => (
                    <li key={i} className="opacity-70">- {change}</li>
                  ))}
                </ul>
              </div>
            ))}
            {VERSION_HISTORY.length > 3 && (
              <div className="mt-3 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => openExternal('https://github.com/SanXiaoXing/snap-claim-rs/releases')}
                  className="opacity-60 hover:opacity-100 transition-opacity text-xs cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  查看更多版本 →
                </button>
              </div>
            )}
          </div>
        )}

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