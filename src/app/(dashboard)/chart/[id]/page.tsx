import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LiveRefresh from '@/components/LiveRefresh'
import Odontogram from '../../patients/[id]/Odontogram'

export const dynamic = 'force-dynamic'

/** The chart and nothing else, sized for a phone held next to the chair. */
export default async function ChartOnlyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, file_number, odontogram, medical_history')
    .eq('id', id)
    .single()
  if (!patient) notFound()

  const allergies = (patient.medical_history as { allergies?: string } | null)?.allergies

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/chart" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble hover:text-ink-strong" aria-label="Back to Quick chart">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl text-ink-strong">{patient.full_name}</h1>
          <p className="text-xs text-ink/45">
            {patient.file_number ? `File #${patient.file_number} · ` : ''}
            <Link href={`/patients/${id}`} className="text-teal-deep hover:underline">Full patient page</Link>
          </p>
        </div>
        <LiveRefresh tables={['patients']} filters={{ patients: `id=eq.${id}` }} label="Live" />
      </div>
      {allergies && <p className="rounded-card bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">⚠ Allergies: {allergies}</p>}
      <Odontogram patientId={id} initialOdontogram={patient.odontogram || {}} large />
    </div>
  )
}
