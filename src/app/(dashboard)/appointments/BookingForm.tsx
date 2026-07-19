'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createAppointment, searchPatientsForBooking } from './actions'

type PatientHit = { id: string; full_name: string; phone: string | null; file_number: string | null }

export default function BookingForm({
  defaultDate,
  onBooked,
}: {
  defaultDate: string
  onBooked?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])
  const [selected, setSelected] = useState<PatientHit | null>(null)
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!query || selected) {
      setHits([])
      return
    }
    const timeout = setTimeout(() => {
      searchPatientsForBooking(query).then((res) => {
        setHits(res)
        setOpen(true)
      })
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, selected])

  function handleSubmit(formData: FormData) {
    if (!selected) {
      setResult({ ok: false, message: 'Select a patient from the list' })
      return
    }
    formData.set('patient_id', selected.id)

    startTransition(async () => {
      const res = await createAppointment(formData)
      setResult(res)
      if (res.ok) {
        setSelected(null)
        setQuery('')
        formRef.current?.reset()
        onBooked?.()
      }
    })
  }

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <h3 className="font-display text-base text-ink-strong mb-3">Book Appointment</h3>

      {result && (
        <div
          className={`text-xs px-3 py-2 rounded-control mb-3 ${
            result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-3">
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
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => hits.length > 0 && setOpen(true)}
              placeholder="Search name, phone, or file #..."
              className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          )}
          {open && !selected && hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-control shadow-soft border border-ink/10 max-h-48 overflow-y-auto">
              {hits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p)
                    setOpen(false)
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-ink/60">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div>
            <label className="text-xs text-ink/60">Time</label>
            <input
              type="time"
              name="time"
              required
              className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div>
            <label className="text-xs text-ink/60">Duration</label>
            <select
              name="duration"
              defaultValue="30"
              className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-ink/60">Notes (optional)</label>
          <input
            type="text"
            name="notes"
            placeholder="e.g. Bracket rebond"
            className="w-full mt-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-teal hover:bg-teal-deep disabled:opacity-50 text-white text-sm px-4 py-2 rounded-control transition-colors"
        >
          {isPending ? 'Booking…' : 'Book Appointment'}
        </button>
      </form>
    </div>
  )
}
