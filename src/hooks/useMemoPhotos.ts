import { useCallback, useEffect, useRef, useState } from 'react'
import { loadMemoPhotos } from '../lib/storage'
import { revokeAllObjectUrls, syncObjectUrlCache } from '../lib/photo'

export function useMemoPhotos(boothId: string) {
  const [photos, setPhotosState] = useState<Blob[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const cacheRef = useRef<Map<Blob, string>>(new Map())

  const commitPhotos = useCallback((blobs: Blob[]) => {
    setPhotosState(blobs)
    setPhotoUrls(syncObjectUrlCache(cacheRef.current, blobs))
  }, [])

  useEffect(() => {
    let cancelled = false
    loadMemoPhotos(boothId).then((blobs) => {
      if (!cancelled) commitPhotos(blobs)
    })
    return () => {
      cancelled = true
    }
  }, [boothId, commitPhotos])

  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      revokeAllObjectUrls(cache)
    }
  }, [])

  return { photos, photoUrls, commitPhotos }
}
