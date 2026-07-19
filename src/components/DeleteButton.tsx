'use client'

import { useState, useRef } from 'react'

export default function DeleteButton({
  action,
  label = 'Delete',
  warning = 'Confirm delete?',
}: {
  action: () => Promise<void>
  label?: string
  warning?: string
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleClick() {
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 3000)
    } else {
      if (timer.current) clearTimeout(timer.current)
      action()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-xs px-3 py-1.5 rounded-control border transition-all ${
        armed
          ? 'bg-danger text-white border-danger'
          : 'bg-white text-danger border-danger/30 hover:border-danger'
      }`}
    >
      {armed ? warning : label}
    </button>
  )
}