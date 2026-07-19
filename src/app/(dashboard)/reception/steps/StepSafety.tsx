'use client'

import { useEffect, useState, useTransition } from 'react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import type { PatientSafety, ReceptionPatient, SafetyAlerts } from '../types'
import { getPatientSafety, quickSaveIntake } from '../receptionActions'
import { StepCard, PrimaryButton, GhostButton, Field, inputClass } from '../ui'

export default function StepSafety({
  patient,
  onBack,
  onDone,
}: {
  patient: ReceptionPatient
  onBack: () => void
  onDone: (alerts: SafetyAlerts) => void
}) {
  const [loading, setLoading] = useState(true)
  const [safety, setSafety] = useState<PatientSafety | null>(null)
  const [editing, setEditing] = useState(false)

  const [allergies, setAllergies] = useState('')
  const [conditions, setConditions] = useState('')
  const [medications, setMedications] = useState('')
  const [pregnant, setPregnant] = useState(false)
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    getPatientSafety(patient.id).then((s) => {
      if (!active) return
      setSafety(s)
      const h = s.medical_history || {}
      setAllergies(h.allergies || '')
      setConditions(h.conditions || '')
      setMedications(h.medications || '')
      setPregnant(!!h.pregnant)
      setNotes(h.notes || '')
      // A brand-new patient with no history recorded jumps straight to the form.
      const hasHistory = !!(h.allergies || h.conditions || h.medications || h.pregnant || h.notes)
      setEditing(!hasHistory && !s.consent_signed_at)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [patient.id])

  function currentAlerts(): SafetyAlerts {
    return {
      allergies: allergies.trim() || null,
      conditions: conditions.trim() || null,
      pregnant,
    }
  }

  function confirmOnFile() {
    onDone(currentAlerts())
  }

  function saveAndContinue() {
    setError(null)
    startTransition(async () => {
      const res = await quickSaveIntake(patient.id, {
        allergies,
        conditions,
        medications,
        pregnant,
        notes,
        consent,
      })
      if (res.ok) {
        onDone(currentAlerts())
      } else {
        setError(res.message || 'Could not save the history')
      }
    })
  }

  if (loading) {
    return (
      <StepCard title="Medical safety check" onBack={onBack}>
        <p className="text-sm text-ink/40 py-6">Loading history…</p>
      </StepCard>
    )
  }

  const h = safety?.medical_history || {}
  const hasFlags = !!(h.allergies || h.conditions || h.pregnant)

  // Review mode: history already on file — surface the risks, confirm in one tap.
  if (!editing) {
    return (
      <StepCard title="Medical safety check" subtitle={patient.full_name} onBack={onBack}>
        <div className="space-y-3">
          {h.allergies && (
            <div className="flex items-start gap-2.5 bg-danger/10 text-danger rounded-control px-4 py-3">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">Allergies: {h.allergies}</p>
            </div>
          )}
          {h.conditions && (
            <div className="flex items-start gap-2.5 bg-gold/10 text-gold-deep rounded-control px-4 py-3">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">Conditions: {h.conditions}</p>
            </div>
          )}
          {h.pregnant && (
            <div className="bg-gold/10 text-gold-deep rounded-control px-4 py-3 text-sm font-medium">
              ⚠ Currently pregnant / breastfeeding
            </div>
          )}
          {h.medications && (
            <p className="text-sm text-ink/60 px-1">
              <span className="text-ink/40">Medications:</span> {h.medications}
            </p>
          )}
          {!hasFlags && !h.medications && (
            <div className="flex items-center gap-2.5 bg-success/10 text-success rounded-control px-4 py-3">
              <ShieldCheck size={17} className="shrink-0" />
              <p className="text-sm">No allergies or conditions on record.</p>
            </div>
          )}

          {safety?.consent_signed_at ? (
            <div className="flex items-center gap-2.5 bg-success/10 text-success rounded-control px-4 py-3">
              <ShieldCheck size={17} className="shrink-0" />
              <p className="text-sm">
                Consent on file since {new Date(safety.consent_signed_at).toLocaleDateString('en-GB')}
              </p>
            </div>
          ) : (
            <div className="bg-marble text-ink/60 rounded-control px-4 py-3 text-sm">
              No consent recorded yet — update the history to capture it.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6">
          <GhostButton onClick={() => setEditing(true)}>Update history</GhostButton>
          <PrimaryButton onClick={confirmOnFile}>Confirmed, continue →</PrimaryButton>
        </div>
      </StepCard>
    )
  }

  // Edit mode: capture or update the intake, reusing the same fields as /intake.
  return (
    <StepCard
      title="Medical history & consent"
      subtitle={patient.full_name}
      onBack={onBack}
    >
      {error && <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">{error}</div>}

      <div className="space-y-4">
        <Field label="Known allergies">
          <textarea
            rows={2}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, Latex"
            className={inputClass}
          />
        </Field>
        <Field label="Medical conditions">
          <textarea
            rows={2}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="e.g. Diabetes, Hypertension, Bleeding disorder"
            className={inputClass}
          />
        </Field>
        <Field label="Current medications">
          <textarea rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} className={inputClass} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} className="rounded" />
          Currently pregnant / breastfeeding
        </label>

        <Field label="Additional notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>

        <div className="border-t border-ink/8 pt-4">
          <label className="flex items-start gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="rounded mt-0.5" />
            <span>
              Patient (or guardian) confirms the above is accurate and consents to examination and
              treatment at this clinic.
            </span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <GhostButton onClick={() => onDone(currentAlerts())}>Skip for now</GhostButton>
        <PrimaryButton onClick={saveAndContinue} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save & continue →'}
        </PrimaryButton>
      </div>
    </StepCard>
  )
}
