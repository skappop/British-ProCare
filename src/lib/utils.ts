import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A sub-100ms server action flashes a spinner for a single frame — worse
// feedback than none. This floors the visible loading state so it always
// reads as a legible state change.
export async function withMinDuration<T>(promise: Promise<T>, minMs: number): Promise<T> {
  const start = Date.now()
  const result = await promise
  const remaining = minMs - (Date.now() - start)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  return result
}

/**
 * A date and time typed into the clinic's form, as an exact instant. Must run
 * in the browser: the server runs on UTC, so building the Date there stored a
 * 3 pm booking as 3 pm UTC — shown as 5 or 6 pm in Egypt.
 */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
