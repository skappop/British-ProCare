'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createAppointment, searchPatientsForBooking } from './actions'
import BookSlot, { slotForm } from '@/components/BookSlot'

type PatientHit = { id: string; full_name: string; phone: string | null; file_number: string | null }

export default function BookingForm({
  defaultDate,
  clinics,
  onBooked,
}: {
  defaultDate: string
  clinics: { id: string; name: string }[]
  onBooked?: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])
  const [selected, setSelected] = useState<PatientHit | null>(null)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  // A fresh panel after each booking.
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!query || selected) return
    const timeout = setTimeout(() => {
      searchPatientsForBooking(query).then((res) => {
        setHits(res)
        setOpen(true)
      })
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, selected])

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <h3 className="font-display text-base text-ink-strong mb-3">Book Appointment</h3>

      {done && (
        <div className="mb-3 flex items-center gap-2 rounded-control bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 size={15} /> {done}
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <label className="text-xs text-ink/60">Patient</label>
          {selected ? (
            <div className="mt-1 flex items-center justify-between rounded-control border border-teal/40 bg-teal/5 px-3 py-2 text-sm">
              <span className="text-ink-strong">{selected.full_name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setQuery('')
                }}
                className="text-xs text-danger/70 hover:text-danger"
              >
                change
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value) setHits([])
              }}
              onFocus={() => hits.length > 0 && setOpen(true)}
              placeholder="Search name, phone, or file #..."
              className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          )}
          {open && !selected && query && hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-control shadow-soft border border-ink/10 max-h-48 overflow-y-auto">
              {hits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p)
                    setOpen(false)
                    setDone(null)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-marble/60 border-b border-ink/5 last:border-0"
                >
                  <span className="text-ink-strong">{p.full_name}</span>
                  <span className="text-ink/40 text-xs ml-2 font-mono">{p.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <BookSlot
            key={round}
            clinics={clinics}
            defaultDate={defaultDate}
            onBook={async (slot, allowSecond) => {
              const res = await createAppointment(slotForm(selected.id, slot, allowSecond))
              if (res.ok) {
                setDone(`${selected.full_name} booked for ${slot.label}`)
                setSelected(null)
                setQuery('')
                setRound((r) => r + 1)
                router.refresh()
                onBooked?.()
              }
              return res
            }}
          />
        ) : (
          <p className="text-xs text-ink/40">Find the patient first, then pick the day and time.</p>
        )}
      </div>
    </div>
  )
}
