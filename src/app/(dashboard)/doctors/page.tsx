import { getClinics } from '@/lib/clinics'
import { listDoctors } from '@/lib/doctors'
import DoctorDirectory from './DoctorDirectory'

export default async function DoctorsPage() {
  const [doctors, clinics] = await Promise.all([listDoctors({ activeOnly: false }), getClinics()])
  return <div className="max-w-4xl space-y-6"><div><p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Clinical team</p><h1 className="font-display text-2xl text-ink-strong mt-1">Doctors &amp; assistants</h1></div><DoctorDirectory doctors={doctors} clinics={clinics.map((c) => ({ id: c.id, name: c.name }))} /></div>
}
