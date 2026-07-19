import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

function toWhatsAppNumber(phone: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '20' + digits.slice(1) // Egyptian local -> country code
  else if (!digits.startsWith('20')) digits = '20' + digits
  return digits
}

function waMessage(name: string) {
  return encodeURIComponent(
    `Hi ${name}, this is a reminder from the clinic that you're due for a follow-up visit. Please reply to book an appointment. 🦷`
  )
}

export default async function RecallPage() {
  const supabase = await createClient()

  const [{ data: patients }, { data: visits }, { data: futureAppts }] = await Promise.all([
    supabase.from('patients').select('id, full_name, phone, is_ortho'),
    supabase
      .from('visits')
      .select('patient_id, visit_date, ortho_quick_log')
      .order('visit_date', { ascending: false }),
    supabase
      .from('appointments')
      .select('patient_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString()),
  ])

  // Most recent visit per patient (visits already ordered desc, keep first hit)
  const lastVisitByPatient: Record<string, { visit_date: string; ortho_quick_log: any }> = {}
  for (const v of visits || []) {
    if (!lastVisitByPatient[v.patient_id]) lastVisitByPatient[v.patient_id] = v
  }

  const bookedPatientIds = new Set((futureAppts || []).map((a) => a.patient_id))
  const now = Date.now()

  type OverdueRow = { patient: any; reason: string; dueSince: Date }
  const overdue: OverdueRow[] = []

  for (const p of patients || []) {
    if (bookedPatientIds.has(p.id)) continue
    const lastVisit = lastVisitByPatient[p.id]
    if (!lastVisit) continue // never had a visit — not a recall case

    const lastVisitDate = new Date(lastVisit.visit_date)

    if (p.is_ortho && lastVisit.ortho_quick_log?.next_visit_weeks) {
      const dueDate = new Date(
        lastVisitDate.getTime() + lastVisit.ortho_quick_log.next_visit_weeks * 7 * 24 * 60 * 60 * 1000
      )
      if (dueDate.getTime() < now) {
        overdue.push({
          patient: p,
          reason: `Ortho follow-up overdue (was due ${lastVisit.ortho_quick_log.next_visit_weeks} wks after last visit)`,
          dueSince: dueDate,
        })
      }
    } else if (!p.is_ortho) {
      if (now - lastVisitDate.getTime() > SIX_MONTHS_MS) {
        overdue.push({
          patient: p,
          reason: '6-month checkup overdue',
          dueSince: new Date(lastVisitDate.getTime() + SIX_MONTHS_MS),
        })
      }
    }
  }

  overdue.sort((a, b) => a.dueSince.getTime() - b.dueSince.getTime())
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Recall</p>
        <h1 className="font-display text-2xl text-ink-strong mt-1">Patients Due for Follow-up</h1>
        <p className="text-sm text-ink/50 mt-1">
          {overdue.length} patient{overdue.length === 1 ? '' : 's'} overdue with no appointment booked
        </p>
      </div>

      <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
        {overdue.map(({ patient, reason, dueSince }) => (
          <div key={patient.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <Link
                href={`/patients/${patient.id}`}
                className="text-sm text-ink-strong font-medium hover:text-teal-deep"
              >
                {patient.full_name}
              </Link>
              <p className="text-xs text-danger mt-0.5">{reason}</p>
              <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                Due since {dueSince.toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {patient.phone && (
                <a
                  href={`https://wa.me/${toWhatsAppNumber(patient.phone)}?text=${waMessage(patient.full_name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-control bg-success/10 text-success hover:bg-success/20 transition-colors"
                >
                  WhatsApp
                </a>
              )}
              <Link
                href={`/appointments?date=${todayStr}`}
                className="text-xs px-3 py-1.5 rounded-control bg-teal/10 text-teal-deep hover:bg-teal/20 transition-colors"
              >
                Book
              </Link>
            </div>
          </div>
        ))}
        {overdue.length === 0 && (
          <div className="px-4 py-10 text-center text-ink/40 text-sm">
            Nobody's overdue right now — nice.
          </div>
        )}
      </div>
    </div>
  )
}
