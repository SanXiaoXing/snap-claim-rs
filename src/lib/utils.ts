import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// ponytail: 仅此一处 className 合并工具，供 ui/* 组件使用
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
