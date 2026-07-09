import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/* ============================================================
   GSAP 动画 hooks（MOTION_INTENSITY: 5，每个带功能动机）
   规范遵循 gsap-react 技能：useGSAP + scope + contextSafe + matchMedia
   ============================================================ */

/**
 * 挂载入场时间线：子元素错峰上浮 + 淡入（动机：层级 - 建立视觉顺序）
 * 用 back.out(1.4) 微过冲，比纯 CSS 更有"就位感"。
 *
 * @param scope 容器 ref，子元素选择器在此范围内查询
 * @param selector 子元素选择器（如 '.card-enter-target'）
 * @param staggerEach 每项间隔秒数
 */
export function useGsapMount(
  scope: React.RefObject<HTMLElement | null>,
  selector: string,
  staggerEach = 0.08,
) {
  useGSAP(
    () => {
      gsap.from(selector, {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: 'back.out(1.4)',
        stagger: { each: staggerEach, from: 'start' },
      })
    },
    { scope },
  )
}

/**
 * 磁吸按钮：光标靠近时按钮轻微跟随，离开回弹（动机：反馈 - 触觉化高级感）
 * 用 quickTo 避免每帧创建新 tween，性能友好。
 * 必须用 contextSafe 包裹事件回调，防止卸载后残留。
 *
 * @param target 按钮 ref
 * @param strength 磁吸强度 0-1，0.25 为克制档
 */
export function useGsapMagnetic(
  target: React.RefObject<HTMLElement | null>,
  strength = 0.25,
) {
  const xTo = useRef<gsap.QuickToFunc | null>(null)
  const yTo = useRef<gsap.QuickToFunc | null>(null)

  useGSAP(
    (_context, contextSafe) => {
      const el = target.current
      if (!el) return

      // reduced-motion 直接跳过磁吸，保持静态
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        xTo.current = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
        yTo.current = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })

        const onMove = contextSafe!((e: MouseEvent) => {
          const rect = el.getBoundingClientRect()
          const relX = e.clientX - (rect.left + rect.width / 2)
          const relY = e.clientY - (rect.top + rect.height / 2)
          xTo.current?.(relX * strength)
          yTo.current?.(relY * strength)
        })

        const onLeave = contextSafe!(() => {
          xTo.current?.(0)
          yTo.current?.(0)
        })

        el.addEventListener('mousemove', onMove)
        el.addEventListener('mouseleave', onLeave)
        return () => {
          el.removeEventListener('mousemove', onMove)
          el.removeEventListener('mouseleave', onLeave)
        }
      })
    },
    { scope: target },
  )
}

/**
 * 数值滚动：从旧值平滑过渡到新值（动机：反馈 - 数值就绪确认）
 * 用代理对象 + onUpdate 写 textContent，避免 setState 每帧重渲染。
 *
 * @param target 显示数值的元素 ref
 * @param value 当前数值
 * @param decimals 小数位
 */
export function useGsapCountUp(
  target: React.RefObject<HTMLElement | null>,
  value: number,
  decimals = 2,
) {
  const proxy = useRef({ v: value })

  useGSAP(
    () => {
      const el = target.current
      if (!el) return
      const obj = proxy.current
      const tween = gsap.to(obj, {
        v: value,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = obj.v.toFixed(decimals)
        },
      })
      return () => {
        tween.kill()
      }
    },
    { dependencies: [value], scope: target },
  )
}

/**
 * 表格行 stagger 入场：新增记录时逐行淡入（动机：层级 - 引导阅读顺序）
 * 用 dependencies 监听行数变化，仅对新行触发。
 *
 * @param scope 表格 tbody ref
 * @param selector 行选择器
 * @param rowCount 当前行数（依赖触发）
 */
export function useGsapRowStagger(
  scope: React.RefObject<HTMLElement | null>,
  selector: string,
  rowCount: number,
) {
  useGSAP(
    () => {
      // ponytail: 修复 gsap.from() 导致的 opacity 累积死亡问题
      // 增量识别多次重跑时，每次 gsap.from() 都会重新从 0 动画到当前 opacity，
      // 如果前一轮还没到 1 就被 kill，opacity 会越来越低最终接近 0。
      // 使用 fromTo 强制终点为 opacity: 1，彻底解决问题。
      gsap.fromTo(selector,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.04 }
      )
    },
    { dependencies: [rowCount], scope },
  )
}
