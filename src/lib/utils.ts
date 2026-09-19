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
