'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateStaffRole } from './actions'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  dentist: 'Dentist',
  assistant: 'Assistant',
}

export default function RoleSelect({
  profileId,
  currentRole,
}: {
  profileId: string
  currentRole: string
}) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function change(next: string) {
    const prev = role
    setRole(next)
    setErr(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('role', next)
      const res = await updateStaffRole(profileId, fd)
      if (!res?.ok) {
        setRole(prev)
        setErr(res?.message || 'Could not update role')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        name="role"
        value={role}
        disabled={isPending}
        onChange={(e) => change(e.target.value)}
        className="rounded-control border border-ink/15 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-60"
      >
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {err && <span className="text-[10px] text-danger max-w-[12rem] text-right">{err}</span>}
    </div>
  )
}
