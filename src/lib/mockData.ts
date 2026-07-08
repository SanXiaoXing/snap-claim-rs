import type { InvoiceRecord, Totals, PreviewRow } from '../types'

export const mockInvoiceRecords: InvoiceRecord[] = [
  {
    type: 'train',
    amount: 553.5,
    qrAmount: false,
    filename: 'G1234.pdf',
    fullPath: '/path/to/G1234.pdf',
    pageNumber: 1,
    trainNumber: 'G1234',
    departureStation: '北京南站',
    arrivalStation: '上海虹桥站',
    departureTime: '2025-01-15 08:30',
  },
  {
    type: 'train',
    amount: 553.5,
    qrAmount: false,
    filename: 'G1235.pdf',
    fullPath: '/path/to/G1235.pdf',
    pageNumber: 1,
    trainNumber: 'G1235',
    departureStation: '上海虹桥站',
    arrivalStation: '北京南站',
    departureTime: '2025-01-20 18:00',
  },
  {
    type: 'hotel',
    amount: 3261.0,
    qrAmount: true,
    filename: 'hotel_confirm.pdf',
    fullPath: '/path/to/hotel_confirm.pdf',
    pageNumber: 1,
    hotelName: '上海希尔顿酒店',
    checkInDate: '2025-01-15',
    checkOutDate: '2025-01-20',
    nights: 5,
  },
  {
    type: 'car',
    amount: 68.26,
    qrAmount: true,
    filename: 'car_confirm.pdf',
    fullPath: '/path/to/car_confirm.pdf',
    pageNumber: 1,
    carDate: '2025-01-15',
    mileage: 15.2,
  },
]

export const mockTotals: Totals = {
  train: 1107.0,
  flight: 0,
  hotel: 3261.0,
  car: 68.26,
  invoice: 0,
  subsidy: 500, // 5天 * 100
  advance: 3329.26, // car + flight + hotel
  refund: 1607.0, // train + subsidy
  total: 4936.26,
  chinese: '肆仟玖佰叁拾陆元贰角陆分',
}

export const mockPreviewRows: PreviewRow[] = [
  {
    cells: ['北京南站', '上海虹桥站', 553.5, '', '', '', '', '', 553.5],
    bold: false,
  },
  {
    cells: ['上海虹桥站', '北京南站', 553.5, '', '', '', '', '', 553.5],
    bold: false,
  },
  {
    cells: ['住宿', '', '', '', 3261.0, '', '', '', 3261.0],
    bold: false,
  },
  {
    cells: ['市内交通', '', '', '', '', 68.26, '', '', 68.26],
    bold: false,
  },
  {
    cells: ['出差补助', '', '', '', '', '', 100, 5, 500],
    bold: false,
  },
  {
    cells: ['合计', '', 1107.0, 0, 3261.0, 68.26, '', '', 4936.26],
    bold: true,
  },
]