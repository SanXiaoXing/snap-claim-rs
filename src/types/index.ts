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