'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Clinic } from '@/lib/clinics'

const REMEMBERED = 'procare.clinic'

/**
 * Clinic filter for staff who move between sites during the day. The choice
 * lives in the URL so the server render can filter on it, and is remembered per
 * device so the next visit opens where they left off.
 */
export default function ClinicSwitcher({
  clinics,
  active,
}: {
  clinics: Clinic[]
  active: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const urlValue = params.get('clinic')

  useEffect(() => {
    if (urlValue) return

    let remembered: string | null = null
    try {
      remembered = window.localStorage.getItem(REMEMBERED)
    } catch {
      // Private browsing or blocked storage — fall through to showing all.
    }

    if (remembered && clinics.some((c) => c.id === remembered)) {
      const next = new URLSearchParams(params.toString())
      next.set('clinic', remembered)
      router.replace(`${pathname}?${next}`)
    }
  }, [urlValue, clinics, params, pathname, router])

  function choose(value: string) {
    try {
      if (value === 'all') window.localStorage.removeItem(REMEMBERED)
      else window.localStorage.setItem(REMEMBERED, value)
    } catch {
      // Not being able to remember is not a reason to block the switch.
    }

    const next = new URLSearchParams(params.toString())
    if (value === 'all') next.delete('clinic')
    else next.set('clinic', value)

    router.push(`${pathname}${next.toString() ? `?${next}` : ''}`)
  }

  if (clinics.length < 2) return null

  const options = [...clinics.map((c) => ({ id: c.id, label: c.short_name || c.name })), { id: 'all', label: 'All' }]

  return (
    <div className="inline-flex rounded-control bg-ink/[0.04] p-0.5">
      {options.map((option) => {
        const isActive = active === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            className={`px-3 py-1.5 text-xs rounded-control transition-colors ${
              isActive
                ? 'bg-white text-ink-strong shadow-soft font-medium'
                : 'text-ink/55 hover:text-ink-strong'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
