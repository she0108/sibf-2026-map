import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { usePostHog } from '@posthog/react'
import type { Booth } from '../types'
import { displayName } from '../types'
import { loadMemo, loadMemoPhotos, saveMemo, saveMemoPhotos } from '../lib/storage'

interface Props {
  booths: Booth[]
  selected: Booth | null
  visit: Set<string>
  onSelect: (id: string) => void
  onClearSelect: () => void
  onToggleVisit: (id: string) => void
}

interface Result {
  id: string
  label: string
  meta: string
}

const MAX_PHOTO_SIZE = 1280
const PHOTO_QUALITY = 0.82

export default function Sidebar({ booths, selected, visit, onSelect, onClearSelect, onToggleVisit }: Props) {
  const posthog = usePostHog()
  const [query, setQuery] = useState('')
  const hasQuery = Boolean(query.trim())
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: Result[] = []
    for (const b of booths) {
      for (const e of b.exhibitors) {
        const nm = displayName(e)
        if (!nm) continue
        if (nm.toLowerCase().includes(q) || e.en.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)) {
          out.push({ id: b.id, label: nm, meta: b.id })
          if (out.length >= 60) return out
        }
      }
    }
    return out
  }, [query, booths])

  const allBooths = useMemo<Result[]>(() => {
    return booths
      .map((b) => {
        const primary = displayName(b.exhibitors[0]) || b.id
        const extraCount = Math.max(b.exhibitors.length - 1, 0)
        return {
          id: b.id,
          label: extraCount > 0 ? `${primary} 외 ${extraCount}개` : primary,
          meta: b.id,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'))
  }, [booths])

  useEffect(() => {
    if (!hasQuery) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      posthog.capture('search_performed', { result_count: results.length })
    }, 800)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
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

  return (
    <aside className="side">
      <div className="side__head">
        <h1 className="side__title">2026 서울국제도서전 부스 배치도</h1>
      </div>

      {!selected && (
        <div className="side__search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="출판사명 / 부스번호 검색"
          />
          <svg className="side__search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="M15.5 15.5L20 20" />
          </svg>
        </div>
      )}

      {hasQuery && (
        <ul className="side__results">
          {results.length === 0 && <li className="side__empty">검색 결과 없음</li>}
          {results.map((r, i) => (
            <li key={r.id + i} className="result" onClick={() => selectBooth(r.id, 'search')}>
              <span className="result__name">{r.label}</span>
              <span className="result__meta">{r.meta}</span>
              <button
                className={'star' + (visit.has(r.id) ? ' on' : '')}
                title="가고 싶은 부스"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisit(r.id)
                }}
              >
                {visit.has(r.id) ? '★' : '☆'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && !hasQuery && (
        <SelectedBooth
          key={selected.id}
          selected={selected}
          visit={visit}
          onClearSelect={onClearSelect}
          onToggleVisit={onToggleVisit}
        />
      )}

      {!selected && !hasQuery && (
        <BoothList
          booths={allBooths}
          visit={visit}
          onSelect={(id) => selectBooth(id, 'list')}
          onToggleVisit={onToggleVisit}
        />
      )}
    </aside>
  )
}

function BoothList({
  booths,
  visit,
  onSelect,
  onToggleVisit,
}: {
  booths: Result[]
  visit: Set<string>
  onSelect: (id: string) => void
  onToggleVisit: (id: string) => void
}) {
  return (
    <div className="side__all">
      <div className="side__section-title">전체 부스</div>
      <ul className="side__results">
        {booths.map((b) => (
          <li key={b.id} className="result" onClick={() => onSelect(b.id)}>
            <span className="result__name">{b.label}</span>
            <span className="result__meta">{b.meta}</span>
            <button
              className={'star' + (visit.has(b.id) ? ' on' : '')}
              title="가고 싶은 부스"
              onClick={(e) => {
                e.stopPropagation()
                onToggleVisit(b.id)
              }}
            >
              {visit.has(b.id) ? '★' : '☆'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SelectedBooth({
  selected,
  visit,
  onClearSelect,
  onToggleVisit,
}: {
  selected: Booth
  visit: Set<string>
  onClearSelect: () => void
  onToggleVisit: (id: string) => void
}) {
  const posthog = usePostHog()
  const [memo, setMemo] = useState(() => loadMemo(selected.id))
  const [photos, setPhotos] = useState<Blob[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoError, setPhotoError] = useState('')
  const [listOpen, setListOpen] = useState(false)

  const urlCacheRef = useRef<Map<Blob, string>>(new Map())

  const commitPhotos = (blobs: Blob[]) => {
    const cache = urlCacheRef.current
    const next = new Map<Blob, string>()
    const urls: string[] = []
    for (const blob of blobs) {
      const url = cache.get(blob) ?? URL.createObjectURL(blob)
      next.set(blob, url)
      urls.push(url)
    }
    cache.forEach((url, blob) => {
      if (!next.has(blob)) URL.revokeObjectURL(url)
    })
    urlCacheRef.current = next
    setPhotos(blobs)
    setPhotoUrls(urls)
  }

  useEffect(() => {
    let cancelled = false
    loadMemoPhotos(selected.id).then((blobs) => {
      if (!cancelled) commitPhotos(blobs)
    })
    return () => {
      cancelled = true
    }
  }, [selected.id])

  useEffect(() => {
    return () => {
      const cache = urlCacheRef.current
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  const visited = visit.has(selected.id)
  const primary = displayName(selected.exhibitors[0]) || selected.id
  const extraCount = Math.max(selected.exhibitors.length - 1, 0)

  const memoRef = useRef<HTMLTextAreaElement>(null)
  const memoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const el = memoRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    const line = parseFloat(cs.lineHeight)
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const borderV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const min = line * 2 + padV + borderV
    const max = line * 7 + padV + borderV
    el.style.height = 'auto'
    const next = Math.min(max, Math.max(min, el.scrollHeight + borderV))
    el.style.height = next + 'px'
    el.style.overflowY = el.scrollHeight + borderV > max ? 'auto' : 'hidden'
  }, [memo])

  const onMemo = (v: string) => {
    setMemo(v)
    saveMemo(selected.id, v)
    if (memoTimerRef.current) clearTimeout(memoTimerRef.current)
    memoTimerRef.current = setTimeout(() => {
      posthog.capture('memo_saved', { booth_id: selected.id })
    }, 1500)
  }

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('이미지 파일만 첨부할 수 있어요.')
      posthog.capture('photo_error', { booth_id: selected.id, reason: 'invalid_type' })
      return
    }

    try {
      const added = await Promise.all(files.map((file) => resizeImage(file)))
      const next = [...photos, ...added]
      if (!(await saveMemoPhotos(selected.id, next))) {
        setPhotoError('저장 공간이 부족해요. 다른 부스의 사진을 정리해 주세요.')
        posthog.capture('photo_error', { booth_id: selected.id, reason: 'quota' })
        return
      }
      commitPhotos(next)
      posthog.capture('photo_added', { booth_id: selected.id, count: files.length, total: next.length })
      setPhotoError('')
    } catch {
      setPhotoError('사진을 불러오지 못했어요.')
      posthog.capture('photo_error', { booth_id: selected.id, reason: 'load_failed' })
    }
  }

  const onRemovePhoto = async (index: number) => {
    const next = photos.filter((_, i) => i !== index)
    await saveMemoPhotos(selected.id, next)
    commitPhotos(next)
    setPhotoError('')
    posthog.capture('photo_removed', { booth_id: selected.id, total: next.length })
  }

  return (
    <div className="detail">
      <div className="detail__summary">
        <div className="detail__top">
          <div className="detail__identity">
            <div className="detail__booth">{selected.id}</div>
            <button
              className={'detail__star' + (visited ? ' on' : '')}
              title={visited ? '가고 싶은 부스 해제' : '가고 싶은 부스로 표시'}
              aria-label={visited ? '가고 싶은 부스 해제' : '가고 싶은 부스로 표시'}
              onClick={() => onToggleVisit(selected.id)}
            >
              {visited ? '★' : '☆'}
            </button>
          </div>
          <button
            className="detail__clear"
            type="button"
            title="선택 취소"
            aria-label="선택 취소"
            onClick={() => {
              posthog.capture('booth_deselected', { booth_id: selected.id })
              onClearSelect()
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7L17 17" />
              <path d="M17 7L7 17" />
            </svg>
          </button>
        </div>
        <div className="detail__primary">
          <span>{primary}</span>
          {extraCount > 0 && (
            <>
              <span className="detail__count"> 외 {extraCount}개</span>
              <button
                type="button"
                className={'detail__expand' + (listOpen ? ' on' : '')}
                aria-expanded={listOpen}
                aria-label={listOpen ? '목록 접기' : '목록 펼치기'}
                onClick={() => setListOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9L12 15L18 9" />
                </svg>
              </button>
            </>
          )}
          <label className="memo-photo__add detail__photo-add">
            사진 첨부
            <input type="file" accept="image/*" multiple onChange={onPhoto} />
          </label>
        </div>
      </div>

      {listOpen && (
        <ul className="detail__list">
          {selected.exhibitors.map((e, i) => (
            <li key={i}>
              <span className="detail__ko">{e.ko || e.en}</span>
              {e.ko && e.en && <span className="detail__en">{e.en}</span>}
              {e.country && <span className="detail__country">{e.country}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="memo">
        <div className="memo-photo">
          {photoError && <div className="memo-photo__error">{photoError}</div>}
          {photoUrls.length > 0 && (
            <div className="memo-photo__scroll">
              {photoUrls.map((src, i) => (
                <div className="memo-photo__item" key={i}>
                  <img src={src} alt={`${selected.id} 메모 사진 ${i + 1}`} />
                  <button
                    type="button"
                    className="memo-photo__remove"
                    title="사진 삭제"
                    aria-label="사진 삭제"
                    onClick={() => onRemovePhoto(i)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7L17 17" />
                      <path d="M17 7L7 17" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={memoRef}
          value={memo}
          onChange={(e) => onMemo(e.target.value)}
          placeholder="이 부스에 대한 메모를 남겨보세요."
        />
      </div>
    </div>
  )
}

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image-failed'))
      img.onload = () => {
        const ratio = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * ratio))
        const height = Math.max(1, Math.round(img.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas-failed'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('blob-failed'))
          },
          'image/jpeg',
          PHOTO_QUALITY,
        )
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}
