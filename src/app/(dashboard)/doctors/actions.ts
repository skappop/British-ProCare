'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/auth/role'

function text(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function saveDoctor(form: FormData): Promise<{ ok: boolean; message?: string }> {
  if (!(await isOwner())) return { ok: false, message: 'Only the owner can manage clinician profiles' }

  const supabase = await createClient()
  const id = text(form, 'id')
  const fullName = text(form, 'full_name')
  if (!fullName) return { ok: false, message: 'Enter the clinician name' }

  const payload = {
    full_name: fullName,
    title: text(form, 'title'),
    specialization: text(form, 'specialization'),
    phone: text(form, 'phone'),
    email: text(form, 'email'),
    bio: text(form, 'bio'),
    active: form.get('active') === 'on',
    updated_at: new Date().toISOString(),
  }

  const result = id
    ? await supabase.from('doctors').update(payload).eq('id', id).select('id').single()
    : await supabase.from('doctors').insert(payload).select('id').single()
  if (result.error || !result.data) return { ok: false, message: result.error?.message || 'Could not save clinician' }

  const doctorId = result.data.id as string
  const clinicIds = form.getAll('clinic_ids').filter((x): x is string => typeof x === 'string' && !!x)
  await supabase.from('doctor_clinics').delete().eq('doctor_id', doctorId)
  if (clinicIds.length) {
    const { error } = await supabase.from('doctor_clinics').insert(clinicIds.map((clinic_id) => ({ doctor_id: doctorId, clinic_id })))
    if (error) return { ok: false, message: error.message }
  }

  const image = form.get('profile_image')
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) return { ok: false, message: 'Profile image must be under 5 MB' }
    const ext = (image.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${doctorId}/profile-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('doctor-profiles').upload(path, image, { upsert: false, contentType: image.type || 'image/jpeg' })
    if (upload.error) return { ok: false, message: upload.error.message }
    const { error } = await supabase.from('doctors').update({ profile_image_path: path, updated_at: new Date().toISOString() }).eq('id', doctorId)
    if (error) return { ok: false, message: error.message }
  }

  revalidatePath('/doctors')
  revalidatePath('/appointments')
  revalidatePath('/reception')
  revalidatePath('/patients')
  return { ok: true }
}

export async function deleteDoctor(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await isOwner())) return { ok: false, message: 'Only the owner can manage clinician profiles' }
  const supabase = await createClient()
  const { error } = await supabase.from('doctors').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath('/doctors')
  revalidatePath('/appointments')
  revalidatePath('/reception')
  return { ok: true }
}
