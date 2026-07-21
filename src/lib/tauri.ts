import { invoke, Channel } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import type { InvoiceRecord, RecognitionResult, PreviewRow, UpdateInfo } from '../types'

// ── 文件选择 ──

// 支持的图片扩展名（与 validate.ts SUPPORTED_EXTS 对齐，docs/LOCAL_OCR_SPEC.md §13.1）
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp']
const IMAGE_EXTS_SET = new Set(IMAGE_EXTS)

export function isImagePath(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS_SET.has(ext)
}

export function isPdfPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf')
}

// 选择文件（PDF + 图片），对话框两个 filter 分组让用户按类型筛选
export async function pickFiles(): Promise<string[]> {
  const sel = await openDialog({
    multiple: true,
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: '图片', extensions: IMAGE_EXTS },
    ],
  })
  return Array.isArray(sel) ? sel : sel ? [sel] : []
}

// 读取图片字节为 Uint8Array，调用方用 new File([bytes], name, {type}) 构造 File 对象。
// ponytail: 不引入 tauri-plugin-fs，单命令够用。Tauri 把 Vec<u8> 序列化为 number[]，
// 再用 Uint8Array.from 转回字节——对 10MB 以内图片开销可接受。
export async function readImageBytes(path: string): Promise<Uint8Array> {
  try {
    const bytes = await invoke<number[]>('read_image_bytes', { path })
    return Uint8Array.from(bytes)
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}

// 扩展名 → MIME（构造 File 对象时用）
export function mimeFromExt(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'bmp': return 'image/bmp'
    default: return 'application/octet-stream'
  }
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

// ── 从文本识别单据（图片 OCR 文本走此命令复用 Rust 业务解析）──

// ponytail: 图片 OCR 得到文本后调用 Rust recognize_from_text，复用 detect_invoice_type/extract_fields。
// Tauri 自动把 Rust snake_case 参数名转成 camelCase：full_path → fullPath, page_number → pageNumber。
// imageHint：订单号 + 末行金额（前端从 App 订单列表截图预抽，参考 docs/LOCAL_OCR_SPEC.md §19）。
export async function recognizeFromText(
  text: string,
  filename: string,
  fullPath: string,
  pageNumber: number,
  imageHint: { orderType: string; orderId: string; amount: number | null } | null = null,
): Promise<InvoiceRecord> {
  try {
    return await invoke<InvoiceRecord>('recognize_from_text', {
      text,
      filename,
      fullPath,
      pageNumber,
      imageHint,
    })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
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

// 下载更新包，通过 Channel 接收进度；下载完成后暂存到后端，需再调用 installDownloadedUpdate 安装。
export async function downloadUpdate(
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
    await invoke<void>('download_update', { onEvent: channel })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}

// 安装已下载的更新包并重启应用。
export async function installDownloadedUpdate(): Promise<void> {
  try {
    await invoke<void>('install_update')
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
}