"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"
import { zhCN } from "react-day-picker/locale"
import { X } from "lucide-react"

import { Calendar } from "./ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"

function toISO(d: Date | undefined): string {
  if (!d) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromISO(s: string): Date | undefined {
  if (!s) return undefined
  const d = new Date(s + "T00:00:00")
  return isNaN(d.getTime()) ? undefined : d
}

export function DateRangeModal({
  open,
  startDate,
  endDate,
  onConfirm,
  onCancel,
}: {
  open: boolean
  startDate: string
  endDate: string
  onConfirm: (start: string, end: string) => void
  onCancel: () => void
}) {
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const f = fromISO(startDate)
    const t = fromISO(endDate)
    return f && t ? { from: f, to: t } : f ? { from: f } : undefined
  })

  // ponytail: 每次打开同步外部值，避免上次未确认的选择残留
  React.useEffect(() => {
    if (!open) return
    const f = fromISO(startDate)
    const t = fromISO(endDate)
    setRange(f && t ? { from: f, to: t } : f ? { from: f } : undefined)
  }, [open, startDate, endDate])

  // Esc 关闭
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  const days =
    range?.from && range?.to
      ? Math.floor(
          (range.to.getTime() - range.from.getTime()) / 86400000,
        ) + 1
      : 0

  const handleConfirm = () => {
    onConfirm(toISO(range?.from), toISO(range?.to))
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* 背景遮罩：毛玻璃 + 半透明黑 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <Card className="relative w-[680px] max-w-[92vw] mac-card">
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] hover:text-[var(--fg)]"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <CardHeader className="relative border-b border-[var(--border)]">
          <CardTitle>选择出差日期</CardTitle>
          <CardDescription>在日历上拖选或点击起止日期</CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            defaultMonth={range?.from}
            numberOfMonths={2}
            locale={zhCN}
            className="bg-transparent p-0"
          />

          {/* 底部：日期摘要 + 天数 + 操作按钮 */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <div className="text-sm text-[var(--fg-muted)]">
              {range?.from ? toISO(range.from) : "开始日期"}
              <span className="mx-1">至</span>
              {range?.to ? toISO(range.to) : "结束日期"}
              {days > 0 && (
                <span className="ml-3 text-[var(--accent)] font-semibold">
                  共 {days} 天
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={onCancel}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={!range?.from || !range?.to}
              >
                确认
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
