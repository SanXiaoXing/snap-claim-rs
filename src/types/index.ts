export type InvoiceType = 'train' | 'hotel' | 'car' | 'flight' | 'invoice' | 'unknown'

export interface InvoiceRecord {
  type: InvoiceType
  amount: number | null
  qrAmount: boolean
  filename: string
  fullPath: string
  pageNumber: number
  // 高铁票字段
  trainNumber?: string
  departureStation?: string
  arrivalStation?: string
  departureTime?: string
  // 酒店字段
  hotelName?: string
  checkInDate?: string
  checkOutDate?: string
  nights?: number
  // 用车字段
  carDate?: string
  mileage?: number
  // 用车子分类：市内交通(false) / 往返交通(true)
  // ponytail: 默认 false 兼容旧记录；批量分类弹窗切换
  isRoundTrip?: boolean
  // 飞机字段
  flightNumber?: string
  departureCity?: string
  arrivalCity?: string
  flightDate?: string
  // 发票字段
  invoiceCode?: string
  invoiceNumber?: string
  issueDate?: string
}

export interface Totals {
  train: number
  flight: number
  hotel: number
  car: number
  // 往返交通合计（用车记录中 isRoundTrip=true 的部分）
  roundTrip?: number
  invoice: number
  subsidy: number
  advance: number
  refund: number
  total: number
  chinese: string
}

export interface PreviewRow {
  cells: (string | number)[]
  bold: boolean
}

export interface RecognitionResult {
  records: InvoiceRecord[]
  totals: Totals
  previewRows: PreviewRow[]
}

// 自动更新：来自 tauri-plugin-updater 的检查结果（与 Rust UpdateInfo 对齐）
export interface UpdateInfo {
  version: string
  notes: string
  pubDate?: string
}

// 版本历史（由 scripts/generate-version-history.js 从 RELEASE_NOTES.md 生成）
export interface VersionHistory {
  version: string
  changes: string[]
}