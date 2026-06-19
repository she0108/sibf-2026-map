const MAX_PHOTO_SIZE = 1280
const PHOTO_QUALITY = 0.82

export function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image-failed'))
      img.onload = () => {
        const ratio = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * ratio))
        const height = Math.max(1, Math.round(img.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas-failed'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('blob-failed'))
          },
          'image/jpeg',
          PHOTO_QUALITY,
        )
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

export function syncObjectUrlCache(cache: Map<Blob, string>, blobs: Blob[]): string[] {
  const next = new Map<Blob, string>()
  const urls: string[] = []
  for (const blob of blobs) {
    const url = cache.get(blob) ?? URL.createObjectURL(blob)
    next.set(blob, url)
    urls.push(url)
  }
  cache.forEach((url, blob) => {
    if (!next.has(blob)) URL.revokeObjectURL(url)
  })
  cache.clear()
  next.forEach((url, blob) => cache.set(blob, url))
  return urls
}

export function revokeAllObjectUrls(cache: Map<Blob, string>): void {
  cache.forEach((url) => URL.revokeObjectURL(url))
  cache.clear()
}
