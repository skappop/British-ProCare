'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isOwner } from '@/lib/auth/role'

export async function updateStaffRole(profileId: string, formData: FormData) {
  if (!(await isOwner())) {
    return { ok: false, message: 'Only the owner can change roles' }
  }

  const supabase = await createClient()
  const role = formData.get('role') as string

  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/staff')
  return { ok: true, message: 'Role updated' }
}
