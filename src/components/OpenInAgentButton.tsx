'use client'

import { useState } from 'react'
import { MonitorSmartphone } from 'lucide-react'

/**
 * Launches the Dental Agent on this PC via the procare:// handler, with the
 * patient already selected.
 *
 * A browser cannot tell whether a protocol handler exists, and an unregistered
 * one fails silently — so after a click we offer the setup hint rather than
 * leaving the doctor tapping a button that appears to do nothing.
 */
export default function OpenInAgentButton({
  patientId,
  variant = 'dark',
}: {
  patientId: string
  variant?: 'light' | 'dark'
}) {
  const [clicked, setClicked] = useState(false)

  const dark = variant === 'dark'

  return (
    <span className="inline-flex flex-col">
      <a
        href={`procare://patient/${patientId}`}
        onClick={() => setClicked(true)}
        className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
          dark
            ? 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
            : 'bg-ink/[0.06] hover:bg-ink/10 text-ink/70'
        }`}
        title="Opens the imaging agent on this computer with this patient selected"
      >
        <MonitorSmartphone size={15} />
        Open in Dental Agent
      </a>

      {clicked && (
        <span className={`text-[11px] mt-1 ${dark ? 'text-white/40' : 'text-ink/40'}`}>
          Nothing opened? Run{' '}
          <span className="font-mono">install_protocol.py</span> once on this PC.
        </span>
      )}
    </span>
  )
}
