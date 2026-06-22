import { useCallback, useEffect, useRef } from 'react'
import type { Booth } from '../types'
import type { RouteSurface } from '../lib/analytics'
import RouteList from './RouteList'

interface Props {
  booths: Booth[]
  order: string[]
  open: boolean
  routeVisible: boolean
  visited: Set<string>
  onOpen: () => void
  onClose: () => void
  onToggleRoute: () => void
  onToggleVisited: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (from: number, to: number, surface: RouteSurface) => void
}

export default function MobileCourse({
  booths,
  order,
  open,
  routeVisible,
  visited,
  onOpen,
  onClose,
  onToggleRoute,
  onToggleVisited,
  onSelect,
  onReorder,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const remainingCount = order.filter((id) => !visited.has(id)).length

  const close = useCallback(() => {
    onClose()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [onClose])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  return (
    <>
      <div className="mobile-course-controls">
        <button
          ref={triggerRef}
          type="button"
          className="mobile-course-trigger"
          aria-expanded={open}
          aria-controls="mobile-course-sheet"
          onClick={onOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="17" r="2" />
            <circle cx="12" cy="7" r="2" />
            <circle cx="19" cy="17" r="2" />
            <path d="M6.5 15.5L10.5 8.5" />
            <path d="M13.5 8.5L17.5 15.5" />
          </svg>
          {order.length > 0 ? (
            <>
              내 동선 <span className="mobile-course-trigger__count">{remainingCount}</span>
            </>
          ) : (
            '동선 짜기'
          )}
        </button>
      </div>

      {open && (
        <div className="mobile-course-layer">
          <button
            type="button"
            className="mobile-course-backdrop"
            aria-label="동선 닫기"
            onClick={close}
          />
          <section
            id="mobile-course-sheet"
            className="mobile-course-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-course-title"
          >
            <header className="mobile-course-sheet__header">
              <div className="mobile-course-sheet__heading">
                <h2 id="mobile-course-title">내 동선</h2>
                <span>{remainingCount}/{order.length}</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="mobile-course-sheet__close"
                aria-label="동선 닫기"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7L17 17" />
                  <path d="M17 7L7 17" />
                </svg>
              </button>
            </header>
            <RouteList
              booths={booths}
              order={order}
              showInstruction={false}
              surface="mobile"
              routeVisible={routeVisible}
              visited={visited}
              onToggleRoute={onToggleRoute}
              onToggleVisited={onToggleVisited}
              onSelect={onSelect}
              onReorder={onReorder}
            />
          </section>
        </div>
      )}
    </>
  )
}
