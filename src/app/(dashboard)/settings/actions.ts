'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/auth/role'

export type ClinicSettings = {
  default_appointment_duration: number
  require_appointment_confirmation: boolean
  use_file_numbers: boolean
  features_enabled: {
    appointments: boolean
    recall: boolean
    inventory: boolean
    lab_cases: boolean
    staff: boolean
    reports: boolean
  }
}

export async function saveClinicSettings(settings: ClinicSettings) {
  if ((await getCurrentUserRole()) !== 'owner') return { ok: false, message: 'Only the clinic owner can change settings' }
  if (![15, 20, 30, 45, 60, 90].includes(settings.default_appointment_duration)) {
    return { ok: false, message: 'Choose a supported appointment duration' }
  }

  const supabase = await createClient()
  const { data: current, error: readError } = await supabase.from('clinic_configuration').select('id').limit(1).maybeSingle()
  if (readError || !current) return { ok: false, message: 'Clinic settings are not initialized in the database yet' }

  const { error } = await supabase.from('clinic_configuration').update({
    default_appointment_duration: settings.default_appointment_duration,
    require_appointment_confirmation: settings.require_appointment_confirmation,
    use_file_numbers: settings.use_file_numbers,
    features_enabled: settings.features_enabled,
  }).eq('id', current.id)

  if (error) return { ok: false, message: error.message }
  revalidatePath('/')
  revalidatePath('/settings')
  return { ok: true, message: 'Clinic settings saved' }
}
