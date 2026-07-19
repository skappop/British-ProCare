import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { saveIntake } from '../intakeActions'

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, medical_history, consent_signed_at')
    .eq('id', id)
    .single()

  if (!patient) notFound()

  const history = patient.medical_history || {}

  return (
    <div className="max-w-lg">
      <Link href={`/patients/${id}`} className="text-xs text-teal-deep hover:underline">
        ← {patient.full_name}
      </Link>
      <h1 className="font-display text-2xl text-ink-strong mt-1 mb-6">Medical History &amp; Consent</h1>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {error}
        </div>
      )}

      {patient.consent_signed_at && (
        <div className="bg-success/10 text-success text-sm px-4 py-3 rounded-control mb-4">
          Consent on file since {new Date(patient.consent_signed_at).toLocaleDateString('en-GB')}
        </div>
      )}

      <form
        action={saveIntake.bind(null, id)}
        className="bg-white rounded-card shadow-soft p-6 space-y-4"
      >
        <div className="space-y-1">
          <label className="text-sm text-ink/70">Known Allergies</label>
          <textarea
            name="allergies"
            rows={2}
            defaultValue={history.allergies || ''}
            placeholder="e.g. Penicillin, Latex"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Medical Conditions</label>
          <textarea
            name="conditions"
            rows={2}
            defaultValue={history.conditions || ''}
            placeholder="e.g. Diabetes, Hypertension, Bleeding disorder"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Current Medications</label>
          <textarea
            name="medications"
            rows={2}
            defaultValue={history.medications || ''}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" name="pregnant" defaultChecked={!!history.pregnant} className="rounded" />
          Currently pregnant / breastfeeding
        </label>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Additional Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={history.notes || ''}
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <div className="border-t border-ink/8 pt-4">
          <label className="flex items-start gap-2 text-sm text-ink/70">
            <input type="checkbox" name="consent" className="rounded mt-0.5" />
            <span>
              Patient (or guardian) confirms the above information is accurate and consents to
              examination and treatment at this clinic.
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-teal hover:bg-teal-deep text-white rounded-control py-2.5 text-sm font-medium transition-colors"
        >
          Save
        </button>
      </form>
    </div>
  )
}
