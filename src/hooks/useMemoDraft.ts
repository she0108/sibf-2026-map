import { useEffect, useRef, useState } from 'react'
import { usePostHog } from '@posthog/react'
import { loadMemo, saveMemo } from '../lib/storage'

export function useMemoDraft(boothId: string) {
  const posthog = usePostHog()
  const [memo, setMemo] = useState(() => loadMemo(boothId))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onMemoChange = (v: string) => {
    setMemo(v)
    saveMemo(boothId, v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      posthog.capture('memo_saved', { booth_id: boothId })
    }, 1500)
  }

  return { memo, onMemoChange }
}
