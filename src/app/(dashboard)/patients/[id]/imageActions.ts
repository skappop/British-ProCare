'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadImage(formData: FormData) {
  const supabase = await createClient()

  const patientId = formData.get('patient_id') as string
  const imageType = formData.get('image_type') as string
  const isBaseline = formData.get('is_baseline') === 'on'
  const file = formData.get('file') as File

  if (!file || file.size === 0) {
    return { ok: false, message: 'No file selected' }
  }

  const ext = file.name.split('.').pop()
  const path = `${patientId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('patient-images')
    .upload(path, file)

  if (uploadError) {
    return { ok: false, message: uploadError.message }
  }

  const { error: dbError } = await supabase.from('image_records').insert({
    patient_id: patientId,
    image_type: imageType,
    storage_path: path,
    is_baseline: isBaseline,
  })

  if (dbError) {
    return { ok: false, message: dbError.message }
  }

  revalidatePath(`/patients/${patientId}/gallery`)
  return { ok: true, message: 'Image uploaded' }
}

export async function getSignedUrls(paths: string[]) {
  const supabase = await createClient()
  const results: Record<string, string> = {}

  for (const path of paths) {
    const { data } = await supabase.storage
      .from('patient-images')
      .createSignedUrl(path, 60 * 60) // 1 hour validity
    if (data) results[path] = data.signedUrl
  }

  return results
}