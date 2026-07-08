import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { RecognitionResult } from '../types'

// ── 文件选择 ──

export async function pickPdfs(): Promise<string[]> {
  const sel = await openDialog({
    multiple: true,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  return Array.isArray(sel) ? sel : sel ? [sel] : []
}

// ── 识别 ──

export async function recognizeInvoices(
  filePaths: string[],
  days: number,
  onProgress?: (cur: number, total: number) => void,
  onQrCode?: (items: { page: number; urls: string[]; filename: string }[]) => void
): Promise<RecognitionResult> {
  let unlistenProgress: UnlistenFn | undefined
  let unlistenQr: UnlistenFn | undefined

  if (onProgress) {
    unlistenProgress = await listen<{ current: number; total: number }>(
      'recognition://progress',
      (e) => onProgress(e.payload.current, e.payload.total)
    )
  }
  if (onQrCode) {
    unlistenQr = await listen<{ page: number; urls: string[]; filename: string }[]>(
      'recognition://qrcode',
      (e) => onQrCode(e.payload)
    )
  }
  try {
    return await invoke<RecognitionResult>('recognize_invoices', { filePaths, days })
  } catch (e) {
    const msg = typeof e === 'string' ? e : JSON.stringify(e)
    throw new Error(msg)
  } finally {
    unlistenProgress?.()
    unlistenQr?.()
  }
}