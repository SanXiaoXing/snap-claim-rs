import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import type { InvoiceRecord, RecognitionResult, PreviewRow } from '../types'

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