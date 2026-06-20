import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { usePostHog } from '@posthog/react'
import type { Booth } from '../types'
import { displayName } from '../types'
import { saveMemoPhotos } from '../lib/storage'
import { resizeImage } from '../lib/photo'
import { type BoothResult } from '../lib/booths'
import { useMemoPhotos } from '../hooks/useMemoPhotos'
import { useMemoDraft } from '../hooks/useMemoDraft'
import { useAutosizeTextarea } from '../hooks/useAutosizeTextarea'
import { useBoothSearch } from '../hooks/useBoothSearch'
import RouteList from './RouteList'
import { captureEvent, type BoothSaveSource, type RouteSurface } from '../lib/analytics'

export type SidebarTab = 'search' | 'route'

interface Props {
  booths: Booth[]
  selected: Booth | null
  visit: Set<string>
  visitOrder: string[]
  tab: SidebarTab
  query: string
  onTabChange: (tab: SidebarTab) => void
  onQueryChange: (query: string) => void
  onSelect: (id: string) => void
  onClearSelect: () => void
  onToggleVisit: (id: string, source: BoothSaveSource) => void
  onReorderVisit: (from: number, to: number, surface: RouteSurface) => void
}

export default function Sidebar({
  booths,
  selected,
  visit,
  visitOrder,
  tab,
  query,
  onTabChange,
  onQueryChange,
  onSelect,
  onClearSelect,
  onToggleVisit,
  onReorderVisit,
}: Props) {
  const { hasQuery, results, allBooths, selectBooth } = useBoothSearch(
    booths,
    query,
    onQueryChange,
    onSelect,
  )
  return (
    <aside className="side">
      <div className="side__head">
        <h1 className="side__title">2026 서울국제도서전 부스 배치도</h1>
      </div>

      <div className="side__tabs" role="tablist" aria-label="사이드바 메뉴">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'search'}
          className={'side__tab' + (tab === 'search' ? ' on' : '')}
          onClick={() => onTabChange('search')}
        >
          부스
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'route'}
          className={'side__tab' + (tab === 'route' ? ' on' : '')}
          onClick={() => onTabChange('route')}
        >
          동선 <span className="side__tab-count">{visitOrder.length}</span>
        </button>
      </div>

      {tab === 'search' ? (
        <>
          {!selected && (
            <div className="side__search">
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
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
                <li
                  key={r.id + i}
                  className="result"
                  onClick={() => selectBooth(r.id, 'search_results')}
                >
                  <span className="result__name">{r.label}</span>
                  <span className="result__meta">{r.meta}</span>
                  <button
                    className={'star' + (visit.has(r.id) ? ' on' : '')}
                    title="가고 싶은 부스"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVisit(r.id, 'search_results')
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
            <div className="side__all">
              <BoothList
                booths={allBooths}
                visit={visit}
                onSelect={(id) => selectBooth(id, 'booth_list')}
                onToggleVisit={onToggleVisit}
              />
            </div>
          )}
        </>
      ) : (
        <div className="side__all">
          <RouteList
            booths={booths}
            order={visitOrder}
            surface="sidebar"
            onSelect={(id) => selectBooth(id, 'route_sidebar', visitOrder.indexOf(id) + 1)}
            onReorder={onReorderVisit}
          />
        </div>
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
  booths: BoothResult[]
  visit: Set<string>
  onSelect: (id: string) => void
  onToggleVisit: (id: string, source: BoothSaveSource) => void
}) {
  return (
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
              onToggleVisit(b.id, 'booth_list')
            }}
          >
            {visit.has(b.id) ? '★' : '☆'}
          </button>
        </li>
      ))}
    </ul>
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
  onToggleVisit: (id: string, source: BoothSaveSource) => void
}) {
  const posthog = usePostHog()
  const { memo, onMemoChange } = useMemoDraft(selected.id)
  const { photos, photoUrls, commitPhotos } = useMemoPhotos(selected.id)
  const [photoError, setPhotoError] = useState('')
  const [listOpen, setListOpen] = useState(false)

  const visited = visit.has(selected.id)
  const primary = displayName(selected.exhibitors[0]) || selected.id
  const extraCount = Math.max(selected.exhibitors.length - 1, 0)

  const memoRef = useAutosizeTextarea(memo, 2, 7)

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('이미지 파일만 첨부할 수 있어요.')
      captureEvent(posthog, 'booth_photo_failed', { booth_id: selected.id, reason: 'invalid_type' })
      return
    }

    try {
      const added = await Promise.all(files.map((file) => resizeImage(file)))
      const next = [...photos, ...added]
      if (!(await saveMemoPhotos(selected.id, next))) {
        setPhotoError('저장 공간이 부족해요. 다른 부스의 사진을 정리해 주세요.')
        captureEvent(posthog, 'booth_photo_failed', { booth_id: selected.id, reason: 'quota' })
        return
      }
      commitPhotos(next)
      captureEvent(posthog, 'booth_photo_changed', {
        booth_id: selected.id,
        action: 'add',
        photo_count: next.length,
        changed_count: files.length,
      })
      setPhotoError('')
    } catch {
      setPhotoError('사진을 불러오지 못했어요.')
      captureEvent(posthog, 'booth_photo_failed', { booth_id: selected.id, reason: 'load_failed' })
    }
  }

  const onRemovePhoto = async (index: number) => {
    const next = photos.filter((_, i) => i !== index)
    if (!(await saveMemoPhotos(selected.id, next))) {
      setPhotoError('저장 공간에서 사진을 삭제하지 못했어요.')
      captureEvent(posthog, 'booth_photo_failed', {
        booth_id: selected.id,
        reason: 'storage_failure',
      })
      return
    }
    commitPhotos(next)
    setPhotoError('')
    captureEvent(posthog, 'booth_photo_changed', {
      booth_id: selected.id,
      action: 'remove',
      photo_count: next.length,
      changed_count: 1,
    })
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
              onClick={() => onToggleVisit(selected.id, 'booth_detail')}
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
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="이 부스에 대한 메모를 남겨보세요."
        />
      </div>
    </div>
  )
}
