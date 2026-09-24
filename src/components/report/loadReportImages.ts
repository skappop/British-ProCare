// Browser-only: turns the report's image links into small JPEGs for the PDF.
// Originals are several MB each, and on Supabase's free plan storage cannot
// resize them for us, so they are drawn onto a canvas at a sensible size here.

export type PreparedImage = { id: string; dataUrl: string; width: number; height: number }
export type SkippedImage = { id: string; reason: string }

const MAX_SIDE = 1600
const QUALITY = 0.82
const UNSUPPORTED = /\.(dcm|dicom|tif|tiff|raw)$/i

async function prepare(url: string, filename: string): Promise<Omit<PreparedImage, 'id'> | { reason: string }> {
  if (UNSUPPORTED.test(filename)) {
    return { reason: 'DICOM/TIFF — view it in the app' }
  }

  let blob: Blob
  try {
    const res = await fetch(url)
    if (!res.ok) return { reason: `could not download (${res.status})` }
    blob = await res.blob()
  } catch {
    return { reason: 'could not download' }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return { reason: 'format the browser cannot read' }
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { reason: 'could not process' }

  // JPEG has no transparency; a white ground keeps PNG cut-outs readable.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), width, height }
}

/**
 * Prepares images a few at a time — enough to be quick, few enough that a
 * full-mouth series does not exhaust memory on an older clinic PC.
 */
export async function loadReportImages(
  images: { id: string; url: string | null; filename: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<{ prepared: Map<string, PreparedImage>; skipped: SkippedImage[] }> {
  const prepared = new Map<string, PreparedImage>()
  const skipped: SkippedImage[] = []
  let done = 0
  let next = 0

  async function worker() {
    while (next < images.length) {
      const image = images[next++]
      const result = image.url
        ? await prepare(image.url, image.filename)
        : { reason: 'file missing from storage' }
      if ('dataUrl' in result) prepared.set(image.id, { id: image.id, ...result })
      else skipped.push({ id: image.id, reason: result.reason })
      done += 1
      onProgress?.(done, images.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, images.length) }, worker))
  return { prepared, skipped }
}
