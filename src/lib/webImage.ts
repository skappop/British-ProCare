// Browser-only. The website's copy of a photo is for viewing on screens and
// in PDFs, so it is stored at a sensible size — a phone photo drops from a few
// MB to a few hundred KB, which is what keeps storage on the free plan. Same
// rules as the Dental Agent's web copies.

const MAX_SIDE = 2400
const QUALITY = 0.85
const SMALL_JPEG = 800_000

/** A web-sized JPEG of `file`, or `file` itself when shrinking would not help. */
export async function shrinkForWeb(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || /dicom|tiff/.test(file.type)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  const longest = Math.max(bitmap.width, bitmap.height)
  if (file.type === 'image/jpeg' && longest <= MAX_SIDE && file.size <= SMALL_JPEG) {
    bitmap.close()
    return file
  }

  const scale = Math.min(1, MAX_SIDE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#ffffff' // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob || blob.size >= file.size * 0.9) return file
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
}
