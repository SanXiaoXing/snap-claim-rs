// ponytail: 仅 buttonVariants（供 calendar classNames 使用），不引入完整 button 组件
// 颜色映射到现有 CSS 变量，避免 shadcn token 依赖
export type ButtonVariant = "default" | "outline" | "ghost" | "secondary"

export function buttonVariants({
  variant = "default",
}: {
  variant?: ButtonVariant
} = {}) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"

  const variants: Record<ButtonVariant, string> = {
    default: "bg-[var(--accent)] text-white hover:bg-[var(--accent-light)]",
    outline:
      "border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_80%,transparent)] text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
    ghost:
      "text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
    secondary: "bg-[var(--border)] text-[var(--fg)] hover:bg-[var(--accent)]",
  }

  return `${base} ${variants[variant]}`
}
