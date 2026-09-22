import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'patient-images'

export const noStore = { 'Cache-Control': 'no-store' }

/**
 * Service-role client. The bridge and the desktop agent authenticate with
 * BRIDGE_API_KEY rather than a Supabase session, so anything done on their
 * behalf has to bypass the cookie-bound RLS client.
 */
export function bridgeAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !key) return null

  return createClient(url, key)
}

/**
 * Checks the shared bridge API key. Returns a response to send back when the
 * caller is not authorised, or null when it is.
 */
export function bridgeAuthError(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const apiKey = process.env.BRIDGE_API_KEY

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  }

  return null
}

export function missingServiceRole(): NextResponse {
  return NextResponse.json(
    { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
    { status: 500, headers: noStore }
  )
}

export function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'jpg'
}

/** Storage keys are namespaced per patient so a key can only write into its own folder. */
export function storagePathFor(patientId: string, filename: string): string {
  const ext = extensionOf(filename)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  return `${patientId}/${timestamp}-${crypto.randomUUID()}.${ext}`
}

/**
 * Rejects a storage path that does not sit under this patient's prefix, so a
 * leaked bridge key cannot attach arbitrary storage objects to a record.
 */
export function pathBelongsToPatient(path: string, patientId: string): boolean {
  return typeof path === 'string' && path.startsWith(`${patientId}/`) && !path.includes('..')
}

/**
 * Members of the image_type Postgres enum, mirroring the picker in the gallery
 * upload form. image_type is the specific *view*; `category` is the coarse
 * grouping the gallery sorts on. Writing anything outside this list makes
 * Postgres reject the whole insert, which is not obvious from the failure.
 */
export const IMAGE_TYPES = [
  'intraoral_front',
  'intraoral_left',
  'intraoral_right',
  'occlusal_upper',
  'occlusal_lower',
  'panoramic',
  'cephalometric',
  'extraoral',
  'other',
] as const

export type ImageType = (typeof IMAGE_TYPES)[number]

/** Best-effort view from the filename, always a valid enum member. */
export function imageTypeFor(filename: string): ImageType {
  const lower = filename.toLowerCase()

  if (lower.includes('pano') || lower.includes('opg')) return 'panoramic'
  if (lower.includes('ceph')) return 'cephalometric'

  if (lower.includes('front')) return 'intraoral_front'
  if (lower.includes('left')) return 'intraoral_left'
  if (lower.includes('right')) return 'intraoral_right'
  if (lower.includes('upper') || lower.includes('maxilla')) return 'occlusal_upper'
  if (lower.includes('lower') || lower.includes('mandib')) return 'occlusal_lower'

  // A hardware capture rarely says which view it is. Guessing a specific one
  // would be wrong more often than not, and `category` already records whether
  // it is a radiograph or an intraoral photo.
  return 'other'
}

export function determineCategory(
  imageType: string | null,
  filename: string,
  ext: string
): 'radiograph' | 'intraoral' | 'document' {
  const lower = filename.toLowerCase()
  const type = imageType?.toLowerCase() || ''

  // Check for EzDent-i X-ray patterns (from Dental Agent)
  if (lower.includes('temp_iosensor') || lower.includes('ezdent')) {
    return 'radiograph'
  }

  // Check for DICOM or X-ray patterns
  if (ext === 'dcm' || lower.includes('xray') || lower.includes('x-ray') ||
      lower.includes('panoramic') || lower.includes('ceph') ||
      type.includes('panoramic') || type.includes('ceph') || type.includes('xray')) {
    return 'radiograph'
  }

  // Check for One2 intraoral camera patterns (from Dental Agent)
  if (lower.includes('one2') || lower.includes('oov')) {
    return 'intraoral'
  }

  // Check for intraoral camera patterns
  if (lower.includes('intraoral') || lower.includes('occlusal') ||
      type.includes('intraoral') || type.includes('occlusal')) {
    return 'intraoral'
  }

  // Check for document patterns
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx' ||
      lower.includes('consent') || lower.includes('form')) {
    return 'document'
  }

  // Default to intraoral for image files
  if (['jpg', 'jpeg', 'png', 'bmp'].includes(ext)) {
    return 'intraoral'
  }

  return 'document'
}
