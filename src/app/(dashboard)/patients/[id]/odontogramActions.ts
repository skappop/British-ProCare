'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ToothStatus = 'healthy' | 'treated' | 'missing' | 'planned' | 'watch'

export async function updateTooth(
  patientId: string,
  toothNumber: string,
  status: ToothStatus | null,
  note: string
) {
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('patients')
    .select('odontogram')
    .eq('id', patientId)
    .single()

  const odontogram = { ...(patient?.odontogram || {}) }

  if (!status || status === 'healthy') {
    delete odontogram[toothNumber]
  } else {
    odontogram[toothNumber] = { status, note: note || undefined }
  }

  const { error } = await supabase
    .from('patients')
    .update({ odontogram })
    .eq('id', patientId)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true, message: 'Tooth updated' }
}
