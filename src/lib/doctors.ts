import { createClient } from '@/lib/supabase/server'

export type Doctor = {
  id: string
  full_name: string
  title: string | null
  specialization: string | null
  phone: string | null
  email: string | null
  bio: string | null
  profile_image_path: string | null
  profile_image_url: string | null
  active: boolean
  clinic_ids: string[]
}

type DoctorRow = {
  id: string
  full_name: string
  title: string | null
  specialization: string | null
  phone: string | null
  email: string | null
  bio: string | null
  profile_image_path: string | null
  active: boolean
  doctor_clinics: { clinic_id: string }[] | null
}

function mapDoctor(row: DoctorRow, url: string | null): Doctor {
  return {
    ...row,
    profile_image_url: url,
    clinic_ids: (row.doctor_clinics ?? []).map((x) => x.clinic_id),
  }
}

async function addImageUrls(supabase: Awaited<ReturnType<typeof createClient>>, rows: DoctorRow[]) {
  const bucket = supabase.storage.from('doctor-profiles')
  return Promise.all(rows.map(async (row) => {
    if (!row.profile_image_path) return mapDoctor(row, null)
    const { data } = await bucket.createSignedUrl(row.profile_image_path, 900)
    return mapDoctor(row, data?.signedUrl ?? null)
  }))
}

export async function listDoctors(options: { activeOnly?: boolean; clinicId?: string } = {}): Promise<Doctor[]> {
  const supabase = await createClient()
  let query = supabase
    .from('doctors')
    .select('id, full_name, title, specialization, phone, email, bio, profile_image_path, active, doctor_clinics(clinic_id)')
    .order('active', { ascending: false })
    .order('full_name')

  if (options.activeOnly !== false) query = query.eq('active', true)
  if (options.clinicId) {
    const { data: links } = await supabase.from('doctor_clinics').select('doctor_id').eq('clinic_id', options.clinicId)
    const ids = (links ?? []).map((x) => x.doctor_id)
    if (!ids.length) return []
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return []
  return addImageUrls(supabase, (data ?? []) as unknown as DoctorRow[])
}

