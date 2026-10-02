'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Check, Clipboard, MessageCircle, Search, UserRound } from 'lucide-react'

export type RecallItem = {
  id: string
  name: string
  phone: string | null
  kind: 'ortho' | 'general'
  dueSince: string
  lastVisit: string
  reason: string
}

function numberForWhatsApp(phone: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `20${digits.slice(1)}`
  else if (!digits.startsWith('20')) digits = `20${digits}`
  return digits
}

function messageFor(item: RecallItem) {
  const firstName = item.name.trim().split(/\s+/)[0] || item.name
  return `Hello ${firstName}, this is British ProCare Dental Clinics. Your follow-up visit is due. Reply here and our receptionist will help you choose a convenient appointment time. Thank you.`
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysLate(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function RecallBoard({ items }: { items: RecallItem[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'overdue' | 'ortho' | 'general'>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesText = !q || item.name.toLowerCase().includes(q) || (item.phone || '').includes(q)
      const late = new Date(item.dueSince).getTime() < Date.now()
      const matchesFilter = filter === 'all' || (filter === 'overdue' ? late : item.kind === filter)
      return matchesText && matchesFilter
    })
  }, [filter, items, query])

  async function copyMessage(item: RecallItem) {
    try {
      await navigator.clipboard.writeText(messageFor(item))
      setCopied(item.id)
      window.setTimeout(() => setCopied((current) => (current === item.id ? null : current)), 1800)
    } catch {
      setCopied(null)
    }
  }

  const overdue = items.filter((item) => new Date(item.dueSince).getTime() < Date.now()).length
  const ortho = items.filter((item) => item.kind === 'ortho').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Summary label="To contact" value={items.length} />
        <Summary label="Overdue" value={overdue} tone="danger" />
        <Summary label="Orthodontic" value={ortho} tone="gold" />
      </div>

      <div className="rounded-card bg-white p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patient or phone"
              className="w-full rounded-control border border-ink/12 bg-marble/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'overdue', 'ortho', 'general'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${filter === value ? 'border-teal bg-teal/10 font-semibold text-teal-deep' : 'border-ink/12 text-ink/55 hover:border-teal'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-card bg-white shadow-soft">
        <div className="hidden grid-cols-[minmax(0,1fr)_150px_180px] gap-4 border-b border-ink/8 bg-marble/45 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-ink/40 sm:grid">
          <span>Patient</span><span>Due</span><span>Actions</span>
        </div>
        {filtered.map((item) => {
          const late = daysLate(item.dueSince)
          const message = encodeURIComponent(messageFor(item))
          return (
            <div key={item.id} className="grid gap-3 border-b border-ink/7 px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_150px_180px] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="shrink-0 text-ink/35" />
                  <Link href={`/patients/${item.id}`} className="truncate text-sm font-semibold text-ink-strong hover:text-teal-deep">{item.name}</Link>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${item.kind === 'ortho' ? 'bg-gold/15 text-gold-deep' : 'bg-teal/10 text-teal-deep'}`}>{item.kind === 'ortho' ? 'Ortho' : 'General'}</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-ink/50">{item.phone || 'No phone number'} · Last visit {dateLabel(item.lastVisit)}</p>
                <p className={`mt-1 pl-6 text-xs font-medium ${late > 0 ? 'text-danger' : 'text-gold-deep'}`}>{item.reason}</p>
              </div>
              <div className="pl-6 text-xs text-ink/55 sm:pl-0"><span className="font-mono">{dateLabel(item.dueSince)}</span>{late > 0 && <span className="ml-1 text-danger">· {late}d late</span>}</div>
              <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
                {item.phone && <a href={`https://wa.me/${numberForWhatsApp(item.phone)}?text=${message}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-control bg-success/10 px-3 py-2 text-xs font-medium text-success hover:bg-success/20"><MessageCircle size={14} /> WhatsApp</a>}
                <button type="button" onClick={() => copyMessage(item)} className="inline-flex items-center gap-1.5 rounded-control border border-ink/12 px-3 py-2 text-xs text-ink/60 hover:border-teal hover:text-teal-deep">{copied === item.id ? <Check size={14} /> : <Clipboard size={14} />} {copied === item.id ? 'Copied' : 'Copy message'}</button>
                <Link href="/appointments" className="inline-flex items-center rounded-control bg-teal/10 px-3 py-2 text-xs font-medium text-teal-deep hover:bg-teal/20">Book</Link>
              </div>
            </div>
          )
        })}
        {!filtered.length && <div className="px-4 py-12 text-center text-sm text-ink/40">No patients match this view.</div>}
      </div>
    </div>
  )
}

function Summary({ label, value, tone = 'ink' }: { label: string; value: number; tone?: 'ink' | 'danger' | 'gold' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'gold' ? 'text-gold-deep' : 'text-ink-strong'
  return <div className="rounded-card bg-white px-4 py-3 shadow-soft"><p className="text-[10px] font-mono uppercase tracking-wider text-ink/40">{label}</p><p className={`mt-0.5 text-2xl font-mono ${color}`}>{value}</p></div>
}
