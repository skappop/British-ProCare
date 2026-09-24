'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Smartphone, X, HeartPulse, CalendarPlus, LogIn, MessageCircle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReceptionPatient } from '../types'
import {
  acceptRegistration,
  dismissRegistration,
  getClinicOptions,
  getPendingRegistrations,
  type PendingRegistration,
} from '../receptionActions'
import { createAppointment } from '../../appointments/actions'
import BookSlot, { slotForm, type Slot } from '@/components/BookSlot'
import { SectionLabel } from '../ui'

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** 010… → 2010… for a WhatsApp link. */
function whatsappNumber(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('20')) return d
  if (d.startsWith('0')) return `2${d}`
  return d
}

type Booked = { name: string; phone: string; when: string; clinic: string | null }

/**
 * Patients who filled in the online form. Reception decides what happens:
 * "Here now" turns it into a patient and carries on into the walk-in flow;
 * "Book a time" gives them an appointment — the patient never picks a time,
 * the desk does, knowing the doctors' day.
 */
export default function PendingRegistrations({
  onPick,
}: {
  onPick: (patient: ReceptionPatient, reason: string | null) => void
}) {
  const [items, setItems] = useState<PendingRegistration[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // Which existing patient a registration is (or 'new'), when the phone matched.
  const [who, setWho] = useState<Record<string, string>>({})
  const [booking, setBooking] = useState<string | null>(null)
  const [booked, setBooked] = useState<Booked | null>(null)
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getClinicOptions().then((c) => setClinics(c.map(({ id, name }) => ({ id, name }))))
  }, [])

  const load = useCallback(() => {
    getPendingRegistrations().then(setItems)
  }, [])

  useEffect(() => {
    load()

    // A patient submitting on their phone should appear here without a reload.
    const supabase = createClient()
    const channel = supabase
      .channel('pending-registrations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_registrations' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  function accept(reg: PendingRegistration, target: 'new' | string) {
    setError(null)
    setBusy(reg.id)
    startTransition(async () => {
      const res = await acceptRegistration(reg.id, target)
      setBusy(null)
      if (res.ok && res.patient) onPick(res.patient, res.reason ?? null)
      else {
        setError(res.message || 'Could not check this patient in')
        load()
      }
    })
  }

  // Registrations already turned into patients (so a "book another?" retry
  // does not try to accept the same registration twice).
  const accepted = useRef<Record<string, ReceptionPatient>>({})

  async function book(reg: PendingRegistration, target: string, slot: Slot, allowSecond: boolean) {
    setError(null)
    setBusy(reg.id)
    try {
      let patient = accepted.current[reg.id]
      if (!patient) {
        const res = await acceptRegistration(reg.id, target)
        if (!res.ok || !res.patient) {
          setError(res.message || 'Could not book this patient')
          load()
          return { ok: false, message: res.message || 'Could not book this patient' }
        }
        patient = res.patient
        accepted.current[reg.id] = patient
      }
      const appt = await createAppointment(slotForm(patient.id, slot, allowSecond))
      if (appt.duplicate) return appt
      setBooking(null)
      if (!appt.ok) {
        setError(`${reg.full_name} was added as a patient, but the booking failed: ${appt.message}. Book them from Appointments.`)
      } else {
        setBooked({
          name: reg.full_name,
          phone: reg.phone,
          when: new Date(slot.iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }),
          clinic: clinics.find((c) => c.id === slot.clinicId)?.name ?? null,
        })
      }
      load()
      return appt
    } finally {
      setBusy(null)
    }
  }


  function dismiss(reg: PendingRegistration) {
    if (!confirm(`Remove ${reg.full_name}'s online registration? Nothing else is affected.`)) return
    setItems((list) => list.filter((r) => r.id !== reg.id))
    dismissRegistration(reg.id)
  }

  if (items.length === 0 && !booked) return null

  return (
    <div className="space-y-2.5">
      <SectionLabel>Registered online</SectionLabel>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-2.5 rounded-control">{error}</div>
      )}

      {booked && (
        <div className="flex flex-wrap items-center gap-3 rounded-control bg-success/10 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-success">
            <Check size={15} /> {booked.name} booked for {booked.when}
            {booked.clinic ? ` · ${booked.clinic}` : ''}
          </span>
          <a
            href={`https://wa.me/${whatsappNumber(booked.phone)}?text=${encodeURIComponent(
              `Hello ${booked.name.split(' ')[0]}, this is British ProCare Dental Clinics. Your appointment is on ${booked.when}${booked.clinic ? ` at ${booked.clinic}` : ''}. Please reply to confirm.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control bg-white px-3 py-1.5 text-ink-strong shadow-soft hover:bg-marble"
          >
            <MessageCircle size={14} /> Confirm on WhatsApp
          </a>
          <button type="button" onClick={() => setBooked(null)} className="ml-auto text-ink/40 hover:text-ink-strong" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((reg) => (
          <div
            key={reg.id}
            className="rounded-control border border-gold/30 bg-gold/[0.05] px-3.5 py-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
                <Smartphone size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-strong font-medium truncate">{reg.full_name}</p>
                <p className="text-xs text-ink/50 font-mono truncate">
                  {reg.phone} · {ago(reg.created_at)}
                  {reg.preferred_clinic ? ` · ${reg.preferred_clinic}` : ''}
                </p>
                {reg.reason && <p className="text-xs text-ink/55 mt-1 line-clamp-2">{reg.reason}</p>}
                {reg.health_note && (
                  <p className="flex items-start gap-1.5 text-xs text-gold-deep bg-gold/10 rounded-control px-2 py-1.5 mt-1.5">
                    <HeartPulse size={12} className="mt-0.5 shrink-0" />
                    <span>{reg.health_note}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(reg)}
                aria-label="Remove registration"
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded-control text-ink/30 hover:text-danger hover:bg-danger/10"
              >
                <X size={13} />
              </button>
            </div>

            <div className="mt-3 pl-12 space-y-2.5">
              {reg.match && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
                  <span>
                    Same phone as <span className="font-medium text-ink-strong">{reg.match.full_name}</span>
                    {reg.match.file_number ? ` · File ${reg.match.file_number}` : ''}:
                  </span>
                  {[
                    { value: reg.match.id, label: 'Same person' },
                    { value: 'new', label: 'New patient' },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setWho((w) => ({ ...w, [reg.id]: o.value }))}
                      className={`rounded-full border px-2.5 py-1 ${
                        (who[reg.id] ?? reg.match!.id) === o.value ? 'border-teal bg-teal/10 text-teal-deep' : 'border-ink/15'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {booking === reg.id ? (
                <div className="rounded-control bg-white p-3 ring-1 ring-ink/10">
                  <BookSlot
                    clinics={clinics}
                    defaultNotes={reg.reason}
                    onCancel={() => setBooking(null)}
                    onBook={(slot, allowSecond) => book(reg, who[reg.id] ?? reg.match?.id ?? 'new', slot, allowSecond)}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => accept(reg, who[reg.id] ?? reg.match?.id ?? 'new')}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-control bg-teal text-white hover:bg-teal-deep disabled:opacity-50"
                  >
                    <LogIn size={13} /> {busy === reg.id ? 'Checking in…' : 'Here now'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => setBooking(reg.id)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-control border border-teal/40 text-teal-deep hover:bg-teal/5 disabled:opacity-50"
                  >
                    <CalendarPlus size={13} /> Book a time
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

