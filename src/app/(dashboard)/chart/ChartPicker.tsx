'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronRight, Search } from 'lucide-react'
import { searchPatientsForBooking } from '../appointments/actions'
import { CLINIC_KEY, mineFirst } from '@/components/ClinicSwitcher'
import { useStoredValue } from '@/lib/useStoredValue'

export type ChartRow = {
  patient_id: string
  name: string
  file_number: string | null
  group: 'camera' | 'here' | 'booked' | 'seen'
  detail: string | null
  clinic_id: string | null
}

const GROUPS: { key: ChartRow['group']; title: string }[] = [
  { key: 'camera', title: 'Under the camera now' },
  { key: 'here', title: 'Here now' },
  { key: 'booked', title: 'Booked today' },
  { key: 'seen', title: 'Seen today' },
]

type Hit = { id: string; full_name: string; phone: string | null; file_number: string | null }

export default function ChartPicker({ rows }: { rows: ChartRow[] }) {
  const [clinic] = useStoredValue(CLINIC_KEY)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const t = setTimeout(() => searchPatientsForBooking(q).then(setHits), 250)
    return () => clearTimeout(t)
  }, [query])

  const sorted = mineFirst(rows, (r) => r.clinic_id, clinic)
  const searching = query.trim().length >= 2

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find any patient — name, phone, file #"
          className="w-full rounded-control border border-ink/15 bg-white py-3 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </label>

      {searching ? (
        <List>
          {hits.map((h) => (
            <Row key={h.id} href={`/chart/${h.id}`} name={h.full_name} detail={[h.file_number && `File #${h.file_number}`, h.phone].filter(Boolean).join(' · ')} />
          ))}
          {hits.length === 0 && <p className="px-4 py-4 text-sm text-ink/40">No match yet…</p>}
        </List>
      ) : (
        <>
          {GROUPS.map(({ key, title }) => {
            const items = sorted.filter((r) => r.group === key)
            if (items.length === 0) return null
            return (
              <section key={key}>
                <h2 className={`mb-2 text-[11px] font-mono uppercase tracking-wider ${key === 'camera' ? 'text-teal-deep' : 'text-ink/45'}`}>{title}</h2>
                <List>
                  {items.map((r) => (
                    <Row
                      key={r.patient_id}
                      href={`/chart/${r.patient_id}`}
                      name={r.name}
                      detail={[r.detail, r.file_number && `File #${r.file_number}`].filter(Boolean).join(' · ')}
                      camera={key === 'camera'}
                      faded={!!clinic && !!r.clinic_id && r.clinic_id !== clinic}
                    />
                  ))}
                </List>
              </section>
            )
          })}
          {rows.length === 0 && (
            <p className="rounded-card bg-white px-4 py-8 text-center text-sm text-ink/45 shadow-soft">
              Nobody is checked in yet. Search above to chart any patient.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-ink/5 overflow-hidden rounded-card bg-white shadow-soft">{children}</div>
}

function Row({ href, name, detail, camera, faded }: { href: string; name: string; detail?: string; camera?: boolean; faded?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-marble ${camera ? 'bg-teal/[0.06]' : ''} ${faded ? 'opacity-55' : ''}`}
    >
      {camera && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal text-white">
          <Camera size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-ink-strong">{name}</span>
        {detail && <span className="block truncate text-xs text-ink/50">{detail}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink/30" />
    </Link>
  )
}
