import { del as idbDel, get as idbGet, set as idbSet, keys as idbKeys } from 'idb-keyval'

const VISIT_KEY = 'sibf-visit'
const VISITED_KEY = 'sibf-visited'
const ROUTE_VISIBLE_KEY = 'sibf-route-visible'
const MEMO_PREFIX = 'sibf-memo:'
const memoKey = (id: string) => `${MEMO_PREFIX}${id}`
const PHOTO_PREFIX_OLD = 'sibf-memo-photo:'
const PHOTO_MIGRATED_FLAG = 'sibf-photo-migrated-v1'
const photoIdbKey = (id: string) => `photo:${id}`

export function loadVisitOrder(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISIT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveVisitOrder(order: string[]) {
  try {
    localStorage.setItem(VISIT_KEY, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}

export function loadVisitedBooths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveVisitedBooths(ids: string[]) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function loadRouteVisible(): boolean {
  try {
    return localStorage.getItem(ROUTE_VISIBLE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveRouteVisible(visible: boolean) {
  try {
    localStorage.setItem(ROUTE_VISIBLE_KEY, String(visible))
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

export function loadAllMemos(): Record<string, string> {
  const memos: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(MEMO_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (value !== null) memos[key.slice(MEMO_PREFIX.length)] = value
    }
  } catch {
    /* return what could be read */
  }
  return memos
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

export async function loadAllMemoPhotos(): Promise<Record<string, Blob[]>> {
  const photos: Record<string, Blob[]> = {}
  const keys = await idbKeys()
  for (const key of keys) {
    const value = String(key)
    if (!value.startsWith('photo:')) continue
    const blobs = await idbGet<Blob[]>(key)
    if (Array.isArray(blobs) && blobs.every((blob) => blob instanceof Blob)) {
      photos[value.slice('photo:'.length)] = blobs
    }
  }
  return photos
}

async function writeStoredData(
  visitOrder: string[],
  memos: Record<string, string>,
  photos: Record<string, Blob[]>,
) {
  const keys = await idbKeys()
  await Promise.all(
    keys
      .filter((key) => String(key).startsWith('photo:'))
      .map((key) => idbDel(key)),
  )
  await Promise.all(
    Object.entries(photos).map(([boothId, blobs]) => idbSet(photoIdbKey(boothId), blobs)),
  )

  const memoKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(MEMO_PREFIX)) memoKeys.push(key)
  }
  memoKeys.forEach((key) => localStorage.removeItem(key))
  Object.entries(memos).forEach(([boothId, memo]) => localStorage.setItem(memoKey(boothId), memo))
  localStorage.setItem(VISIT_KEY, JSON.stringify(visitOrder))
}

export async function replaceStoredData(
  visitOrder: string[],
  memos: Record<string, string>,
  photos: Record<string, Blob[]>,
) {
  const previous = {
    visitOrder: loadVisitOrder(),
    memos: loadAllMemos(),
    photos: await loadAllMemoPhotos(),
  }
  try {
    await writeStoredData(visitOrder, memos, photos)
  } catch (error) {
    try {
      await writeStoredData(previous.visitOrder, previous.memos, previous.photos)
    } catch {
      /* preserve the original import failure */
    }
    throw error
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
