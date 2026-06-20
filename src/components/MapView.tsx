import { useEffect, useMemo, useRef, useState } from 'react'
import { usePostHog } from '@posthog/react'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from 'd3-zoom'
import type { Booth } from '../types'
import { displayName } from '../types'
import { captureEvent } from '../lib/analytics'
import {
  ARROW,
  BOOTH_COLORS,
  BOOTH_FILL,
  FACILITY_FILL,
  FAVORITE,
  FAVORITE_FILL,
  HIGHLIGHT,
  HIGHLIGHT_FILL,
  INK,
  isDark,
  MORE_MUTED,
  NAME_MUTED,
  ON_DARK,
  TOILET_FILL,
  TOILET_STROKE,
  TOILET_TEXT,
  WHITE,
} from '../lib/colors'
import {
  ARROWS,
  DIRECTION_LABELS,
  HALL_BORDER_PATH,
  HALL_LABELS,
  TOILETS,
  type ArrowSpec,
} from '../data/mapAnnotations'

const FONT = "'Noto Sans KR','Pretendard',system-ui,sans-serif"

const MIN_CANVAS = { w: 3440, h: 3650 }

type ZoomFilterEvent = Event & {
  touches?: TouchList
  button?: number
  ctrlKey?: boolean
}

interface Props {
  booths: Booth[]
  viewBox: { w: number; h: number }
  selectedId: string | null
  hoveredId: string | null
  visit: Set<string>
  visitOrder: string[]
  resetViewKey: number
  showRoute: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export default function MapView({
  booths,
  viewBox,
  selectedId,
  hoveredId,
  visit,
  visitOrder,
  resetViewKey,
  showRoute,
  onSelect,
  onHover,
}: Props) {
  const posthog = usePostHog()
  const handleSelect = (id: string) => {
    captureEvent(posthog, 'booth_viewed', { booth_id: id, source: 'map' })
    onSelect(id)
  }

  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [t, setT] = useState<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 })
  const canvas = {
    w: Math.max(viewBox.w, MIN_CANVAS.w),
    h: Math.max(viewBox.h, MIN_CANVAS.h),
  }

  const routeCenters = useMemo(() => {
    const byId = new Map(booths.map((b) => [b.id, b]))
    return visitOrder
      .map((id) => {
        const b = byId.get(id)
        return b ? { cx: b.x + b.w / 2, cy: b.y + b.h / 2 } : null
      })
      .filter((c): c is { cx: number; cy: number } => c !== null)
  }, [booths, visitOrder])

  useEffect(() => {
    const sel = select(svgRef.current as SVGSVGElement)
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 14])
      .filter((event: ZoomFilterEvent) => {
        if (event.type && String(event.type).startsWith('touch')) {
          return Boolean(event.touches && event.touches.length >= 1)
        }
        if (event.type === 'wheel') return true
        return !event.ctrlKey && !event.button
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => setT(event.transform))
    sel.call(z)
    sel.on('dblclick.zoom', null)
    zoomRef.current = z
    return () => {
      sel.on('.zoom', null)
    }
  }, [])

  const flyTo = (target: ZoomTransform) => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, target)
  }

  useEffect(() => {
    if (!selectedId) return
    const b = booths.find((x) => x.id === selectedId)
    if (!b) return
    const k = 4
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const tx = canvas.w / 2 - k * cx
    const ty = canvas.h / 2 - k * cy
    flyTo(zoomIdentity.translate(tx, ty).scale(k))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    if (resetViewKey === 0) return
    flyTo(zoomIdentity)
  }, [resetViewKey])

  const reset = () => {
    captureEvent(posthog, 'map_control_used', { control: 'reset' })
    flyTo(zoomIdentity)
  }

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return
    captureEvent(posthog, 'map_control_used', {
      control: factor > 1 ? 'zoom_in' : 'zoom_out',
    })
    select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, factor)
  }

  return (
    <div className="map">
      <div className="map__ctl">
        <button onClick={() => zoomBy(1.5)} aria-label="확대" title="확대">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5V19" />
            <path d="M5 12H19" />
          </svg>
        </button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="축소" title="축소">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12H19" />
          </svg>
        </button>
        <button onClick={reset} aria-label="전체 보기" title="전체 보기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4H9" />
            <path d="M15 4H20V9" />
            <path d="M20 15V20H15" />
            <path d="M9 20H4V15" />
          </svg>
        </button>
      </div>
      <svg
        ref={svgRef}
        className="map__svg"
        viewBox={`0 0 ${canvas.w} ${canvas.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          <MapAnnotations />
          {booths.map((b) => (
            <BoothShape
              key={b.id}
              b={b}
              selected={b.id === selectedId}
              hovered={b.id === hoveredId}
              visit={visit.has(b.id)}
              onSelect={handleSelect}
              onHover={onHover}
            />
          ))}
          {showRoute && <RouteOverlay centers={routeCenters} />}
          <FacilityMarkers />
        </g>
      </svg>
    </div>
  )
}

function MapAnnotations() {
  return (
    <g pointerEvents="none" fontFamily={FONT}>
      <path d={HALL_BORDER_PATH} fill={INK} />
      {HALL_LABELS.map((hall) => (
        <text key={hall.label} x={hall.x} y={hall.y} fill={INK} fontFamily={FONT} fontSize={76} fontWeight={800}>
          {hall.label}
        </text>
      ))}
      {ARROWS.map((a, i) => (
        <Arrow key={i} {...a} />
      ))}
    </g>
  )
}

function RouteOverlay({ centers }: { centers: { cx: number; cy: number }[] }) {
  if (centers.length < 2) return null
  const head = 32
  const spread = 0.5
  return (
    <g
      pointerEvents="none"
      fill="none"
      stroke={FAVORITE}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {centers.slice(1).map((c, i) => {
        const p = centers[i]
        const dx = c.cx - p.cx
        const dy = c.cy - p.cy
        const dist = Math.hypot(dx, dy)
        if (dist === 0) return null
        const ux = dx / dist
        const uy = dy / dist
        const gap = 60
        // skip if booths are too close to leave room for a line + arrowhead
        if (dist <= gap * 2 + head) return null
        const sx = p.cx + ux * gap
        const sy = p.cy + uy * gap
        const ex = c.cx - ux * gap
        const ey = c.cy - uy * gap
        const angle = Math.atan2(dy, dx)
        const a1 = angle + Math.PI - spread
        const a2 = angle + Math.PI + spread
        const chevron =
          `M${ex + head * Math.cos(a1)} ${ey + head * Math.sin(a1)}` +
          ` L${ex} ${ey}` +
          ` L${ex + head * Math.cos(a2)} ${ey + head * Math.sin(a2)}`
        return (
          <g key={i}>
            <line x1={sx} y1={sy} x2={ex} y2={ey} />
            <path d={chevron} />
          </g>
        )
      })}
    </g>
  )
}

function Arrow({ x1, y1, x2, y2, double }: ArrowSpec) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 32
  const spread = 0.5
  const chevron = (px: number, py: number, dir: number) => {
    const a1 = dir + Math.PI - spread
    const a2 = dir + Math.PI + spread
    return (
      `M${px + head * Math.cos(a1)} ${py + head * Math.sin(a1)}` +
      ` L${px} ${py}` +
      ` L${px + head * Math.cos(a2)} ${py + head * Math.sin(a2)}`
    )
  }
  return (
    <g fill="none" stroke={ARROW} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path d={chevron(x2, y2, angle)} />
      {double && <path d={chevron(x1, y1, angle + Math.PI)} />}
    </g>
  )
}

function FacilityMarkers() {
  return (
    <g pointerEvents="none" fontFamily={FONT}>
      {TOILETS.map((toilet, index) => (
        <ToiletIcon key={index} {...toilet} />
      ))}
      {DIRECTION_LABELS.map((label) => (
        <DirectionLabel key={label.subtitle} {...label} />
      ))}
    </g>
  )
}

function ToiletIcon({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={51} height={51} fill={TOILET_FILL} stroke={TOILET_STROKE} strokeWidth={2} />
      <text
        x={x + 25.5}
        y={y + 26}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT}
        fontSize={22}
        fontWeight={800}
        fill={TOILET_TEXT}
      >
        WC
      </text>
    </g>
  )
}

function DirectionLabel({
  x,
  y,
  title,
  subtitle,
}: {
  x: number
  y: number
  title: string
  subtitle: string
}) {
  return (
    <text textAnchor="middle" fill={INK} fontSize={23} fontWeight={800}>
      <tspan x={x} y={y}>
        {title}
      </tspan>
      <tspan x={x} y={y + 28} fontSize={18} fontWeight={700}>
        {subtitle}
      </tspan>
    </text>
  )
}

interface ShapeProps {
  b: Booth
  selected: boolean
  hovered: boolean
  visit: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function BoothShape({ b, selected, hovered, visit, onSelect, onHover }: ShapeProps) {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const allNames = b.exhibitors.map(displayName).filter(Boolean)
  const shown = b.facility ? allNames.slice(0, 1) : allNames.slice(0, 12)
  const more = b.facility ? 0 : allNames.length - shown.length
  const lineCount = Math.max(shown.length + (more > 0 ? 1 : 0), 1)

  const codeFs = 14
  const codeLineH = codeFs * 1.25
  const maxLen = Math.max(...shown.map((n) => n.length), more > 0 ? 5 : 1)
  const availH = b.h * 0.9 - codeLineH
  const fsByH = availH > 0 ? availH / lineCount : codeFs
  const fsByW = (b.w * 0.92) / maxLen
  const nameFs = Math.max(3.5, Math.min(fsByH, fsByW, 20))
  const lineH = nameFs * 1.14
  const totalH = codeLineH + lineCount * lineH
  const top = cy - totalH / 2

  const mapped = b.color ? BOOTH_COLORS[b.color] : undefined
  const baseFill = mapped || (b.facility ? FACILITY_FILL : BOOTH_FILL)
  const dark = isDark(baseFill)
  const nameColor = dark ? WHITE : INK
  const codeColor = dark ? ON_DARK : NAME_MUTED
  const moreColor = dark ? ON_DARK : MORE_MUTED

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(b.id)}
      onMouseEnter={() => onHover(b.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={baseFill} stroke={WHITE} strokeWidth={1} />
      {visit && (
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill={FAVORITE_FILL}
          stroke={FAVORITE}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      {(selected || hovered) && (
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill={selected ? HIGHLIGHT_FILL : 'none'}
          stroke={HIGHLIGHT}
          strokeWidth={selected ? 3 : 2}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      <text textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} pointerEvents="none">
        <tspan x={cx} y={top + codeLineH / 2} fill={codeColor} fontSize={codeFs} fontWeight={400}>
          {b.id}
        </tspan>
        {shown.map((nm, i) => (
          <tspan
            key={i}
            x={cx}
            y={top + codeLineH + (i + 0.5) * lineH}
            fill={nameColor}
            fontSize={nameFs}
            fontWeight={600}
          >
            {nm}
          </tspan>
        ))}
        {more > 0 && (
          <tspan x={cx} y={top + codeLineH + (shown.length + 0.5) * lineH} fill={moreColor} fontSize={nameFs}>
            외 {more}곳
          </tspan>
        )}
      </text>
    </g>
  )
}
