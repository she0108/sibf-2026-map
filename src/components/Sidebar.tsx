import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
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
  const [query, setQuery] = useState('')
  const hasQuery = Boolean(query.trim())

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: Result[] = []
    for (const b of booths) {
      for (const e of b.exhibitors) {
        const nm = displayName(e)
        if (!nm) continue
        if (
          nm.toLowerCase().includes(q) ||
          e.en.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q)
        ) {
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

  const selectBooth = (id: string) => {
    setQuery('')
    onSelect(id)
  }

  return (
    <aside className="side">
      <div className="side__head">
        <h1 className="side__title">2026 서울국제도서전 부스배치도</h1>
      </div>

      <div className="side__search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="출판사명 / 부스번호 검색"
        />
      </div>

      {hasQuery && (
        <ul className="side__results">
          {results.length === 0 && <li className="side__empty">검색 결과 없음</li>}
          {results.map((r, i) => (
            <li key={r.id + i} className="result" onClick={() => selectBooth(r.id)}>
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
          onSelect={selectBooth}
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
  const [memo, setMemo] = useState(() => loadMemo(selected.id))
  const [photos, setPhotos] = useState(() => loadMemoPhotos(selected.id))
  const [photoError, setPhotoError] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const visited = visit.has(selected.id)
  const primary = displayName(selected.exhibitors[0]) || selected.id
  const extraCount = Math.max(selected.exhibitors.length - 1, 0)

  const onMemo = (v: string) => {
    setMemo(v)
    saveMemo(selected.id, v)
  }

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('이미지 파일만 첨부할 수 있어요.')
      return
    }

    try {
      const added = await Promise.all(files.map((file) => resizeImage(file)))
      setPhotos((prev) => {
        const next = [...prev, ...added]
        saveMemoPhotos(selected.id, next)
        return next
      })
      setPhotoError('')
    } catch {
      setPhotoError('사진을 불러오지 못했어요.')
    }
  }

  const onRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index)
      saveMemoPhotos(selected.id, next)
      return next
    })
    setPhotoError('')
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
          <button className="detail__clear" type="button" title="선택 취소" aria-label="선택 취소" onClick={onClearSelect}>
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
        <div className="memo__label">메모</div>
        <textarea
          value={memo}
          onChange={(e) => onMemo(e.target.value)}
          placeholder="이 부스에 대한 메모를 남겨보세요."
        />
        <div className="memo-photo">
          <div className="memo-photo__head">
            <div className="memo__label">사진</div>
            <label className="memo-photo__add">
              사진 첨부
              <input type="file" accept="image/*" multiple onChange={onPhoto} />
            </label>
          </div>
          {photoError && <div className="memo-photo__error">{photoError}</div>}
          {photos.length > 0 && (
            <div className="memo-photo__scroll">
              {photos.map((src, i) => (
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
      </div>
    </div>
  )
}

function resizeImage(file: File): Promise<string> {
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
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY))
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}
