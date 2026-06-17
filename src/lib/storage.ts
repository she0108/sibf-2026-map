import { del as idbDel, get as idbGet, set as idbSet, keys as idbKeys } from 'idb-keyval'

const VISIT_KEY = 'sibf-visit'
const memoKey = (id: string) => `sibf-memo:${id}`
const PHOTO_PREFIX_OLD = 'sibf-memo-photo:'
const PHOTO_MIGRATED_FLAG = 'sibf-photo-migrated-v1'
const photoIdbKey = (id: string) => `photo:${id}`

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

export async function loadMemoPhotos(id: string): Promise<Blob[]> {
  try {
    const blobs = await idbGet<Blob[]>(photoIdbKey(id))
    return Array.isArray(blobs) ? blobs.filter((b) => b instanceof Blob) : []
  } catch {
    return []
  }
}

export async function saveMemoPhotos(id: string, blobs: Blob[]): Promise<boolean> {
  try {
    if (blobs.length === 0) {
      await idbDel(photoIdbKey(id))
    } else {
      await idbSet(photoIdbKey(id), blobs)
    }
    return true
  } catch {
    return false
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3] || ''
  try {
    if (isBase64) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }
    return new Blob([decodeURIComponent(payload)], { type: mime })
  } catch {
    return null
  }
}

export async function migratePhotosToIndexedDB(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(PHOTO_MIGRATED_FLAG) === '1') return

  const oldKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PHOTO_PREFIX_OLD)) oldKeys.push(k)
  }

  let existingIdbKeys: IDBValidKey[] = []
  try {
    existingIdbKeys = await idbKeys()
  } catch {
    /* ignore */
  }
  const existing = new Set(existingIdbKeys.map(String))

  for (const k of oldKeys) {
    const id = k.slice(PHOTO_PREFIX_OLD.length)
    const idbKey = photoIdbKey(id)
    if (existing.has(idbKey)) {
      localStorage.removeItem(k)
      continue
    }
    const raw = localStorage.getItem(k)
    if (!raw) {
      localStorage.removeItem(k)
      continue
    }
    let urls: string[] = []
    if (raw.startsWith('data:')) {
      urls = [raw]
    } else {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) urls = parsed.filter((v) => typeof v === 'string')
      } catch {
        /* ignore */
      }
    }
    const blobs = urls.map(dataUrlToBlob).filter((b): b is Blob => b !== null)
    if (blobs.length > 0) {
      try {
        await idbSet(idbKey, blobs)
        localStorage.removeItem(k)
      } catch {
        /* leave the localStorage entry; migration will retry next load */
        return
      }
    } else {
      localStorage.removeItem(k)
    }
  }

  try {
    localStorage.setItem(PHOTO_MIGRATED_FLAG, '1')
  } catch {
    /* ignore */
  }
}
