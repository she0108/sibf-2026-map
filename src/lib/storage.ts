const VISIT_KEY = 'sibf-visit'
const memoKey = (id: string) => `sibf-memo:${id}`
const memoPhotoKey = (id: string) => `sibf-memo-photo:${id}`

export function loadVisit(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISIT_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function saveVisit(s: Set<string>) {
  try {
    localStorage.setItem(VISIT_KEY, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

export function loadMemo(id: string): string {
  try {
    return localStorage.getItem(memoKey(id)) || ''
  } catch {
    return ''
  }
}

export function saveMemo(id: string, value: string) {
  try {
    localStorage.setItem(memoKey(id), value)
  } catch {
    /* ignore */
  }
}

export function loadMemoPhotos(id: string): string[] {
  try {
    const raw = localStorage.getItem(memoPhotoKey(id))
    if (!raw) return []
    // Backward compat: older versions stored a single data URL string.
    if (raw.startsWith('data:')) return [raw]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveMemoPhotos(id: string, photos: string[]) {
  try {
    if (photos.length === 0) {
      localStorage.removeItem(memoPhotoKey(id))
    } else {
      localStorage.setItem(memoPhotoKey(id), JSON.stringify(photos))
    }
  } catch {
    /* ignore */
  }
}
