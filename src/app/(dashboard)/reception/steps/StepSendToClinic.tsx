'use client'

import { useEffect, useState, useTransition } from 'react'
import { Building2, CalendarPlus, Check, Stethoscope } from 'lucide-react'
import type { ReceptionPatient, SafetyAlerts } from '../types'
import { getClinicOptions, sendPatientToClinic } from '../receptionActions'
import { StepCard, GhostButton } from '../ui'
import { createAppointment } from '../../appointments/actions'
import BookSlot, { slotForm } from '@/components/BookSlot'

type ClinicOption = { id: string; name: string; short_name: string | null }

/**
 * The hand-off. Reception picks a clinic and the patient lands in that board's
 * Waiting lane immediately, so the doctor sees them without being told.
 *
 * Logging the treatment and taking payment stay available here, but they are
 * not the default: the doctor records what was done, reception collects
 * afterwards from the ledger.
 */
export default function StepSendToClinic({
  patient,
  alerts,
  bookedAppointmentId,
  initialNote,
  onBack,
  onSent,
  onBooked,
  onHandleHere,
}: {
  patient: ReceptionPatient
  alerts: SafetyAlerts | null
  bookedAppointmentId: string | null
  initialNote?: string | null
  onBack: () => void
  onSent: (clinicName: string) => void
  /** Booked for later instead of sent now. */
  onBooked: (label: string) => void
  onHandleHere: () => void
}) {
  const [clinics, setClinics] = useState<ClinicOption[] | null>(null)
  // Pre-filled with the reason the patient gave when registering online.
  const [note, setNote] = useState(initialNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Not seeing a doctor now: give them an appointment instead.
  const [later, setLater] = useState(false)

  useEffect(() => {
    let active = true
    getClinicOptions().then((list) => {
      if (active) setClinics(list)
    })
    return () => {
      active = false
    }
  }, [])

  function send(clinic: ClinicOption) {
    setError(null)
    startTransition(async () => {
      const res = await sendPatientToClinic(patient.id, clinic.id, note, bookedAppointmentId)
      if (res.ok) onSent(clinic.name)
      else setError(res.message || 'Could not send the patient')
    })
  }

  return (
    <StepCard title="Send to a clinic" subtitle={patient.full_name} onBack={onBack}>
      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">{error}</div>
      )}

      {(alerts?.allergies || alerts?.pregnant) && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-4">
          {alerts.allergies && <p className="font-medium">⚠ Allergies: {alerts.allergies}</p>}
          {alerts.pregnant && <p className="font-medium">⚠ Pregnant / breastfeeding</p>}
          <p className="text-danger/70 text-xs mt-1">This stays flagged on the doctor&apos;s screen.</p>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-sm text-ink/70">Note for the doctor (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Upper right pain since Friday"
          className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      {later ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-ink-strong">Book {patient.full_name.split(' ')[0]} a time</p>
          <BookSlot
            clinics={(clinics ?? []).map(({ id, name }) => ({ id, name }))}
            defaultNotes={note || null}
            onCancel={() => setLater(false)}
            onBook={async (slot, allowSecond) => {
              const res = await createAppointment(slotForm(patient.id, slot, allowSecond))
              if (res.ok) onBooked(slot.label)
              return res
            }}
          />
        </div>
      ) : (
      <div className="mt-6 space-y-3">
        <p className="text-sm font-medium text-ink-strong">Seeing a doctor now? Send them to:</p>
        {clinics === null && <p className="text-sm text-ink/40 py-4">Loading clinics…</p>}

        {clinics?.length === 0 && (
          <div className="bg-marble text-ink/60 rounded-control px-4 py-3 text-sm">
            No clinics configured yet. Run <span className="font-mono text-xs">migration
            13_clinics_and_realtime.sql</span> in Supabase to add Clinic 1 and Clinic 2.
          </div>
        )}

        {clinics?.map((clinic) => (
          <button
            key={clinic.id}
            type="button"
            onClick={() => send(clinic)}
            disabled={isPending}
            className="w-full flex items-center gap-3 rounded-control border border-ink/12 bg-white px-4 py-4 text-left hover:border-teal hover:bg-teal/[0.04] transition-colors disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-teal/10 text-teal-deep">
              <Building2 size={19} />
            </span>
            <span className="flex-1">
              <span className="block text-base font-medium text-ink-strong">{clinic.name}</span>
              <span className="block text-xs text-ink/50">
                Sends {patient.full_name.split(' ')[0]} straight to this clinic&apos;s waiting list
              </span>
            </span>
            <Check size={18} className="text-ink/20" />
          </button>
        ))}

        <button
          type="button"
          onClick={() => setLater(true)}
          className="w-full flex items-center gap-3 rounded-control border border-dashed border-teal/40 bg-white px-4 py-3.5 text-left hover:bg-teal/[0.04] transition-colors"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-gold/10 text-gold-deep">
            <CalendarPlus size={19} />
          </span>
          <span className="flex-1">
            <span className="block text-base font-medium text-ink-strong">Book a time instead</span>
            <span className="block text-xs text-ink/50">Pick the day and time; the clinic can be decided when they arrive</span>
          </span>
        </button>
      </div>
      )}

      <div className="gold-hairline my-6" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink/45">
          The doctor records the treatment. You collect payment afterwards from the ledger.
        </p>
        <GhostButton onClick={onHandleHere}>
          <span className="inline-flex items-center gap-1.5">
            <Stethoscope size={14} /> Log it here instead
          </span>
        </GhostButton>
      </div>
    </StepCard>
  )
}
