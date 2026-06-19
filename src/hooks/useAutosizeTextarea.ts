import { useLayoutEffect, useRef } from 'react'

export function useAutosizeTextarea(value: string, minLines: number, maxLines: number) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const line = parseFloat(cs.lineHeight)
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const borderV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const min = line * minLines + padV + borderV
    const max = line * maxLines + padV + borderV
    el.style.height = 'auto'
    const next = Math.min(max, Math.max(min, el.scrollHeight + borderV))
    el.style.height = next + 'px'
    el.style.overflowY = el.scrollHeight + borderV > max ? 'auto' : 'hidden'
  }, [value, minLines, maxLines])
  return ref
}
