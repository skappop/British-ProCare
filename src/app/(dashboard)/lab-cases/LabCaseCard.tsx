'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateLabCaseStatus } from './actions'

type LabCase = {
  id: string
  patient_id: string
  patient_name: string
  case_type: string
  lab_name: string | null
  sent_at: string
  due_at: string | null
  lab_fee: number | null
  status: string
}

export default function LabCaseCard({ labCase, showLabFee = false }: { labCase: LabCase; showLabFee?: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isOverdue = labCase.due_at && new Date(labCase.due_at) < new Date() && labCase.status !== 'received'

  function setStatus(status: string) {
    startTransition(async () => {
      await updateLabCaseStatus(labCase.id, status, labCase.patient_id)
      router.refresh()
    })
  }

  return (
    <div className={`bg-white rounded-card shadow-soft p-4 ${isOverdue ? 'ring-1 ring-danger/40' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href={`/patients/${labCase.patient_id}`} className="text-sm text-ink-strong font-medium hover:text-teal-deep">
            {labCase.patient_name}
          </Link>
          <p className="text-xs text-ink/50">{labCase.case_type}{labCase.lab_name && ` · ${labCase.lab_name}`}</p>
        </div>
        {isOverdue && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-danger/10 text-danger uppercase tracking-wider">
            Overdue
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-ink/40 font-mono mb-3">
        <span>Sent {new Date(labCase.sent_at).toLocaleDateString('en-GB')}</span>
        {labCase.due_at && <span>Due {new Date(labCase.due_at).toLocaleDateString('en-GB')}</span>}
        {showLabFee && labCase.lab_fee && <span>EGP {labCase.lab_fee}</span>}
      </div>
      <div className="flex gap-2">
        {labCase.status === 'sent' && (
          <button
            disabled={isPending}
            onClick={() => setStatus('in_progress')}
            className="text-[10px] px-2 py-1 rounded-control bg-teal/10 text-teal-deep hover:bg-teal/20"
          >
            Mark In Progress
          </button>
        )}
        <button
          disabled={isPending}
          onClick={() => setStatus('received')}
          className="text-[10px] px-2 py-1 rounded-control bg-success/10 text-success hover:bg-success/20"
        >
          Mark Received
        </button>
        <button
          disabled={isPending}
          onClick={() => setStatus('cancelled')}
          className="text-[10px] px-2 py-1 rounded-control bg-danger/10 text-danger hover:bg-danger/20"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
