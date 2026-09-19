'use client'

import { useEffect } from 'react'

/**
 * Automatically sets this patient as the "active patient" for the Osstem bridge
 * when their gallery page is viewed.
 *
 * This enables auto-linking: any image captured via Osstem hardware while this
 * page is open will automatically upload to this patient's gallery.
 */
export default function ActivePatientSync({ patientId }: { patientId: string }) {
  useEffect(() => {
    // Set active patient on mount
    async function setActive() {
      try {
        await fetch('/api/bridge/active-patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: patientId }),
        })
      } catch (error) {
        // Silently fail - bridge might not be enabled
        console.debug('Could not set active patient:', error)
      }
    }

    setActive()

    // Refresh active patient every 5 minutes while page is open
    // (active patient expires after 10 minutes of inactivity)
    const interval = setInterval(setActive, 5 * 60 * 1000)

    // Clear active patient when leaving the page
    return () => {
      clearInterval(interval)
      // Optional: Clear active patient on unmount
      // fetch('/api/bridge/active-patient', {
      //   method: 'POST',
      //   body: JSON.stringify({ patient_id: null }),
      // }).catch(() => {})
    }
  }, [patientId])

  return null // This component has no UI
}
