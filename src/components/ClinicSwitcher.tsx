'use client'

import { MapPin } from 'lucide-react'
import type { Clinic } from '@/lib/clinics'
import { useStoredValue } from '@/lib/useStoredValue'

export const CLINIC_KEY = 'procare.clinic'

/**
 * Which clinic this computer is in. It never hides anyone: staff move between
 * clinics during the day, so the other clinic's patients stay on screen,
 * listed after this clinic's and faded. Arrival alerts ring only for this
 * clinic. Remembered per device.
 */
export default function ClinicSwitcher({ clinics }: { clinics: Pick<Clinic, 'id' | 'name' | 'short_name'>[] }) {
  const [mine, setMine] = useStoredValue(CLINIC_KEY)
  if (clinics.length < 2) return null

  const active = mine && clinics.some((c) => c.id === mine) ? mine : 'all'
  const options = [...clinics.map((c) => ({ id: c.id, label: c.short_name || c.name })), { id: 'all', label: 'Both' }]

  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] text-ink/45">
        <MapPin size={12} /> This computer
      </span>
      <div className="inline-flex rounded-control bg-ink/[0.04] p-0.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMine(option.id === 'all' ? null : option.id)}
            className={`rounded-control px-3 py-1.5 text-xs transition-colors ${
              active === option.id ? 'bg-white font-medium text-ink-strong shadow-soft' : 'text-ink/55 hover:text-ink-strong'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** This clinic's rows first, then the rest; order within each group is kept. */
export function mineFirst<T>(rows: T[], clinicOf: (row: T) => string | null | undefined, mine: string | null): T[] {
  if (!mine) return rows
  const isMine = (r: T) => {
    const c = clinicOf(r)
    return !c || c === mine
  }
  return [...rows.filter(isMine), ...rows.filter((r) => !isMine(r))]
}
