import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// In-memory store for active patient (in production, use Redis)
let activePatientId: string | null = null
let lastActivity = Date.now()

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiKey = process.env.BRIDGE_API_KEY

  // Validate bridge service authentication
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Clear active patient if no activity for 10 minutes
  if (Date.now() - lastActivity > 10 * 60 * 1000) {
    activePatientId = null
  }

  return NextResponse.json({
    patient_id: activePatientId,
    last_activity: lastActivity,
  })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { patient_id } = await request.json()

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }

    // Verify patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    activePatientId = patient_id
    lastActivity = Date.now()

    return NextResponse.json({
      ok: true,
      patient_id: activePatientId,
      message: 'Active patient set'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
