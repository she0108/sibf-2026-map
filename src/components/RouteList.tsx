import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import type { Booth } from '../types'
import { displayName } from '../types'
import type { RouteSurface } from '../lib/analytics'

const EMPTY_VISITED = new Set<string>()

interface Props {
  booths: Booth[]
  order: string[]
  showInstruction?: boolean
  surface: RouteSurface
  routeVisible?: boolean
  visited?: Set<string>
  onToggleRoute?: () => void
  onToggleVisited?: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (from: number, to: number, surface: RouteSurface) => void
}

export default function RouteList({
  booths,
  order,
  showInstruction = true,
  surface,
  routeVisible = false,
  visited = EMPTY_VISITED,
  onToggleRoute,
  onToggleVisited,
  onSelect,
  onReorder,
}: Props) {
  const byId = new Map(booths.map((b) => [b.id, b]))
  const showChecklist = Boolean(onToggleVisited)

  if (order.length === 0) {
    return <div className="side__empty">★로 표시한 부스가 동선에 추가됩니다.</div>
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return
        const { source } = event.operation
        if (isSortable(source) && source.initialIndex !== source.index) {
          onReorder(source.initialIndex, source.index, surface)
        }
      }}
    >
      <div className="route-list">
        {surface === 'mobile' && (
          <div className="route-list__toolbar">
            <div className="side__section-title">꾹 눌러 드래그하여 순서 변경</div>
            {onToggleRoute && (
              <button
                type="button"
                className={'route-map-check' + (routeVisible ? ' on' : '')}
                role="checkbox"
                aria-checked={routeVisible}
                onClick={onToggleRoute}
              >
                <span className="route-map-check__box" aria-hidden="true">
                  {routeVisible && (
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12L10 17L19 7" />
                    </svg>
                  )}
                </span>
                <span>지도에 동선 표시</span>
              </button>
            )}
          </div>
        )}
        {showInstruction && (
          <div className="route-list__secondary">
            <div className="side__section-title">드래그하여 순서 바꾸기</div>
            {onToggleRoute && (
              <button
                type="button"
                className={'route-map-check' + (routeVisible ? ' on' : '')}
                role="checkbox"
                aria-checked={routeVisible}
                onClick={onToggleRoute}
              >
                <span className="route-map-check__box" aria-hidden="true">
                  {routeVisible && (
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12L10 17L19 7" />
                    </svg>
                  )}
                </span>
                <span>지도에 동선 표시</span>
              </button>
            )}
          </div>
        )}
        <ul className="side__results">
          {order.map((id, index) => {
            const booth = byId.get(id)
            const name = booth ? displayName(booth.exhibitors[0]) || id : id
            return (
              <SortableRouteItem
                key={id}
                id={id}
                index={index}
                name={name}
                showChecklist={showChecklist}
                visited={visited.has(id)}
                onToggleVisited={onToggleVisited}
                onSelect={onSelect}
              />
            )
          })}
        </ul>
      </div>
    </DragDropProvider>
  )
}

function SortableRouteItem({
  id,
  index,
  name,
  showChecklist,
  visited,
  onToggleVisited,
  onSelect,
}: {
  id: string
  index: number
  name: string
  showChecklist: boolean
  visited: boolean
  onToggleVisited?: (id: string) => void
  onSelect: (id: string) => void
}) {
  const { ref, isDragSource } = useSortable({ id, index })

  return (
    <li
      ref={ref}
      className={
        'result route-item' +
        (isDragSource ? ' dragging' : '') +
        (visited ? ' visited' : '')
      }
      onClick={() => onSelect(id)}
    >
      <span className="route-num">{index + 1}</span>
      <span className="result__name">{name}</span>
      <span className="result__meta">{id}</span>
      {showChecklist && (
        <button
          type="button"
          className={'route-check' + (visited ? ' on' : '')}
          aria-label={`${name} ${visited ? '방문 완료 취소' : '방문 완료'}`}
          aria-pressed={visited}
          onClick={(event) => {
            event.stopPropagation()
            onToggleVisited?.(id)
          }}
        >
          {visited && (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12L10 17L19 7" />
            </svg>
          )}
        </button>
      )}
    </li>
  )
}
