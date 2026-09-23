'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export type RegisterState = {
  ok: boolean
  message?: string
  fieldErrors?: Partial<Record<'full_name' | 'phone' | 'consent', string>>
  firstName?: string
}

const schema = z.object({
  full_name: z.string().trim().min(2, 'Please enter your full name').max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, '').length >= 8, 'Please enter a phone number we can reach you on'),
  date_of_birth: z.string().trim().max(10).optional(),
  gender: z.enum(['', 'M', 'F']).optional(),
  reason: z.string().trim().max(500).optional(),
  preferred_clinic_id: z.string().trim().max(40).optional(),
  allergies: z.string().trim().max(500).optional(),
  conditions: z.string().trim().max(500).optional(),
  medications: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function submitRegistration(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  // Bots fill every field and submit instantly. A hidden field a person never
  // sees, and a minimum time on the page, stop most of them without a captcha.
  if (String(formData.get('website') || '').length > 0) {
    return { ok: true, firstName: 'there' }
  }
  const startedAt = Number(formData.get('started_at') || 0)
  if (!startedAt || Date.now() - startedAt < 3000) {
    return { ok: false, message: 'That was very quick — please check your details and submit again.' }
  }

  const raw = Object.fromEntries(
    [
      'full_name', 'phone', 'date_of_birth', 'gender', 'reason', 'preferred_clinic_id',
      'allergies', 'conditions', 'medications', 'notes',
    ].map((k) => [k, String(formData.get(k) ?? '')])
  )

  const parsed = schema.safeParse(raw)
  const consent = formData.get('consent') === 'on'

  if (!parsed.success || !consent) {
    const fieldErrors: RegisterState['fieldErrors'] = {}
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const field = issue.path[0]
      if (field === 'full_name' || field === 'phone') fieldErrors[field] ??= issue.message
    }
    if (!consent) fieldErrors.consent = 'Please confirm to continue'
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors }
  }

  const data = parsed.data
  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, message: 'Registration is not available right now. Please register at reception.' }
  }

  const { error } = await admin.from('patient_registrations').insert({
    full_name: data.full_name,
    phone: data.phone,
    date_of_birth: data.date_of_birth && DATE.test(data.date_of_birth) ? data.date_of_birth : null,
    gender: data.gender || null,
    reason: data.reason || null,
    preferred_clinic_id:
      data.preferred_clinic_id && UUID.test(data.preferred_clinic_id) ? data.preferred_clinic_id : null,
    medical_history: {
      allergies: data.allergies || null,
      conditions: data.conditions || null,
      medications: data.medications || null,
      pregnant: formData.get('pregnant') === 'on',
      notes: data.notes || null,
    },
    consent: true,
  })

  if (error) {
    console.error('registration insert failed:', error.message)
    return { ok: false, message: 'Something went wrong saving your details. Please register at reception.' }
  }

  return { ok: true, firstName: data.full_name.split(/\s+/)[0] }
}
