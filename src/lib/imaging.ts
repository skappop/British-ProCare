// Shared by the website's imaging panel and the agent-facing bridge routes.

export const OPEN_STATUSES = ['requested', 'active', 'uploading'] as const
export const FINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const

export type ImagingStatus = (typeof OPEN_STATUSES)[number] | (typeof FINAL_STATUSES)[number]
export type ImagingMode = 'intraoral' | 'xray' | 'both'

// A station that has not reported in this long is treated as offline. The
// agent polls every few seconds, so this allows for a couple of missed polls.
export const STATION_ONLINE_MS = 20_000

// Which status an agent may move a session to from where it is now. Anything
// else is refused, so a late or duplicated report cannot resurrect a session
// the doctor has already cancelled or that has already finished.
export const AGENT_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ['active', 'failed'],
  active: ['active', 'uploading', 'completed', 'failed'],
  uploading: ['uploading', 'completed', 'failed'],
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
