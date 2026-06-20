import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePostHog } from '@posthog/react'
import rawData from './data/booths.json'
import type { BoothData } from './types'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import type { SidebarTab } from './components/Sidebar'
import MobileCourse from './components/MobileCourse'
import { loadVisitOrder, migratePhotosToIndexedDB, saveVisitOrder } from './lib/storage'
import { moveItem } from './lib/route'
import {
  captureEvent,
  type BoothSaveSource,
  type RouteSurface,
  type RouteToggleSurface,
} from './lib/analytics'

const data = rawData as unknown as BoothData

export default function App() {
  const posthog = usePostHog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('search')
  const [boothQuery, setBoothQuery] = useState('')
  const [mobileCourseOpen, setMobileCourseOpen] = useState(false)
  const [mapResetKey, setMapResetKey] = useState(0)
  const [routeVisible, setRouteVisible] = useState(false)
  const [visitOrder, setVisitOrder] = useState<string[]>(() => loadVisitOrder())
  const visit = useMemo(() => new Set(visitOrder), [visitOrder])

  useEffect(() => {
    migratePhotosToIndexedDB()
  }, [])

  const toggleVisit = (id: string, source: BoothSaveSource) => {
    setVisitOrder((prev) => {
      const has = prev.includes(id)
      const next = has ? prev.filter((x) => x !== id) : [...prev, id]
      saveVisitOrder(next)
      captureEvent(posthog, 'booth_save_changed', {
        booth_id: id,
        action: has ? 'remove' : 'add',
        source,
        saved_count: next.length,
      })
      return next
    })
  }

  const reorderVisit = (from: number, to: number, surface: RouteSurface) => {
    setVisitOrder((prev) => {
      const next = moveItem(prev, from, to)
      if (next === prev) return prev
      saveVisitOrder(next)
      captureEvent(posthog, 'route_reordered', {
        surface,
        saved_count: next.length,
        from_position: from + 1,
        to_position: to + 1,
      })
      return next
    })
  }

  const selected = data.booths.find((b) => b.id === selectedId) || null
  const selectBooth = (id: string) => {
    setBoothQuery('')
    setSelectedId(id)
    setSidebarTab('search')
  }
  const openMobileCourse = useCallback(() => {
    setBoothQuery('')
    setSelectedId(null)
    setMapResetKey((key) => key + 1)
    setMobileCourseOpen(true)
    captureEvent(posthog, 'route_viewed', { surface: 'mobile', saved_count: visitOrder.length })
  }, [posthog, visitOrder.length])
  const closeMobileCourse = useCallback(() => setMobileCourseOpen(false), [])
  const toggleRouteVisibility = (surface: RouteToggleSurface) => {
    setRouteVisible((visible) => {
      captureEvent(posthog, 'route_map_visibility_changed', {
        visible: !visible,
        saved_count: visitOrder.length,
        surface,
      })
      return !visible
    })
  }

  return (
    <div className={'app' + (mobileCourseOpen ? ' mobile-course-open' : '')}>
      <Sidebar
        booths={data.booths}
        selected={selected}
        visit={visit}
        visitOrder={visitOrder}
        tab={sidebarTab}
        query={boothQuery}
        onTabChange={(tab) => {
          setSidebarTab(tab)
          if (tab === 'route' && sidebarTab !== 'route') {
            captureEvent(posthog, 'route_viewed', {
              surface: 'sidebar',
              saved_count: visitOrder.length,
            })
          }
        }}
        onQueryChange={setBoothQuery}
        onSelect={selectBooth}
        onClearSelect={() => setSelectedId(null)}
        onToggleVisit={toggleVisit}
        onReorderVisit={reorderVisit}
        routeVisible={routeVisible}
        onToggleRoute={() => toggleRouteVisibility('desktop_sidebar')}
      />
      <MapView
        booths={data.booths}
        viewBox={data.viewBox}
        selectedId={selectedId}
        hoveredId={hoveredId}
        visit={visit}
        visitOrder={visitOrder}
        resetViewKey={mapResetKey}
        showRoute={routeVisible}
        onSelect={selectBooth}
        onHover={setHoveredId}
      />
      <MobileCourse
        booths={data.booths}
        order={visitOrder}
        open={mobileCourseOpen}
        routeVisible={routeVisible}
        onOpen={openMobileCourse}
        onClose={closeMobileCourse}
        onToggleRoute={() => toggleRouteVisibility('mobile_controls')}
        onSelect={(id) => {
          captureEvent(posthog, 'booth_viewed', {
            booth_id: id,
            source: 'route_mobile',
            position: visitOrder.indexOf(id) + 1,
          })
          selectBooth(id)
        }}
        onReorder={reorderVisit}
      />
    </div>
  )
}
