'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/auth/role'

export async function createPatient(formData: FormData) {
  const supabase = await createClient()
  const role = await getCurrentUserRole()

  const patient = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string || null,
    file_number: formData.get('file_number') as string || null,
    date_of_birth: formData.get('date_of_birth') as string || null,
    gender: formData.get('gender') as string || null,
    is_ortho: role === 'assistant' ? false : formData.get('is_ortho') === 'on',
  }
  const { data, error } = await supabase.from('patients').insert(patient).select().single()

  if (error) {
    redirect('/patients/new?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/patients')
  redirect(`/patients/${data.id}`)
}

export async function searchPatients(query: string) {
  const supabase = await createClient()

  let q = supabase.from('patients').select('*').order('created_at', { ascending: false })

  if (query) {
    q = q.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,file_number.ilike.%${query}%`)
  }

  const { data, error } = await q.limit(50)
  if (error) throw error
  return data
}

export async function updatePatient(id: string, formData: FormData) {
  const supabase = await createClient()
  const role = await getCurrentUserRole()

  const updates: Record<string, unknown> = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string || null,
    file_number: formData.get('file_number') as string || null,
    date_of_birth: formData.get('date_of_birth') as string || null,
    gender: formData.get('gender') as string || null,
    notes: formData.get('notes') as string || null,
    updated_at: new Date().toISOString(),
  }
  if (role !== 'assistant') updates.is_ortho = formData.get('is_ortho') === 'on'

  const { error } = await supabase.from('patients').update(updates).eq('id', id)

  if (error) {
    redirect(`/patients/${id}/edit?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/patients/${id}`)
  redirect(`/patients/${id}`)
}

export async function deletePatient(id: string) {
  const supabase = await createClient()
  await supabase.from('patients').delete().eq('id', id)
  revalidatePath('/patients')
  redirect('/patients')
}
