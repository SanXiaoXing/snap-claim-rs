import { invoke, Channel } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import type { InvoiceRecord, RecognitionResult, PreviewRow, UpdateInfo } from '../types'

// ── 文件选择 ──

export async function pickPdfs(): Promise<string[]> {
  const sel = await openDialog({
    multiple: true,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  return Array.isArray(sel) ? sel : sel ? [sel] : []
}

// ── 合并 PDF ──

// ponytail: 原生 save 对话框取输出路径，合并/导出共用，default 已含 allow-save
export async function pickSavePath(defaultPath: string, ext: string): Promise<string | null> {
  const sel = await saveDialog({
    defaultPath,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  })
  return sel ?? null
}

export async function mergePdfs(filePaths: string[], outputPath: string): Promise<void> {
  try {
    await invoke<void>('merge_pdfs', { filePaths, outputPath })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}

// ── 导出 Excel ──

export async function exportExcel(previewRows: PreviewRow[], outputPath: string): Promise<void> {
  try {
    await invoke<void>('export_excel', { previewRows, outputPath })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}

// ── 识别 ──

export async function recognizeInvoices(
  filePaths: string[],
  days: number,
  existingRecords: InvoiceRecord[],
  onProgress?: (cur: number, total: number) => void,
  onRecord?: (record: InvoiceRecord) => void
): Promise<RecognitionResult> {
  let unlistenProgress: UnlistenFn | undefined
  let unlistenRecord: UnlistenFn | undefined

  if (onProgress) {
    unlistenProgress = await listen<{ current: number; total: number }>(
      'recognition://progress',
      (e) => onProgress(e.payload.current, e.payload.total)
    )
  }
  if (onRecord) {
    unlistenRecord = await listen<InvoiceRecord>(
      'recognition://record',
      (e) => onRecord(e.payload)
    )
  }
  try {
    return await invoke<RecognitionResult>('recognize_invoices', { filePaths, days, existingRecords })
  } catch (e) {
    const msg = typeof e === 'string' ? e : JSON.stringify(e)
    throw new Error(msg)
  } finally {
    unlistenProgress?.()
    unlistenRecord?.()
  }
}

// ── 自动更新 ──

// 检查新版本，返回 null 表示已是最新
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    return await invoke<UpdateInfo | null>('check_for_update')
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}

// 下载进度事件（与 Rust DownloadProgressEvent 对齐）
export interface DownloadProgressEvent {
  event: 'Started' | 'Progress' | 'Finished'
  data?: { contentLength?: number; chunkLength?: number }
}

// 下载并安装更新，通过 Channel 接收进度，安装完成后应用自动重启
export async function installUpdate(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  const channel = new Channel<DownloadProgressEvent>()
  let downloaded = 0
  let total: number | null = null

  channel.onmessage = (event: DownloadProgressEvent) => {
    switch (event.event) {
      case 'Started':
        total = event.data?.contentLength ?? null
        onProgress?.(0, total)
        break
      case 'Progress':
        downloaded += event.data?.chunkLength ?? 0
        onProgress?.(downloaded, total)
        break
      case 'Finished':
        onProgress?.(downloaded, total ?? downloaded)
        break
    }
  }

  try {
    await invoke<void>('install_update', { onEvent: channel })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}