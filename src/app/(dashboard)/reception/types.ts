// Shared types for the guided Walk-In (reception) flow.
// This flow orchestrates existing clinic features — it does not replace them.

export type ReceptionPatient = {
  id: string
  full_name: string
  phone: string | null
  file_number: string | null
  is_ortho: boolean
}

export type Procedure = {
  id: string
  code: string
  name: string
  base_fee: number | null
  category: string
}

export type TodayAppointment = {
  id: string
  scheduled_at: string
  status: string
  /** Seen patients only: what they still owe (0 when paid up). */
  balance_due?: number | null
  patient: ReceptionPatient | null
}

export type MedicalHistory = {
  allergies?: string | null
  conditions?: string | null
  medications?: string | null
  pregnant?: boolean
  notes?: string | null
}

export type PatientSafety = {
  medical_history: MedicalHistory | null
  consent_signed_at: string | null
  is_ortho: boolean
}

// What the flow keeps in view once a visit is saved.
export type SavedVisit = {
  id: string
  fee: number | null
  procedures: string[]
}

export type PaymentSummary = {
  amount: number
  method: string
  /** For printing its receipt. */
  paymentId?: string
}

// Safety flags surfaced as a persistent banner from the History step onward.
export type SafetyAlerts = {
  allergies?: string | null
  conditions?: string | null
  pregnant?: boolean
}

// The default path is Patient -> History -> Send: reception hands the patient
// to a clinic and the doctor takes it from there. Treatment and Payment remain
// reachable from the Send step for anyone who wants to finish it at the desk.
export const STEPS = [
  { key: 'identify', label: 'Patient', hint: 'Who walked in' },
  { key: 'safety', label: 'History', hint: 'Allergies & consent' },
  { key: 'send', label: 'Send', hint: 'To a clinic' },
  { key: 'visit', label: 'Treatment', hint: "Today's work" },
  { key: 'payment', label: 'Payment', hint: 'Collect & receipt' },
  { key: 'done', label: 'Done', hint: 'Wrap up' },
] as const

export type StepKey = (typeof STEPS)[number]['key']
