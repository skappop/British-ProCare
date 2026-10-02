import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/auth/role'
import EditVisitForm from './EditVisitForm'

/**
 * Edit a past visit: the procedures done, the notes, and what was charged.
 * Owner only — changing history is sensitive.
 */
export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>
}) {
  const { id: patientId, visitId } = await params

  // Only the owner can alter past visits.
  if (!(await isOwner())) redirect(`/patients/${patientId}`)

  const supabase = await createClient()

  const [{ data: patient }, { data: visit }, { data: procedures }] = await Promise.all([
    supabase.from('patients').select('full_name, file_number').eq('id', patientId).maybeSingle(),
    supabase
      .from('visits')
      .select('id, visit_date, fee_charged, notes, visit_procedures(procedure_id)')
      .eq('id', visitId)
      .eq('patient_id', patientId)
      .maybeSingle(),
    supabase
      .from('procedures')
      .select('id, code, name, base_fee, category')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!patient || !visit) notFound()

  const visitData = {
    id: visit.id,
    date: visit.visit_date,
    fee: visit.fee_charged,
    notes: visit.notes || '',
    procedureIds: ((visit.visit_procedures as any[]) || []).map((vp) => vp.procedure_id as string),
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="bg-marquina text-white rounded-card p-6">
        <h1 className="font-display text-2xl text-gold-light">Edit Visit</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-white/70">
          <span>{patient.full_name}</span>
          <span>File #{patient.file_number || '—'}</span>
          <span className="font-mono">
            {new Date(visitData.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div className="rounded-card bg-gold/10 border border-gold/40 px-4 py-3 text-sm text-ink-strong">
        <p className="font-medium">⚠ Changing past records</p>
        <p className="text-ink/70 mt-1">
          Only edit a visit to correct a mistake entered at the time. The change is logged and visible
          on reports. Never change history to hide what actually happened.
        </p>
      </div>

      <EditVisitForm
        patientId={patientId}
        visit={visitData}
        procedures={(procedures as any[]) || []}
      />
    </div>
  )
}
