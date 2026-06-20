import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import type { Booth } from '../types'
import { displayName } from '../types'
import type { RouteSurface } from '../lib/analytics'

interface Props {
  booths: Booth[]
  order: string[]
  showInstruction?: boolean
  surface: RouteSurface
  onSelect: (id: string) => void
  onReorder: (from: number, to: number, surface: RouteSurface) => void
}

export default function RouteList({
  booths,
  order,
  showInstruction = true,
  surface,
  onSelect,
  onReorder,
}: Props) {
  const byId = new Map(booths.map((b) => [b.id, b]))

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
        {showInstruction && (
          <div className="side__section-title">방문 순서 (핸들을 드래그해 이동)</div>
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
  onSelect,
}: {
  id: string
  index: number
  name: string
  onSelect: (id: string) => void
}) {
  const { ref, handleRef, isDragSource } = useSortable({ id, index })

  return (
    <li
      ref={ref}
      className={'result route-item' + (isDragSource ? ' dragging' : '')}
      onClick={() => onSelect(id)}
    >
      <span className="route-num">{index + 1}</span>
      <span className="result__name">{name}</span>
      <span className="result__meta">{id}</span>
      <span
        ref={handleRef}
        className="route-drag-handle"
        role="button"
        tabIndex={0}
        title="드래그하여 순서 변경"
        aria-label={`${name} 순서 변경`}
        onClick={(event) => event.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9H20" />
          <path d="M4 15H20" />
        </svg>
      </span>
    </li>
  )
}
