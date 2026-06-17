import { useEffect, useState } from 'react'
import { usePostHog } from '@posthog/react'
import rawData from './data/booths.json'
import type { BoothData } from './types'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { loadVisit, migratePhotosToIndexedDB, saveVisit } from './lib/storage'

const data = rawData as unknown as BoothData

export default function App() {
  const posthog = usePostHog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [visit, setVisit] = useState<Set<string>>(() => loadVisit())

  useEffect(() => {
    migratePhotosToIndexedDB()
  }, [])

  const toggleVisit = (id: string) => {
    setVisit((prev) => {
      const next = new Set(prev)
      const adding = !next.has(id)
      if (adding) next.add(id)
      else next.delete(id)
      saveVisit(next)
      posthog.capture('visit_toggled', { booth_id: id, action: adding ? 'add' : 'remove' })
      return next
    })
  }

  const selected = data.booths.find((b) => b.id === selectedId) || null

  return (
    <div className="app">
      <Sidebar
        booths={data.booths}
        selected={selected}
        visit={visit}
        onSelect={setSelectedId}
        onClearSelect={() => setSelectedId(null)}
        onToggleVisit={toggleVisit}
      />
      <MapView
        booths={data.booths}
        viewBox={data.viewBox}
        selectedId={selectedId}
        hoveredId={hoveredId}
        visit={visit}
        onSelect={setSelectedId}
        onHover={setHoveredId}
      />
    </div>
  )
}
