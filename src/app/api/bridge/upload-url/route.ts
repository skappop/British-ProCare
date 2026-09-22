import { NextResponse } from 'next/server'
import {
  BUCKET,
  bridgeAdminClient,
  bridgeAuthError,
  determineCategory,
  extensionOf,
  missingServiceRole,
  noStore,
  storagePathFor,
} from '@/lib/bridge'

export const dynamic = 'force-dynamic'

// Enough headroom for a full-mouth series in one session.
const MAX_FILES = 60

/**
 * Hands the bridge/agent a short-lived signed URL per file so images go
 * straight from the clinic laptop to Supabase Storage.
 *
 * Posting the images through this API instead would cap them at Vercel's 4.5MB
 * request body limit, which a handful of intraoral photos exceeds on its own.
 */
export async function POST(request: Request) {
  const unauthorized = bridgeAuthError(request)
  if (unauthorized) return unauthorized

  const admin = bridgeAdminClient()
  if (!admin) return missingServiceRole()

  try {
    const body = await request.json().catch(() => null)
    const patientId: string | undefined = body?.patient_id
    const filenames: unknown = body?.filenames

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400, headers: noStore })
    }

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: 'filenames must be a non-empty array' },
        { status: 400, headers: noStore }
      )
    }

    if (filenames.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files in one session (max ${MAX_FILES})` },
        { status: 400, headers: noStore }
      )
    }

    const { data: patient, error: patientError } = await admin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .maybeSingle()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: noStore })
    }

    const uploads = []
    for (const entry of filenames) {
      const filename = String(entry)
      const path = storagePathFor(patientId, filename)

      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path)

      if (signError || !signed) {
        return NextResponse.json(
          { error: `Failed to sign upload for ${filename}: ${signError?.message ?? 'unknown error'}` },
          { status: 500, headers: noStore }
        )
      }

      uploads.push({
        filename,
        path,
        category: determineCategory(null, filename, extensionOf(filename)),
        signed_url: signed.signedUrl,
        token: signed.token,
      })
    }

    return NextResponse.json(
      { ok: true, patient_id: patientId, bucket: BUCKET, uploads },
      { headers: noStore }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }
}
