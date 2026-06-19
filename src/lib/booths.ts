import type { Booth } from '../types'
import { displayName } from '../types'

export interface BoothResult {
  id: string
  label: string
  meta: string
}

export function searchBooths(booths: Booth[], query: string, limit: number): BoothResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: BoothResult[] = []
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
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

export function buildBoothList(booths: Booth[]): BoothResult[] {
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
}
