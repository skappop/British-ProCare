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
  // One free-text box instead of separate allergy / condition / medicine
  // questions, which patients found overwhelming. Staff see it highlighted.
  health_note: z.string().trim().max(1000).optional(),
})

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
    ['full_name', 'phone', 'date_of_birth', 'gender', 'reason', 'health_note'].map((k) => [
      k,
      String(formData.get(k) ?? ''),
    ])
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

  // A flood of submissions is not patients: stop before the list fills up.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count: recentCount } = await admin
    .from('patient_registrations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', tenMinutesAgo)
  if ((recentCount ?? 0) >= 40) {
    return { ok: false, message: 'We are receiving a lot of registrations right now. Please register at reception.' }
  }

  // Submitted twice (a double tap, or back and submit again): update the one
  // reception has not handled yet instead of adding a second copy. Same phone
  // AND same name, since family members often share a phone.
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString()
  const sameName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')
  const { data: pending } = await admin
    .from('patient_registrations')
    .select('id, full_name')
    .eq('phone', data.phone)
    .eq('status', 'pending')
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: false })
  const existing = (pending ?? []).filter((r) => sameName(String(r.full_name)) === sameName(data.full_name))
  const row = {
    full_name: data.full_name,
    phone: data.phone,
    date_of_birth: data.date_of_birth && DATE.test(data.date_of_birth) ? data.date_of_birth : null,
    gender: data.gender || null,
    reason: data.reason || null,
    medical_history: {
      allergies: null,
      conditions: null,
      medications: null,
      pregnant: false,
      notes: data.health_note || null,
    },
    consent: true,
  }
  const { error } = existing?.length
    ? await admin.from('patient_registrations').update(row).eq('id', existing[0].id)
    : await admin.from('patient_registrations').insert(row)

  if (error) {
    console.error('registration insert failed:', error.message)
    return { ok: false, message: 'Something went wrong saving your details. Please register at reception.' }
  }

  return { ok: true, firstName: data.full_name.split(/\s+/)[0] }
}
