import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET: Fetch current clinic configuration
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: config, error } = await supabase
      .from('clinic_configuration')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching configuration:', error)
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Save/update clinic configuration
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('Received calibration data:', body)

    // Check if a config row already exists
    const { data: existingConfig } = await supabase
      .from('clinic_configuration')
      .select('id')
      .single()

    let result
    if (existingConfig) {
      // Update existing row
      console.log('Updating existing config:', existingConfig.id)
      result = await supabase
        .from('clinic_configuration')
        .update({
          ...body,
          is_calibrated: true,
          last_calibrated_at: new Date().toISOString(),
          calibrated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConfig.id)
        .select()
        .single()
    } else {
      // Insert new row
      console.log('Inserting new config')
      result = await supabase
        .from('clinic_configuration')
        .insert({
          ...body,
          is_calibrated: true,
          last_calibrated_at: new Date().toISOString(),
          calibrated_by: user.id,
        })
        .select()
        .single()
    }

    const { data: config, error } = result

    if (error) {
      console.error('Error saving configuration:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to save configuration', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    console.log('Configuration saved successfully:', config)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
