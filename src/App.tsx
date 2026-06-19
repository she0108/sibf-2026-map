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

  const toggleVisit = (id: string) => {
    setVisitOrder((prev) => {
      const has = prev.includes(id)
      const next = has ? prev.filter((x) => x !== id) : [...prev, id]
      saveVisitOrder(next)
      posthog.capture('visit_toggled', { booth_id: id, action: has ? 'remove' : 'add' })
      return next
    })
  }

  const reorderVisit = (from: number, to: number) => {
    setVisitOrder((prev) => {
      const next = moveItem(prev, from, to)
      if (next === prev) return prev
      saveVisitOrder(next)
      posthog.capture('route_reordered', { method: 'drag' })
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
  }, [])
  const closeMobileCourse = useCallback(() => setMobileCourseOpen(false), [])

  return (
    <div className={'app' + (mobileCourseOpen ? ' mobile-course-open' : '')}>
      <Sidebar
        booths={data.booths}
        selected={selected}
        visit={visit}
        visitOrder={visitOrder}
        tab={sidebarTab}
        query={boothQuery}
        onTabChange={setSidebarTab}
        onQueryChange={setBoothQuery}
        onSelect={selectBooth}
        onClearSelect={() => setSelectedId(null)}
        onToggleVisit={toggleVisit}
        onReorderVisit={reorderVisit}
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
        onToggleRoute={() => {
          setRouteVisible((visible) => {
            posthog.capture('route_visibility_toggled', { visible: !visible })
            return !visible
          })
        }}
        onSelect={(id) => {
          posthog.capture('booth_selected', { booth_id: id, source: 'mobile_course' })
          selectBooth(id)
        }}
        onReorder={reorderVisit}
      />
    </div>
  )
}
