'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, Plus, UserRound, X } from 'lucide-react'
import { deleteDoctor, saveDoctor } from './actions'
import type { Doctor } from '@/lib/doctors'

export default function DoctorDirectory({ doctors, clinics }: { doctors: Doctor[]; clinics: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: HTMLFormElement) {
    startTransition(async () => {
      const result = await saveDoctor(new FormData(form))
      if (!result.ok) return setMessage(result.message || 'Could not save clinician')
      setMessage('Profile saved')
      setEditing(null)
      setAdding(false)
      window.location.reload()
    })
  }

  function archive(id: string) {
    if (!confirm('Hide this clinician from new assignments? Existing visits stay unchanged.')) return
    startTransition(async () => {
      const result = await deleteDoctor(id)
      if (!result.ok) setMessage(result.message || 'Could not archive clinician')
      else window.location.reload()
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/55">These profiles are the names staff choose on a shared clinic computer. They are separate from login accounts.</p>
        <button type="button" onClick={() => { setAdding(true); setEditing(null) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-teal px-3 py-2 text-sm text-white hover:bg-teal-deep"><Plus size={15} /> Add clinician</button>
      </div>
      {message && <p className="rounded-control bg-success/10 px-3 py-2 text-sm text-success">{message}</p>}
      {(adding || editing) && <DoctorForm doctor={editing} clinics={clinics} pending={pending} onCancel={() => { setAdding(false); setEditing(null) }} onSubmit={submit} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {doctors.map((doctor) => (
          <div key={doctor.id} className={`rounded-card border bg-white p-4 shadow-soft ${doctor.active ? 'border-ink/8' : 'border-ink/15 opacity-60'}`}>
            <div className="flex items-start gap-3">
              {doctor.profile_image_url ? <img src={doctor.profile_image_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal-deep"><UserRound size={22} /></span>}
              <div className="min-w-0 flex-1"><p className="font-medium text-ink-strong">{doctor.title ? `${doctor.title} ` : ''}{doctor.full_name}</p><p className="text-sm text-ink/55">{doctor.specialization || 'Clinician'}</p>{doctor.phone && <p className="mt-1 text-xs font-mono text-ink/45">{doctor.phone}</p>}</div>
              {!doctor.active && <span className="text-xs text-ink/45">Hidden</span>}
            </div>
            {doctor.bio && <p className="mt-3 text-sm text-ink/60 line-clamp-3">{doctor.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">{doctor.clinic_ids.map((id) => <span key={id} className="rounded-full bg-marble px-2 py-1 text-[11px] text-ink/55">{clinics.find((c) => c.id === id)?.name || 'Clinic'}</span>)}</div>
            <div className="mt-4 flex items-center gap-3 border-t border-ink/5 pt-3"><button type="button" onClick={() => { setEditing(doctor); setAdding(false) }} className="inline-flex items-center gap-1 text-xs text-teal-deep hover:underline"><Pencil size={13} /> Edit</button>{doctor.active && <button type="button" onClick={() => archive(doctor.id)} className="inline-flex items-center gap-1 text-xs text-ink/45 hover:text-danger"><X size={13} /> Hide</button>}</div>
          </div>
        ))}
      </div>
      {doctors.length === 0 && <div className="rounded-card bg-white p-8 text-center text-sm text-ink/45 shadow-soft">No clinician profiles yet.</div>}
    </div>
  )
}

function DoctorForm({ doctor, clinics, pending, onCancel, onSubmit }: { doctor: Doctor | null; clinics: { id: string; name: string }[]; pending: boolean; onCancel: () => void; onSubmit: (form: HTMLFormElement) => void }) {
  return <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget) }} className="rounded-card border border-teal/25 bg-white p-5 shadow-soft space-y-4">
    <input type="hidden" name="id" value={doctor?.id || ''} />
    <div className="flex items-center justify-between"><h2 className="font-display text-lg text-ink-strong">{doctor ? 'Edit clinician' : 'New clinician'}</h2><button type="button" onClick={onCancel} className="text-ink/40 hover:text-ink"><X size={18} /></button></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field name="full_name" label="Full name" required defaultValue={doctor?.full_name || ''} />
      <Field name="title" label="Title" placeholder="Dr." defaultValue={doctor?.title || ''} />
      <Field name="specialization" label="Specialization" placeholder="Orthodontist" defaultValue={doctor?.specialization || ''} />
      <Field name="phone" label="Phone" defaultValue={doctor?.phone || ''} />
      <Field name="email" label="Email" type="email" defaultValue={doctor?.email || ''} />
      <label className="space-y-1 text-sm text-ink/70">Profile picture<input name="profile_image" type="file" accept="image/*" className="block w-full text-xs" /></label>
    </div>
    <label className="block space-y-1 text-sm text-ink/70">Bio / details<textarea name="bio" rows={3} defaultValue={doctor?.bio || ''} className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm" /></label>
    <div className="space-y-2"><p className="text-sm text-ink/70">Clinics where this person can be assigned</p><div className="flex flex-wrap gap-2">{clinics.map((c) => <label key={c.id} className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3 py-1.5 text-sm"><input type="checkbox" name="clinic_ids" value={c.id} defaultChecked={doctor?.clinic_ids.includes(c.id)} />{c.name}</label>)}</div></div>
    <label className="inline-flex items-center gap-2 text-sm text-ink/70"><input type="checkbox" name="active" defaultChecked={doctor?.active ?? true} /> Available for new assignments</label>
    <div className="flex gap-2"><button disabled={pending} className="inline-flex items-center gap-1.5 rounded-control bg-teal px-4 py-2 text-sm text-white disabled:opacity-50"><Check size={15} /> {pending ? 'Saving…' : 'Save profile'}</button><button type="button" onClick={onCancel} className="rounded-control border border-ink/15 px-4 py-2 text-sm text-ink/60">Cancel</button></div>
  </form>
}

function Field({ name, label, defaultValue, placeholder, type = 'text', required = false }: { name: string; label: string; defaultValue: string; placeholder?: string; type?: string; required?: boolean }) { return <label className="space-y-1 text-sm text-ink/70">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm" /></label> }
