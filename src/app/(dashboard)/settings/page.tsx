import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import { guardPage } from '@/lib/auth/role'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await guardPage('/settings')
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('clinic_configuration')
    .select('*')
    .limit(1)
    .maybeSingle()

  const features = (config?.features_enabled || {}) as Record<string, boolean>
  return <SettingsClient config={{
    default_appointment_duration: config?.default_appointment_duration || 30,
    require_appointment_confirmation: config?.require_appointment_confirmation || false,
    use_file_numbers: config?.use_file_numbers ?? true,
    features_enabled: {
      appointments: features.appointments !== false,
      recall: features.recall !== false,
      inventory: features.inventory !== false,
      lab_cases: features.lab_cases !== false,
      staff: features.staff !== false,
      reports: features.reports !== false,
    },
  }} />
}
