import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { VisitDraft, TreatmentPicker, FinishVisit } from './LogVisitForm'
import Odontogram from './Odontogram'
import PatientReportButton from '@/components/PatientReportButton'
import ActivePatientSync from '@/components/ActivePatientSync'
import LiveRefresh from '@/components/LiveRefresh'
import ImagingPanel from '@/components/ImagingPanel'
import VisitPanel from './VisitPanel'
import { getVisitState } from './visitState'
import { getClinics } from '@/lib/clinics'
import TreatmentPlanPanel from './TreatmentPlanPanel'
import PatientLabCases from './PatientLabCases'
import { canHandleMoney } from '@/lib/auth/role'

function formatQuickLog(log: any): string[] {
  if (!log) return []
  const lines: string[] = []
  if (log.upper_wire) lines.push(`Upper: ${log.upper_wire.material} ${log.upper_wire.dimension}`)
  if (log.lower_wire) lines.push(`Lower: ${log.lower_wire.material} ${log.lower_wire.dimension}`)
  if (log.mechanics?.length) lines.push(`Mechanics: ${log.mechanics.join(', ')}`)
  if (log.elastics) lines.push(`Elastics: ${log.elastics.config} (${log.elastics.size})`)
  if (log.next_visit_weeks) lines.push(`Next visit: ${log.next_visit_weeks} wks`)
  return lines
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: patient } = await supabase.from('patients').select('*').eq('id', id).single()
  if (!patient) notFound()

  const { data: visits } = await supabase
    .from('visits')
    .select('*, visit_procedures(procedures(name, code))')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })

  const { data: procedures } = await supabase
    .from('procedures')
    .select('id, code, name, base_fee, category')
    .eq('is_active', true)
    .order('name')

  // This is the doctor's chairside view and the patient can see the screen, so
  // no fees, balances or payments appear on it for anyone. The front desk gets
  // a plain link to the separate billing page — no figures.
  const showBillingLink = await canHandleMoney()

  // Today's visit and what's booked next, for the doctor to run from here.
  const { currentVisit, currentClinicId, seenToday, upcoming } = await getVisitState(id)
  const clinicList = (await getClinics()).map((c) => ({ id: c.id, name: c.name }))
  const suggestedWeeks =
    Number((visits?.[0] as { ortho_quick_log?: { next_visit_weeks?: number } } | undefined)?.ortho_quick_log?.next_visit_weeks) || null

  // Ortho treatment plan (only relevant if is_ortho, but fetch is cheap and harmless either way)
  const { data: plan } = await supabase
    .from('treatment_plans')
    .select('*')
    .eq('patient_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let phases: any[] = []
  let unassignedVisits: any[] = []
  if (plan) {
    const { data: phaseRows } = await supabase
      .from('treatment_plan_phases')
      .select('*')
      .eq('treatment_plan_id', plan.id)
      .order('order_index', { ascending: true })
    phases = phaseRows || []

    const { data: unassigned } = await supabase
      .from('visits')
      .select('id, visit_date')
      .eq('patient_id', id)
      .is('treatment_plan_phase_id', null)
      .order('visit_date', { ascending: false })
      .limit(10)
    unassignedVisits = unassigned || []
  }

  const { data: labCases } = await supabase
    .from('lab_cases')
    .select('*')
    .eq('patient_id', id)
    .order('sent_at', { ascending: false })

  const visitProps = {
    patientId: id,
    current: currentVisit,
    seenToday,
    upcoming,
    clinics: clinicList,
    defaultClinicId: currentClinicId,
    suggestedWeeks,
  }
  const last = visits?.[0] as { visit_date: string; visit_procedures?: { procedures?: { name?: string } }[] } | undefined
  const lastVisit = last
    ? {
        date: last.visit_date,
        procedures: (last.visit_procedures ?? []).map((vp) => vp.procedures?.name).filter((n): n is string => !!n),
      }
    : null
  const renderVisit = (v: any) => (
    <div key={v.id} className="px-4 py-3">
      <div className="flex justify-between text-sm">
        <span className="font-mono text-ink/70">
          {new Date(v.visit_date).toLocaleDateString()}
        </span>
      </div>

      {v.visit_procedures?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {v.visit_procedures.map((vp: any, i: number) => (
            <span
              key={i}
              className="bg-teal/10 text-teal-deep text-xs px-2 py-1 rounded-full"
            >
              {vp.procedures?.name}
            </span>
          ))}
        </div>
      )}

      {formatQuickLog(v.ortho_quick_log).length > 0 && (
        <div className="text-xs text-ink/50 font-mono mt-2 space-y-0.5">
          {formatQuickLog(v.ortho_quick_log).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {v.notes && <p className="text-sm text-ink/60 mt-2">{v.notes}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-marquina text-white rounded-card p-6">
        <h1 className="font-display text-2xl text-gold-light">{patient.full_name}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-white/70 font-mono">
          <span>{patient.phone || 'No phone'}</span>
          <span>File #{patient.file_number || '—'}</span>
          {patient.is_ortho && <span className="text-gold-light">Ortho Case</span>}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 items-center">
          <Link
            href={`/patients/${id}/gallery`}
            className="text-sm text-gold-light hover:underline"
          >
            View Progress Gallery →
          </Link>
          <Link
            href={`/patients/${id}/intake`}
            className="text-sm text-gold-light hover:underline"
          >
            Medical History &amp; Consent →
          </Link>
          <Link
            href={`/patients/${id}/edit`}
            className="text-sm text-white/50 hover:text-gold-light"
          >
            Edit Patient
          </Link>
          {showBillingLink && (
            <Link href={`/patients/${id}/billing`} className="text-sm text-white/50 hover:text-gold-light">
              Billing
            </Link>
          )}
          <PatientReportButton patientId={id} variant="menu" />
        </div>

        {/* Opening the patient is enough to arm hardware capture — no need to
            go via the gallery first. */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <ActivePatientSync patientId={id} variant="dark" />
          <LiveRefresh
            tables={['visits', 'image_records', 'appointments']}
            filters={{
              visits: `patient_id=eq.${id}`,
              image_records: `patient_id=eq.${id}`,
              appointments: `patient_id=eq.${id}`,
            }}
            label="Live"
            variant="dark"
          />
        </div>
      </div>

      {patient.medical_history?.allergies && (
        <div className="bg-danger/10 rounded-card p-4">
          <p className="text-danger text-sm font-medium">
            ⚠ Allergies: {patient.medical_history.allergies}
          </p>
        </div>
      )}
      {patient.medical_history?.pregnant && (
        <div className="bg-gold/10 rounded-card p-4">
          <p className="text-gold-deep text-sm font-medium">⚠ Currently pregnant / breastfeeding</p>
        </div>
      )}
      {patient.medical_history?.notes && (
        <div className="bg-gold/10 rounded-card p-4">
          <p className="text-gold-deep text-sm">
            <span className="font-medium">⚠ Health note:</span> {patient.medical_history.notes}
          </p>
        </div>
      )}

      {/* The page follows the visit: who is here, what is done today, the
          chart and imaging taken while doing it, then the rest of the record,
          and last of all "treatment completed" with the next booking. */}
      <VisitDraft
        patientId={id}
        procedures={procedures || []}
        isOrtho={patient.is_ortho}
        finishesVisit={!!currentVisit}
      >
        <VisitPanel part="status" {...visitProps} />

        <TreatmentPicker lastVisit={lastVisit} />

        <Odontogram patientId={id} initialOdontogram={patient.odontogram || {}} />

        <ImagingPanel patientId={id} />

        {patient.is_ortho && (
          <TreatmentPlanPanel
            patientId={id}
            initialPlan={plan || null}
            initialPhases={phases}
            unassignedVisits={unassignedVisits}
          />
        )}

        <PatientLabCases patientId={id} initialCases={labCases || []} />

        <details className="bg-white rounded-card shadow-soft group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
            <span className="font-display text-lg text-ink-strong">Visit history</span>
            <span className="text-sm text-teal-deep group-open:hidden">
              {visits?.length ? `Show ${visits.length} visit${visits.length === 1 ? '' : 's'}` : 'No visits yet'}
            </span>
            <span className="hidden text-sm text-ink/45 group-open:inline">Hide</span>
          </summary>
          <div className="divide-y divide-ink/5 border-t border-ink/5">
            {(visits ?? []).map(renderVisit)}
          </div>
        </details>

        <FinishVisit>
          <VisitPanel part="next" {...visitProps} />
        </FinishVisit>
      </VisitDraft>
    </div>
  )
}
