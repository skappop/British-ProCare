'use client'

import { useState, useTransition } from 'react'
import { Bell, CalendarDays, Check, ClipboardList, FileText, FlaskConical, Package, Users } from 'lucide-react'
import { saveClinicSettings, type ClinicSettings } from './actions'

const MODULES = [
  { key: 'appointments', label: 'Appointments', detail: 'Bookings, arrivals and the day tracker', icon: CalendarDays },
  { key: 'recall', label: 'Recall', detail: 'Patients due for follow-up', icon: Bell },
  { key: 'inventory', label: 'Inventory', detail: 'Stock levels and purchase orders', icon: Package },
  { key: 'lab_cases', label: 'Lab cases', detail: 'Cases sent to external labs', icon: FlaskConical },
  { key: 'staff', label: 'Staff', detail: 'Clinic team and access roles', icon: Users },
  { key: 'reports', label: 'Reports', detail: 'Clinic activity and performance', icon: FileText },
] as const

export default function SettingsClient({ config }: { config: ClinicSettings }) {
  const [settings, setSettings] = useState(config)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await saveClinicSettings(settings)
      setMessage({ ok: result.ok, text: result.message })
    })
  }

  function toggleModule(key: keyof ClinicSettings['features_enabled']) {
    setSettings((current) => ({
      ...current,
      features_enabled: { ...current.features_enabled, [key]: !current.features_enabled[key] },
    }))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-deep">Clinic setup</p>
        <h1 className="mt-1 font-display text-2xl text-ink-strong">Settings</h1>
        <p className="mt-1 text-sm text-ink/55">Reception defaults and the clinic sections available in the menu.</p>
      </div>

      <section className="rounded-card bg-white p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg text-ink-strong">Reception defaults</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-ink/70">
            <span>Default appointment length</span>
            <select value={settings.default_appointment_duration} onChange={(e) => setSettings((s) => ({ ...s, default_appointment_duration: Number(e.target.value) }))} className="w-full rounded-control border border-ink/15 bg-white px-3 py-2.5 text-ink-strong focus:outline-none focus:ring-2 focus:ring-teal">
              {[15, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-ink/10 px-3 py-2.5 text-sm text-ink/75">
            <span>Use patient file numbers</span>
            <input type="checkbox" checked={settings.use_file_numbers} onChange={(e) => setSettings((s) => ({ ...s, use_file_numbers: e.target.checked }))} className="h-4 w-4 accent-teal" />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-ink/10 px-3 py-2.5 text-sm text-ink/75 sm:col-span-2">
            <span><span className="block text-ink-strong">Confirm appointments before booking</span><span className="mt-0.5 block text-xs text-ink/45">Adds a confirmation step to reception booking.</span></span>
            <input type="checkbox" checked={settings.require_appointment_confirmation} onChange={(e) => setSettings((s) => ({ ...s, require_appointment_confirmation: e.target.checked }))} className="h-4 w-4 shrink-0 accent-teal" />
          </label>
        </div>
      </section>

      <section className="rounded-card bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-lg text-ink-strong">Clinic sections</h2><p className="mt-1 text-xs text-ink/50">Turn sections on or off in the navigation.</p></div>
          <ClipboardList size={18} className="text-ink/35" />
        </div>
        <div className="mt-4 divide-y divide-ink/5">
          {MODULES.map(({ key, label, detail, icon: Icon }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-marble/70 text-ink/55"><Icon size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink-strong">{label}</span><span className="block text-xs text-ink/45">{detail}</span></span>
              <input type="checkbox" checked={settings.features_enabled[key]} onChange={() => toggleModule(key)} className="h-4 w-4 shrink-0 accent-teal" />
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-control bg-teal px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep disabled:opacity-60">
          {pending ? 'Saving…' : <><Check size={16} /> Save settings</>}
        </button>
        {message && <p role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>}
      </div>
    </div>
  )
}
