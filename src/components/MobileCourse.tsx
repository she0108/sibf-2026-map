import { useCallback, useEffect, useRef } from 'react'
import type { Booth } from '../types'
import RouteList from './RouteList'

interface Props {
  booths: Booth[]
  order: string[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (id: string) => void
  onReorder: (from: number, to: number) => void
}

export default function MobileCourse({
  booths,
  order,
  open,
  onOpen,
  onClose,
  onSelect,
  onReorder,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

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
      <button
        ref={triggerRef}
        type="button"
        className="mobile-course-trigger"
        aria-expanded={open}
        aria-controls="mobile-course-sheet"
        onClick={onOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="7" r="1.5" />
          <circle cx="5" cy="17" r="1.5" />
          <path d="M9 7H19" />
          <path d="M9 17H19" />
        </svg>
        <span>동선</span>
        <span className="mobile-course-trigger__count">{order.length}</span>
      </button>

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
                <span>드래그하여 순서 바꾸기</span>
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
              onSelect={(id) => {
                onClose()
                onSelect(id)
              }}
              onReorder={onReorder}
            />
          </section>
        </div>
      )}
    </>
  )
}
