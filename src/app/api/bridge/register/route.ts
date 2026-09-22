import { NextResponse } from 'next/server'
import {
  BUCKET,
  bridgeAdminClient,
  bridgeAuthError,
  determineCategory,
  extensionOf,
  imageTypeFor,
  missingServiceRole,
  noStore,
  pathBelongsToPatient,
} from '@/lib/bridge'

export const dynamic = 'force-dynamic'

type IncomingImage = {
  path?: string
  filename?: string
  category?: string
  size?: number
}

/**
 * Second half of the signed-URL flow: the agent has already put the bytes into
 * storage, so this only writes the image_records rows that make them visible in
 * the patient's gallery.
 */
export async function POST(request: Request) {
  const unauthorized = bridgeAuthError(request)
  if (unauthorized) return unauthorized

  const admin = bridgeAdminClient()
  if (!admin) return missingServiceRole()

  try {
    const body = await request.json().catch(() => null)
    const patientId: string | undefined = body?.patient_id
    const images: unknown = body?.images
    const sharedMetadata: Record<string, unknown> = body?.metadata ?? {}

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400, headers: noStore })
    }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'images must be a non-empty array' },
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

    const registered = []
    const errors = []

    for (const entry of images as IncomingImage[]) {
      const path = entry?.path
      const filename = entry?.filename || 'capture'

      if (!path || !pathBelongsToPatient(path, patientId)) {
        errors.push({ file: filename, error: 'Storage path does not belong to this patient' })
        continue
      }

      const category =
        entry.category === 'radiograph' || entry.category === 'intraoral' || entry.category === 'document'
          ? entry.category
          : determineCategory(null, filename, extensionOf(filename))

      const { data, error: dbError } = await admin
        .from('image_records')
        .insert({
          patient_id: patientId,
          image_type: imageTypeFor(filename),
          storage_path: path,
          is_baseline: sharedMetadata.is_baseline === true,
          category,
          source: (sharedMetadata.source as string) || 'bridge',
          metadata: {
            original_filename: filename,
            file_size: entry.size ?? null,
            ...sharedMetadata,
          },
          ...(sharedMetadata.notes ? { notes: sharedMetadata.notes } : {}),
        })
        .select('id')
        .single()

      if (dbError) {
        // Surface it in the Vercel function logs too - a schema mismatch here
        // fails every row identically and is invisible from the clinic laptop.
        console.error('image_records insert failed:', dbError.message, dbError.details ?? '')

        // The object is already in storage but has no record, so drop it rather
        // than leave an orphan nothing will ever show or clean up.
        await admin.storage.from(BUCKET).remove([path])
        errors.push({ file: filename, error: dbError.message })
        continue
      }

      registered.push({ id: data.id, filename, storage_path: path, category })
    }

    if (registered.length === 0) {
      return NextResponse.json(
        { error: 'No images could be registered', details: errors },
        { status: 500, headers: noStore }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Registered ${registered.length} of ${(images as IncomingImage[]).length} images`,
        registered: registered.length,
        failed: errors.length,
        images: registered,
        errors: errors.length > 0 ? errors : undefined,
      },
      { headers: noStore }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }
}
