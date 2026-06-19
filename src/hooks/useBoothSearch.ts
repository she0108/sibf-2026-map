import { useEffect, useMemo, useRef, useState } from 'react'
import { usePostHog } from '@posthog/react'
import type { Booth } from '../types'
import { buildBoothList, searchBooths } from '../lib/booths'

const RESULT_LIMIT = 60
const TRACK_DEBOUNCE_MS = 800

export function useBoothSearch(booths: Booth[], selected: Booth | null, onSelect: (id: string) => void) {
  const posthog = usePostHog()
  const [query, setQuery] = useState('')
  const hasQuery = Boolean(query.trim())
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const results = useMemo(() => searchBooths(booths, query, RESULT_LIMIT), [booths, query])
  const allBooths = useMemo(() => buildBoothList(booths), [booths])

  useEffect(() => {
    if (!hasQuery) return
    if (trackTimerRef.current) clearTimeout(trackTimerRef.current)
    trackTimerRef.current = setTimeout(() => {
      posthog.capture('search_performed', { result_count: results.length })
    }, TRACK_DEBOUNCE_MS)
    return () => {
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current)
    }
  }, [query, results.length, hasQuery, posthog])

  useEffect(() => {
    if (selected) setQuery('')
  }, [selected])

  const selectBooth = (id: string, source: 'search' | 'list') => {
    posthog.capture('booth_selected', { booth_id: id, source })
    setQuery('')
    onSelect(id)
  }

  return { query, setQuery, hasQuery, results, allBooths, selectBooth }
}
