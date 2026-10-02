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
import PatientNotes from './PatientNotes'
import { getCurrentUserRole } from '@/lib/auth/role'

function formatQuickLog(log: any): string[] {
  if (!log) return []
  const lines: string[] = []
  if (log.upper_wire) lines.push(`Upper: ${log.upper_wire.action || 'Changed'} ${log.upper_wire.material} ${log.upper_wire.size || log.upper_wire.dimension}`)
  if (log.lower_wire) lines.push(`Lower: ${log.lower_wire.action || 'Changed'} ${log.lower_wire.material} ${log.lower_wire.size || log.lower_wire.dimension}`)
  if (log.mechanics?.length) lines.push(`Mechanics: ${log.mechanics.map((m: any) => typeof m === 'string' ? m : `${m.type}${m.position ? ` (${m.position})` : ''}`).join(', ')}`)
  if (Array.isArray(log.elastics) && log.elastics.length) lines.push(`Elastics: ${log.elastics.map((e: any) => `${e.vector} ${e.size} ${e.force}`).join(', ')}`)
  else if (log.elastics) lines.push(`Elastics: ${log.elastics.config} (${log.elastics.size})`)
  if (log.tads?.length) lines.push(`TADs: ${log.tads.map((t: any) => `${t.location} ${t.size}`).join(', ')}`)
  if (log.maintenance?.length) lines.push(`Repairs: ${log.maintenance.join(', ')}`)
  if (log.hygiene) lines.push(`Hygiene: ${log.hygiene}`)
  if (log.elastic_compliance) lines.push(`Elastics: ${log.elastic_compliance}`)
  if (log.next_visit_weeks) lines.push(`Next visit: ${log.next_visit_weeks} wks`)
  return lines
}

function formatClinicalLogs(logs: Record<string, unknown> | null | undefined): string[] {
  if (!logs || typeof logs !== 'object') return []
  return Object.entries(logs).flatMap(([category, fields]) => {
    if (category === 'ortho') return []
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return []
    const details = Object.entries(fields as Record<string, unknown>).flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' ? [value].filter(Boolean) : []
      return values.length ? [`${key.replace(/_/g, ' ')}: ${values.join(', ')}`] : []
    })
    return details.length ? [`${category.toUpperCase()}: ${details.join(' · ')}`] : []
  })
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getCurrentUserRole()

  const patientColumns = role === 'assistant'
    ? 'id, full_name, phone, email, file_number, date_of_birth, gender, is_ortho, medical_history, odontogram, notes, status, consent_signed_at, created_at, updated_at, report_notes'
    : 'id, full_name, phone, email, file_number, date_of_birth, gender, is_ortho, medical_history, odontogram, notes, status, consent_signed_at, created_at, updated_at, report_notes, private_notes'
  const firstPatient = await supabase.from('patients').select(patientColumns).eq('id', id).single()
  const patientRow = firstPatient.error
    ? (await supabase
        .from('patients')
        // Keep the profile usable when the database is one migration behind.
        // The newer column list above can fail as a whole if one optional
        // field has not been added yet; select the existing row instead.
        .select('*')
        .eq('id', id)
        .single()).data
    : firstPatient.data
  const patient = patientRow as any
  if (!patient) notFound()

  // This is the doctor's chairside view and the patient can see the screen, so
  // no fees, balances or payments appear on it for anyone. The front desk gets
  // a plain link to the separate billing page — no figures.
  const showBillingLink = role === 'owner' || role === 'assistant'
  const canEditPastVisits = role === 'owner'

  // These reads do not depend on one another. Keeping them in one round trip
  // makes the doctor profile feel immediate on clinics with slower Supabase
  // connections.
  const [
    { data: visits },
    { data: procedures },
    visitState,
    clinics,
    { data: plan },
    { data: labCases },
  ] = await Promise.all([
    supabase.from('visits').select('*, visit_procedures(procedures(name, code))').eq('patient_id', id).order('visit_date', { ascending: false }),
    supabase.from('procedures').select('id, code, name, base_fee, category').eq('is_active', true).order('name'),
    getVisitState(id),
    getClinics(),
    supabase.from('treatment_plans').select('*').eq('patient_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('lab_cases').select('*').eq('patient_id', id).order('sent_at', { ascending: false }),
  ])
  const { currentVisit, currentClinicId, seenToday, upcoming } = visitState
  const clinicList = clinics.map((c) => ({ id: c.id, name: c.name }))
  const suggestedWeeks =
    Number((visits?.[0] as { ortho_log?: { next_visit_weeks?: number }; ortho_quick_log?: { next_visit_weeks?: number } } | undefined)?.ortho_log?.next_visit_weeks
      ?? (visits?.[0] as { ortho_quick_log?: { next_visit_weeks?: number } } | undefined)?.ortho_quick_log?.next_visit_weeks) || null

  let phases: any[] = []
  let unassignedVisits: any[] = []
  if (plan) {
    const [{ data: phaseRows }, { data: unassigned }] = await Promise.all([
      supabase.from('treatment_plan_phases').select('*').eq('treatment_plan_id', plan.id).order('order_index', { ascending: true }),
      supabase.from('visits').select('id, visit_date').eq('patient_id', id).is('treatment_plan_phase_id', null).order('visit_date', { ascending: false }).limit(10),
    ])
    phases = phaseRows || []
    unassignedVisits = unassigned || []
  }

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
        <span className="flex items-center gap-3 text-xs">
          {showBillingLink && <Link href={`/receipts/visit/${v.id}`} target="_blank" className="text-teal-deep hover:underline">Invoice</Link>}
          {canEditPastVisits && <Link href={`/patients/${id}/visits/${v.id}/edit`} className="text-teal-deep hover:underline">Edit visit</Link>}
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

      {formatQuickLog(v.ortho_log || v.ortho_quick_log).length > 0 && (
        <div className="text-xs text-ink/50 font-mono mt-2 space-y-0.5">
          {formatQuickLog(v.ortho_log || v.ortho_quick_log).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {formatClinicalLogs(v.clinical_logs).length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-ink/60">
          {formatClinicalLogs(v.clinical_logs).map((line, i) => <p key={i}>{line}</p>)}
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
            tables={['visits', 'image_records', 'appointments', 'patients']}
            filters={{
              patients: `id=eq.${id}`,
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

      <PatientNotes
        patientId={id}
        initialReport={patient.report_notes || ''}
        initialPrivate={role === 'assistant' ? '' : patient.private_notes || ''}
        canSeePrivate={role !== 'assistant'}
      />

      {/* The page follows the visit: who is here, what is done today, the
          chart and imaging taken while doing it, then the rest of the record,
          and last of all "treatment completed" with the next booking. */}
      <VisitDraft
        patientId={id}
        procedures={procedures || []}
        isOrtho={patient.is_ortho}
        canUseOrthoLog={role !== 'assistant'}
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

        <PatientLabCases patientId={id} initialCases={labCases || []} showLabFee={canEditPastVisits} />

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
