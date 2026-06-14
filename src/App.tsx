import { useState } from 'react'
import rawData from './data/booths.json'
import type { BoothData } from './types'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { loadVisit, saveVisit } from './lib/storage'

const data = rawData as unknown as BoothData

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [visit, setVisit] = useState<Set<string>>(() => loadVisit())

  const toggleVisit = (id: string) => {
    setVisit((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveVisit(next)
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
