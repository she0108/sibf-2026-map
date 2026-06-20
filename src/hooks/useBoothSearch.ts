import { useEffect, useMemo, useRef } from 'react'
import { usePostHog } from '@posthog/react'
import type { Booth } from '../types'
import { buildBoothList, searchBooths } from '../lib/booths'
import { captureEvent, type BoothViewSource } from '../lib/analytics'

const RESULT_LIMIT = 60
const TRACK_DEBOUNCE_MS = 800

export function useBoothSearch(
  booths: Booth[],
  query: string,
  setQuery: (query: string) => void,
  onSelect: (id: string) => void,
) {
  const posthog = usePostHog()
  const hasQuery = Boolean(query.trim())
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const results = useMemo(() => searchBooths(booths, query, RESULT_LIMIT), [booths, query])
  const allBooths = useMemo(() => buildBoothList(booths), [booths])

  useEffect(() => {
    if (!hasQuery) return
    if (trackTimerRef.current) clearTimeout(trackTimerRef.current)
    trackTimerRef.current = setTimeout(() => {
      captureEvent(posthog, 'booth_search_completed', {
        query_length: query.trim().length,
        result_count: results.length,
        has_results: results.length > 0,
      })
      trackTimerRef.current = null
    }, TRACK_DEBOUNCE_MS)
    return () => {
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current)
    }
  }, [query, results.length, hasQuery, posthog])

  const selectBooth = (id: string, source: BoothViewSource, sourcePosition?: number) => {
    const list = source === 'search_results' ? results : allBooths
    const listPosition = list.findIndex((booth) => booth.id === id) + 1
    const position = sourcePosition ?? listPosition
    if (source === 'search_results' && trackTimerRef.current) {
      clearTimeout(trackTimerRef.current)
      trackTimerRef.current = null
      captureEvent(posthog, 'booth_search_completed', {
        query_length: query.trim().length,
        result_count: results.length,
        has_results: results.length > 0,
      })
    }
    captureEvent(posthog, 'booth_viewed', {
      booth_id: id,
      source,
      ...(position > 0 ? { position } : {}),
      ...(source === 'search_results' ? { result_count: results.length } : {}),
    })
    setQuery('')
    onSelect(id)
  }

  return { query, setQuery, hasQuery, results, allBooths, selectBooth }
}
