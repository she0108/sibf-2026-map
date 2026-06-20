import { useEffect, useRef, useState } from 'react'
import { usePostHog } from '@posthog/react'
import { loadMemo, saveMemo } from '../lib/storage'
import { captureEvent } from '../lib/analytics'

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
      captureEvent(posthog, 'booth_memo_saved', {
        booth_id: boothId,
        memo_length: v.trim().length,
        has_content: Boolean(v.trim()),
      })
    }, 1500)
  }

  return { memo, onMemoChange }
}
