import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LogVisitForm from './LogVisitForm'
import PaymentLedger from './PaymentLedger'
import { getPatientLedger } from './actions'
import Odontogram from './Odontogram'
import PatientReportButton from '@/components/PatientReportButton'
import ActivePatientSync from '@/components/ActivePatientSync'
import LiveRefresh from '@/components/LiveRefresh'
import ImagingPanel from '@/components/ImagingPanel'
import { Wallet } from 'lucide-react'
import TreatmentPlanPanel from './TreatmentPlanPanel'
import PatientLabCases from './PatientLabCases'
import { isOwner } from '@/lib/auth/role'

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

  const canSeeFinancials = await isOwner()

  const ledger = canSeeFinancials ? await getPatientLedger(id) : null
  const visitOptions = (visits || []).map((v: any) => ({
    id: v.id,
    label: `${new Date(v.visit_date).toLocaleDateString('en-GB')} — EGP ${v.fee_charged ?? 0}`,
  }))

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

  return (
    <div className="space-y-6">
      <div className="bg-marquina text-white rounded-card p-6">
        <h1 className="font-display text-2xl text-gold-light">{patient.full_name}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-white/70 font-mono">
          <span>{patient.phone || 'No phone'}</span>
          <span>File #{patient.file_number || '—'}</span>
          {patient.is_ortho && <span className="text-gold-light">Ortho Case</span>}
          {canSeeFinancials && ledger && ledger.balance > 0 && (
            <span className="text-danger">Balance: EGP {ledger.balance.toLocaleString()}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 items-center">
          {canSeeFinancials && (
            <a
              href="#ledger"
              className="inline-flex items-center gap-1.5 rounded-control bg-gold/20 hover:bg-gold/30 text-gold-light px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Wallet size={15} />
              {ledger && ledger.balance > 0
                ? `Take payment · EGP ${ledger.balance.toLocaleString()} due`
                : 'Payments'}
            </a>
          )}
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
          <PatientReportButton patientId={id} variant="dark" label="Download report" />
        </div>

        {/* Opening the patient is enough to arm hardware capture — no need to
            go via the gallery first. */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <ActivePatientSync patientId={id} variant="dark" />
          <LiveRefresh tables={['visits', 'payments', 'image_records']} label="Live" variant="dark" />
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

      <ImagingPanel patientId={id} />

      <LogVisitForm patientId={id} procedures={procedures || []} isOrtho={patient.is_ortho} />

      <Odontogram patientId={id} initialOdontogram={patient.odontogram || {}} />

      {patient.is_ortho && (
        <TreatmentPlanPanel
            patientId={id}
          initialPlan={plan || null}
          initialPhases={phases}
          unassignedVisits={unassignedVisits}
        />
      )}

      <PatientLabCases patientId={id} initialCases={labCases || []} />

      <div>
        <h2 className="font-display text-lg text-ink-strong mb-3">Visit History</h2>
        <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
          {visits?.map((v: any) => (
            <div key={v.id} className="px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="font-mono text-ink/70">
                  {new Date(v.visit_date).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  {v.fee_charged && canSeeFinancials && (
                    <span className="font-mono text-ink-strong">EGP {v.fee_charged}</span>
                  )}
                  {canSeeFinancials && (
                    <a
                      href={`/receipts/${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-deep hover:underline"
                    >
                      Receipt
                    </a>
                  )}
                </div>
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
          ))}
          {(!visits || visits.length === 0) && (
            <div className="px-4 py-8 text-center text-ink/40 text-sm">No visits yet.</div>
          )}
        </div>
      </div>

      {canSeeFinancials && ledger && (
        <div id="ledger" className="scroll-mt-6 space-y-6">
          <PaymentLedger
            patientId={id}
            totalCharged={ledger.totalCharged}
            totalPaid={ledger.totalPaid}
            balance={ledger.balance}
            payments={ledger.payments}
            visitOptions={visitOptions}
          />
        </div>
      )}
    </div>
  )
}
