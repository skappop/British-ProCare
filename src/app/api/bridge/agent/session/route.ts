import { NextResponse } from 'next/server'
import { bridgeAdminClient, bridgeAuthError, missingServiceRole, noStore } from '@/lib/bridge'
import { AGENT_TRANSITIONS, FINAL_STATUSES, UUID_RE } from '@/lib/imaging'

export const dynamic = 'force-dynamic'

function count(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n < 100_000 ? n : undefined
}

/**
 * The agent reporting progress on a session: started, images captured and
 * uploaded, finished or failed. Transitions are checked against where the
 * session is now, so a delayed report cannot reopen a session the doctor
 * cancelled or undo one that already completed.
 */
export async function POST(request: Request) {
  const unauthorized = bridgeAuthError(request)
  if (unauthorized) return unauthorized

  const admin = bridgeAdminClient()
  if (!admin) return missingServiceRole()

  const body = await request.json().catch(() => null)
  const stationId: string = body?.station_id ?? ''
  const sessionId: string = body?.session_id ?? ''

  if (!UUID_RE.test(stationId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json(
      { error: 'station_id and session_id must be UUIDs' },
      { status: 400, headers: noStore }
    )
  }

  const { data: session } = await admin
    .from('imaging_sessions')
    .select('id, status, end_requested')
    .eq('id', sessionId)
    .eq('station_id', stationId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found for this station' }, { status: 404, headers: noStore })
  }

  const updates: Record<string, unknown> = {}
  const next: string | undefined = body?.status

  if (next && next !== session.status) {
    const allowed = AGENT_TRANSITIONS[session.status] ?? []
    if (!allowed.includes(next)) {
      // Not an error the agent can fix: tell it where the session actually is.
      return NextResponse.json(
        { ok: false, refused: true, status: session.status, end_requested: session.end_requested },
        { status: 409, headers: noStore }
      )
    }
    updates.status = next
    if (next === 'active') updates.started_at = new Date().toISOString()
    if ((FINAL_STATUSES as readonly string[]).includes(next)) updates.ended_at = new Date().toISOString()
  }

  for (const field of ['images_captured', 'images_uploaded', 'images_failed'] as const) {
    const n = count(body?.[field])
    if (n !== undefined) updates[field] = n
  }
  if (typeof body?.message === 'string') updates.message = body.message.slice(0, 500)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: true, status: session.status, end_requested: session.end_requested },
      { headers: noStore }
    )
  }

  const { data: updated, error } = await admin
    .from('imaging_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select('status, end_requested')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
  }

  return NextResponse.json(
    { ok: true, status: updated.status, end_requested: updated.end_requested },
    { headers: noStore }
  )
}
