import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Active patient expires after this long without a refresh from the web app.
const ACTIVE_TTL_MS = 10 * 60 * 1000

const DEFAULT_STATION = 'default'

// The bridge and the desktop agent authenticate with BRIDGE_API_KEY, not with a
// Supabase session, so reads on their behalf go through the service role.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !key) return null

  return createClient(url, key)
}

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiKey = process.env.BRIDGE_API_KEY

  // Validate bridge service authentication
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  }

  const admin = adminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500, headers: noStore }
    )
  }

  const station = new URL(request.url).searchParams.get('station') || DEFAULT_STATION

  const { data: row, error } = await admin
    .from('active_patient')
    .select('patient_id, last_activity')
    .eq('station', station)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Failed to read active patient: ${error.message}` },
      { status: 500, headers: noStore }
    )
  }

  const lastActivity = row?.last_activity ? new Date(row.last_activity).getTime() : 0
  const expired = !lastActivity || Date.now() - lastActivity > ACTIVE_TTL_MS
  const patientId = expired ? null : row?.patient_id ?? null

  let patientName: string | null = null
  if (patientId) {
    const { data: patient } = await admin
      .from('patients')
      .select('full_name')
      .eq('id', patientId)
      .maybeSingle()

    patientName = patient?.full_name ?? null
  }

  return NextResponse.json(
    {
      patient_id: patientId,
      patient_name: patientName,
      last_activity: lastActivity || null,
      station,
    },
    { headers: noStore }
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createUserClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
    }

    const admin = adminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
        { status: 500, headers: noStore }
      )
    }

    const body = await request.json().catch(() => ({}))
    const patientId: string | null = body?.patient_id ?? null
    const station: string = body?.station || DEFAULT_STATION

    // A null patient_id clears the slot, so the bridge stops linking captures.
    if (patientId) {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('id', patientId)
        .maybeSingle()

      if (patientError || !patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: noStore })
      }
    }

    const { error: writeError } = await admin
      .from('active_patient')
      .upsert(
        {
          station,
          patient_id: patientId,
          set_by: user.id,
          last_activity: new Date().toISOString(),
        },
        { onConflict: 'station' }
      )

    if (writeError) {
      return NextResponse.json(
        { error: `Failed to set active patient: ${writeError.message}` },
        { status: 500, headers: noStore }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        patient_id: patientId,
        station,
        message: patientId ? 'Active patient set' : 'Active patient cleared',
      },
      { headers: noStore }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: noStore })
  }
}
