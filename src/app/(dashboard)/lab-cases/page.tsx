import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LabCaseCard from './LabCaseCard'
import { isOwner } from '@/lib/auth/role'

const CASE_TYPE_LABELS: Record<string, string> = {
  crown: 'Crown',
  bridge: 'Bridge',
  denture: 'Denture',
  night_guard: 'Night Guard',
  retainer: 'Retainer',
  other: 'Other',
}

export default async function LabCasesPage() {
  const showLabFee = await isOwner()
  const supabase = await createClient()

  const { data: cases } = await supabase
    .from('lab_cases')
    .select('*, patients(full_name)')
    .order('sent_at', { ascending: false })

  const active = (cases || []).filter((c) => c.status === 'sent' || c.status === 'in_progress')
  const overdue = active.filter((c) => c.due_at && new Date(c.due_at) < new Date())
  const history = (cases || []).filter((c) => c.status === 'received' || c.status === 'fitted' || c.status === 'cancelled')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-gold-deep font-mono">Lab</p>
        <h1 className="font-display text-2xl text-ink-strong mt-1">Lab Case Tracking</h1>
        <p className="text-sm text-ink/50 mt-1">
          {active.length} active {overdue.length > 0 && <span className="text-danger">· {overdue.length} overdue</span>}
        </p>
      </div>

      <div>
        <h2 className="font-display text-lg text-ink-strong mb-3">Awaiting from Lab</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {active.map((c: any) => (
            <LabCaseCard
              key={c.id}
              showLabFee={showLabFee}
              labCase={{
                id: c.id,
                patient_id: c.patient_id,
                patient_name: c.patients?.full_name || 'Unknown',
                case_type: CASE_TYPE_LABELS[c.case_type] || c.case_type,
                lab_name: c.lab_name,
                sent_at: c.sent_at,
                due_at: c.due_at,
                lab_fee: c.lab_fee,
                status: c.status,
              }}
            />
          ))}
          {active.length === 0 && (
            <div className="bg-white rounded-card shadow-soft px-4 py-8 text-center text-ink/40 text-sm md:col-span-2">
              Nothing out at the lab right now.
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-ink-strong mb-3">History</h2>
          <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
            {history.map((c: any) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <Link href={`/patients/${c.patient_id}`} className="text-sm text-ink-strong hover:text-teal-deep">
                    {c.patients?.full_name}
                  </Link>
                  <span className="text-xs text-ink/40 ml-2">{CASE_TYPE_LABELS[c.case_type] || c.case_type}</span>
                </div>
                <span className="text-xs text-ink/40 font-mono capitalize">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
