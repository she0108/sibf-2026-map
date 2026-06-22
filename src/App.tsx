import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePostHog } from '@posthog/react'
import rawData from './data/booths.json'
import type { BoothData } from './types'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import type { SidebarTab } from './components/Sidebar'
import MobileCourse from './components/MobileCourse'
import DataManager from './components/DataManager'
import {
  loadVisitedBooths,
  loadVisitOrder,
  loadRouteVisible,
  migratePhotosToIndexedDB,
  saveRouteVisible,
  saveVisitedBooths,
  saveVisitOrder,
} from './lib/storage'
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('search')
  const [boothQuery, setBoothQuery] = useState('')
  const [mobileCourseOpen, setMobileCourseOpen] = useState(false)
  const [mapResetKey, setMapResetKey] = useState(0)
  const [routeVisible, setRouteVisible] = useState(() => loadRouteVisible())
  const [visitOrder, setVisitOrder] = useState<string[]>(() => loadVisitOrder())
  const [visitedIds, setVisitedIds] = useState<string[]>(() => loadVisitedBooths())
  const visit = useMemo(() => new Set(visitOrder), [visitOrder])
  const visited = useMemo(() => new Set(visitedIds), [visitedIds])

  useEffect(() => {
    migratePhotosToIndexedDB()
  }, [])

  const toggleVisit = (id: string, source: BoothSaveSource) => {
    const has = visitOrder.includes(id)
    const next = has ? visitOrder.filter((visitId) => visitId !== id) : [...visitOrder, id]
    setVisitOrder(next)
    if (has) {
      setVisitedIds((current) => {
        const updated = current.filter((visitedId) => visitedId !== id)
        saveVisitedBooths(updated)
        return updated
      })
    }
    saveVisitOrder(next)
    captureEvent(posthog, 'booth_save_changed', {
      booth_id: id,
      action: has ? 'remove' : 'add',
      source,
      saved_count: next.length,
    })
  }

  const toggleVisited = (id: string, surface: RouteSurface) => {
    if (!visit.has(id)) return
    setVisitedIds((current) => {
      const has = current.includes(id)
      const next = has ? current.filter((visitedId) => visitedId !== id) : [...current, id]
      saveVisitedBooths(next)
      captureEvent(posthog, 'route_booth_visited_changed', {
        booth_id: id,
        visited: !has,
        surface,
        visited_count: next.length,
        saved_count: visitOrder.length,
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
    setHighlightedId(null)
    setSelectedId(id)
    setSidebarTab('search')
  }
  const highlightRouteBooth = (id: string, surface: RouteSurface) => {
    setSelectedId(null)
    const next = highlightedId === id ? null : id
    setHighlightedId(next)
    if (next) {
      captureEvent(posthog, 'route_booth_highlighted', {
        booth_id: id,
        surface,
        position: visitOrder.indexOf(id) + 1,
      })
    }
  }
  const openMobileCourse = useCallback(() => {
    setBoothQuery('')
    setSelectedId(null)
    setHighlightedId(null)
    setMapResetKey((key) => key + 1)
    setMobileCourseOpen(true)
    captureEvent(posthog, 'route_viewed', { surface: 'mobile', saved_count: visitOrder.length })
  }, [posthog, visitOrder.length])
  const closeMobileCourse = useCallback(() => {
    setMobileCourseOpen(false)
    setHighlightedId(null)
  }, [])
  const toggleRouteVisibility = (surface: RouteToggleSurface) => {
    setRouteVisible((visible) => {
      const next = !visible
      saveRouteVisible(next)
      captureEvent(posthog, 'route_map_visibility_changed', {
        visible: next,
        saved_count: visitOrder.length,
        surface,
      })
      return next
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
          if (tab !== 'route') setHighlightedId(null)
          if (tab === 'route' && sidebarTab !== 'route') {
            captureEvent(posthog, 'route_viewed', {
              surface: 'sidebar',
              saved_count: visitOrder.length,
            })
          }
        }}
        onQueryChange={setBoothQuery}
        onSelect={selectBooth}
        onHighlightRouteBooth={(id) => highlightRouteBooth(id, 'sidebar')}
        onClearSelect={() => setSelectedId(null)}
        onToggleVisit={toggleVisit}
        onReorderVisit={reorderVisit}
        routeVisible={routeVisible}
        onToggleRoute={() => toggleRouteVisibility('desktop_sidebar')}
        onDataImported={(order) => {
          setVisitOrder(order)
          setVisitedIds((current) => {
            const next = current.filter((id) => order.includes(id))
            saveVisitedBooths(next)
            return next
          })
          setSelectedId(null)
          setBoothQuery('')
        }}
      />
      <MapView
        booths={data.booths}
        viewBox={data.viewBox}
        selectedId={selectedId}
        hoveredId={hoveredId}
        highlightedId={highlightedId}
        visit={visit}
        visitOrder={visitOrder}
        visited={visited}
        resetViewKey={mapResetKey}
        showRoute={routeVisible}
        onSelect={selectBooth}
        onHover={setHoveredId}
      />
      <DataManager
        mobile
        boothIds={data.booths.map((booth) => booth.id)}
        onImported={(order) => {
          setVisitOrder(order)
          setVisitedIds((current) => {
            const next = current.filter((id) => order.includes(id))
            saveVisitedBooths(next)
            return next
          })
          setSelectedId(null)
          setBoothQuery('')
        }}
      />
      <MobileCourse
        booths={data.booths}
        order={visitOrder}
        open={mobileCourseOpen}
        routeVisible={routeVisible}
        visited={visited}
        onOpen={openMobileCourse}
        onClose={closeMobileCourse}
        onToggleRoute={() => toggleRouteVisibility('mobile_controls')}
        onToggleVisited={(id) => toggleVisited(id, 'mobile')}
        onSelect={(id) => highlightRouteBooth(id, 'mobile')}
        onReorder={reorderVisit}
      />
    </div>
  )
}
