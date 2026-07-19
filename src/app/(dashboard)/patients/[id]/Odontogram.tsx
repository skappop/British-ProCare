'use client'

import DentalChart, { type OdontogramData } from '@/components/dental/DentalChart'
import type { ToothStatus } from '@/components/dental/toothStatus'
import { updateTooth } from './odontogramActions'

// Thin wrapper: the interactive, anatomically-styled chart lives in
// @/components/dental so it can be reused (patient profile + walk-in). This
// keeps the existing <Odontogram patientId initialOdontogram /> interface and
// self-saves through the existing updateTooth server action.
export default function Odontogram({
  patientId,
  initialOdontogram,
}: {
  patientId: string
  initialOdontogram: OdontogramData
}) {
  return (
    <DentalChart
      initial={initialOdontogram || {}}
      onSaveTooth={(fdi: string, status: ToothStatus, note: string) =>
        updateTooth(patientId, fdi, status, note)
      }
    />
  )
}
