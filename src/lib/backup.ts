import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  loadAllMemoPhotos,
  loadAllMemos,
  loadVisitOrder,
  replaceStoredData,
} from './storage'

const FORMAT = 'sibf-2026-map-backup'
const VERSION = 1
const MANIFEST_PATH = 'data.json'

interface PhotoEntry {
  boothId: string
  path: string
  type: string
}

interface BackupManifest {
  format: typeof FORMAT
  version: typeof VERSION
  exportedAt: string
  visitOrder: string[]
  memos: Record<string, string>
  photos: PhotoEntry[]
}

export interface BackupSummary {
  savedBoothCount: number
  memoCount: number
  photoCount: number
}

export interface BackupImport {
  manifest: BackupManifest
  photos: Record<string, Blob[]>
  summary: BackupSummary
}

function extensionFor(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

function summaryOf(manifest: BackupManifest): BackupSummary {
  return {
    savedBoothCount: manifest.visitOrder.length,
    memoCount: Object.values(manifest.memos).filter((memo) => memo.trim()).length,
    photoCount: manifest.photos.length,
  }
}

export async function createBackupArchive(validBoothIds: Set<string>) {
  const visitOrder = loadVisitOrder().filter((id) => validBoothIds.has(id))
  const allMemos = loadAllMemos()
  const memos = Object.fromEntries(
    Object.entries(allMemos).filter(([id, memo]) => validBoothIds.has(id) && memo !== ''),
  )
  const allPhotos = await loadAllMemoPhotos()
  const files: Record<string, Uint8Array> = {}
  const photoEntries: PhotoEntry[] = []

  for (const [boothId, blobs] of Object.entries(allPhotos)) {
    if (!validBoothIds.has(boothId)) continue
    for (let index = 0; index < blobs.length; index++) {
      const blob = blobs[index]
      const path = `photos/${encodeURIComponent(boothId)}/${index + 1}.${extensionFor(blob.type)}`
      files[path] = new Uint8Array(await blob.arrayBuffer())
      photoEntries.push({ boothId, path, type: blob.type || 'image/jpeg' })
    }
  }

  const manifest: BackupManifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    visitOrder,
    memos,
    photos: photoEntries,
  }
  files[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2))
  const archive = zipSync(files, { level: 0 })
  return {
    blob: new Blob([archive.slice().buffer], { type: 'application/zip' }),
    summary: summaryOf(manifest),
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string'),
  )
}

function parseManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object') throw new Error('백업 정보가 올바르지 않습니다.')
  const manifest = value as Partial<BackupManifest>
  if (manifest.format !== FORMAT || manifest.version !== VERSION) {
    throw new Error('지원하지 않는 백업 파일입니다.')
  }
  if (!Array.isArray(manifest.visitOrder) || !manifest.visitOrder.every((id) => typeof id === 'string')) {
    throw new Error('관심 부스 데이터가 올바르지 않습니다.')
  }
  if (!isStringRecord(manifest.memos)) throw new Error('메모 데이터가 올바르지 않습니다.')
  if (
    !Array.isArray(manifest.photos) ||
    !manifest.photos.every(
      (photo) =>
        photo &&
        typeof photo.boothId === 'string' &&
        typeof photo.path === 'string' &&
        typeof photo.type === 'string',
    )
  ) {
    throw new Error('사진 데이터가 올바르지 않습니다.')
  }
  return manifest as BackupManifest
}

export async function readBackupArchive(file: File, validBoothIds: Set<string>): Promise<BackupImport> {
  if (file.size > 250 * 1024 * 1024) throw new Error('백업 파일은 250MB 이하만 가져올 수 있습니다.')
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('ZIP 파일을 열 수 없습니다.')
  }
  const manifestBytes = files[MANIFEST_PATH]
  if (!manifestBytes) throw new Error('백업 정보 파일이 없습니다.')

  let manifest: BackupManifest
  try {
    manifest = parseManifest(JSON.parse(strFromU8(manifestBytes)))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('백업 정보가 손상되었습니다.', { cause: error })
    }
    throw error
  }

  const visitOrder = manifest.visitOrder.filter((id) => validBoothIds.has(id))
  const memos = Object.fromEntries(
    Object.entries(manifest.memos).filter(([id]) => validBoothIds.has(id)),
  )
  const photos: Record<string, Blob[]> = {}
  const photoEntries: PhotoEntry[] = []
  for (const photo of manifest.photos) {
    if (!validBoothIds.has(photo.boothId)) continue
    if (!photo.type.startsWith('image/')) throw new Error('지원하지 않는 사진 형식이 포함되어 있습니다.')
    const bytes = files[photo.path]
    if (!bytes) throw new Error(`사진 파일이 누락되었습니다: ${photo.path}`)
    const blob = new Blob([bytes.slice().buffer], { type: photo.type })
    ;(photos[photo.boothId] ??= []).push(blob)
    photoEntries.push(photo)
  }

  const filteredManifest = { ...manifest, visitOrder, memos, photos: photoEntries }
  return { manifest: filteredManifest, photos, summary: summaryOf(filteredManifest) }
}

export async function restoreBackup(data: BackupImport) {
  await replaceStoredData(data.manifest.visitOrder, data.manifest.memos, data.photos)
  return data.manifest.visitOrder
}

export function backupFilename() {
  const date = new Date().toLocaleDateString('sv-SE')
  return `sibf-2026-map-backup-${date}.zip`
}
