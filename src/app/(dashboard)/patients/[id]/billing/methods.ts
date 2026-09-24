// How a patient can pay. Shared by the Billing page and the walk-in flow.
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'instapay', label: 'InstaPay' },
  { value: 'bank_transfer', label: 'Bank transfer' },
] as const

export function methodLabel(value: string, note?: string | null): string {
  const known = PAYMENT_METHODS.find((m) => m.value === value)?.label
  if (known) return known
  // Stored as "other" when the database did not know the method; the real
  // one is the first part of the note.
  const fromNote = note?.split(' — ')[0]
  return PAYMENT_METHODS.find((m) => m.label === fromNote)?.label ?? 'Other'
}
