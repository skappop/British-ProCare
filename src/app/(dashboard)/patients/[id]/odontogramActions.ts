'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidFdi, statusFromFindings, type Finding, type ToothData } from '@/components/dental/charting'

const STATUSES = new Set(['healthy', 'treated', 'missing', 'planned', 'watch'])

function clean(tooth: ToothData): ToothData | null {
  const findings: Finding[] | undefined = Array.isArray(tooth.findings)
    ? tooth.findings
        .filter((f) => f && typeof f.code === 'string')
        .slice(0, 20)
        .map((f) => ({
          code: String(f.code).slice(0, 24),
          at: String(f.at ?? '').slice(0, 40),
          ...(f.surfaces ? { surfaces: String(f.surfaces).slice(0, 5) } : {}),
          ...(f.note ? { note: String(f.note).slice(0, 300) } : {}),
        }))
    : undefined
  const note = tooth.note ? String(tooth.note).slice(0, 500) : undefined
  const status = findings ? statusFromFindings(findings) : STATUSES.has(tooth.status) ? tooth.status : 'healthy'
  if ((!findings || findings.length === 0) && status === 'healthy' && !note) return null
  return { status, ...(findings ? { findings } : {}), ...(note ? { note } : {}) }
}

/**
 * Saves the teeth that changed (null clears a tooth). Only those teeth are
 * written, so two people charting the same patient don't undo each other's
 * other teeth. Deliberately does not revalidate the page: the chart already
 * shows what was typed, and re-rendering the whole patient page after every
 * tooth is what made charting feel slow.
 */
export async function saveTeeth(
  patientId: string,
  changes: Record<string, ToothData | null>
): Promise<{ ok: boolean; message?: string }> {
  const entries = Object.entries(changes ?? {}).filter(([fdi]) => isValidFdi(fdi))
  if (entries.length === 0) return { ok: true }

  const supabase = await createClient()
  const { data: patient, error: readError } = await supabase
    .from('patients')
    .select('odontogram')
    .eq('id', patientId)
    .single()
  if (readError) return { ok: false, message: readError.message }

  const odontogram: Record<string, ToothData> = { ...((patient?.odontogram as Record<string, ToothData>) || {}) }
  for (const [fdi, tooth] of entries) {
    const next = tooth ? clean(tooth) : null
    if (next) odontogram[fdi] = next
    else delete odontogram[fdi]
  }

  const { error } = await supabase.from('patients').update({ odontogram }).eq('id', patientId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
