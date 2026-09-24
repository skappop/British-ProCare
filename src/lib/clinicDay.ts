// The clinic's calendar day. The server runs on UTC, so "today" computed with
// the server's clock would start at 2–3 AM Egypt time; this uses Cairo time.

export const CLINIC_TIME_ZONE = 'Africa/Cairo'

/** Start (inclusive) and end (exclusive) of the clinic's day containing `at`. */
export function clinicDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const wallClock = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  const offset = Math.round((wallClock - at.getTime()) / 60_000) * 60_000
  const start = Date.UTC(n('year'), n('month') - 1, n('day')) - offset
  return { start: new Date(start), end: new Date(start + 24 * 3600_000) }
}
