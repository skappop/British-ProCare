import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPatientDataFromSheet } from '@/lib/google-sheets'

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

/**
 * Sync patients from Google Sheets to database
 *
 * POST /api/admin/sync-sheets
 * Body: { spreadsheetId, range?, forceUpdate? }
 */
export async function POST(request: Request) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spreadsheetId, range, forceUpdate } = await request.json()

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'spreadsheetId is required' },
        { status: 400 }
      )
    }

    // Fetch data from Google Sheets
    const sheetResult = await fetchPatientDataFromSheet(
      spreadsheetId,
      range || 'Sheet1!A:Z'
    )

    if (!sheetResult.success) {
      return NextResponse.json(
        { error: sheetResult.error },
        { status: 500 }
      )
    }

    const sheetPatients = sheetResult.patients

    // Sync logic: Update existing or create new patients
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      total: sheetPatients.length,
    }

    for (const sheetPatient of sheetPatients) {
      try {
        // Try to find existing patient by name + phone (or just name)
        let existingPatient = null

        if (sheetPatient.phone) {
          const { data } = await supabase
            .from('patients')
            .select('*')
            .eq('full_name', sheetPatient.full_name)
            .eq('phone', sheetPatient.phone)
            .single()
          existingPatient = data
        }

        // If not found by phone, try by name only (less reliable)
        if (!existingPatient) {
          const { data } = await supabase
            .from('patients')
            .select('*')
            .ilike('full_name', sheetPatient.full_name)
            .limit(1)
            .single()
          existingPatient = data
        }

        if (existingPatient) {
          // Patient exists - update only if forceUpdate is true
          // OR if specific fields are empty in database but present in sheet
          const shouldUpdate = forceUpdate || needsUpdate(existingPatient, sheetPatient)

          if (shouldUpdate) {
            const updateData = buildUpdateData(existingPatient, sheetPatient, forceUpdate)

            const { error } = await supabase
              .from('patients')
              .update(updateData)
              .eq('id', existingPatient.id)

            if (error) {
              results.errors.push(`Update failed for ${sheetPatient.full_name}: ${error.message}`)
            } else {
              results.updated++
            }
          } else {
            results.skipped++
          }
        } else {
          // New patient - create
          const insertData = {
            full_name: sheetPatient.full_name,
            phone: sheetPatient.phone || null,
            email: sheetPatient.email || null,
            date_of_birth: sheetPatient.date_of_birth || null,
            gender: sheetPatient.gender || null,
            file_number: sheetPatient.file_number || null,
            address: sheetPatient.address || null,
            notes: sheetPatient.notes || null,
            is_ortho: sheetPatient.is_ortho || false,
            synced_from_sheets: true,
            sheet_row_number: sheetPatient.sheet_row_number,
          }

          const { error } = await supabase
            .from('patients')
            .insert(insertData)

          if (error) {
            results.errors.push(`Insert failed for ${sheetPatient.full_name}: ${error.message}`)
          } else {
            results.created++
          }
        }
      } catch (error: any) {
        results.errors.push(`Error processing ${sheetPatient.full_name}: ${error.message}`)
      }
    }

    // Store sync metadata
    await supabase.from('sheet_sync_logs').insert({
      spreadsheet_id: spreadsheetId,
      range,
      patients_created: results.created,
      patients_updated: results.updated,
      patients_skipped: results.skipped,
      total_patients: results.total,
      errors: results.errors.length > 0 ? results.errors : null,
      synced_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}

/**
 * Check if patient record needs updating
 */
function needsUpdate(existingPatient: any, sheetPatient: any): boolean {
  // Update if sheet has data that database doesn't
  const fields = ['phone', 'email', 'date_of_birth', 'gender', 'address', 'file_number']

  for (const field of fields) {
    if (!existingPatient[field] && sheetPatient[field]) {
      return true
    }
  }

  return false
}

/**
 * Build update data - only update empty fields unless forceUpdate is true
 */
function buildUpdateData(existingPatient: any, sheetPatient: any, forceUpdate: boolean) {
  const updateData: any = {
    updated_at: new Date().toISOString(),
    synced_from_sheets: true,
    sheet_row_number: sheetPatient.sheet_row_number,
  }

  const fields = ['phone', 'email', 'date_of_birth', 'gender', 'address', 'file_number', 'notes', 'is_ortho']

  for (const field of fields) {
    if (forceUpdate && sheetPatient[field]) {
      // Force update: overwrite with sheet data
      updateData[field] = sheetPatient[field]
    } else if (!existingPatient[field] && sheetPatient[field]) {
      // Smart update: only fill empty fields
      updateData[field] = sheetPatient[field]
    }
  }

  return updateData
}

/**
 * Get sync status and history
 *
 * GET /api/admin/sync-sheets
 */
export async function GET(request: Request) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent sync logs
    const { data: logs, error } = await supabase
      .from('sheet_sync_logs')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get count of patients synced from sheets
    const { count } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('synced_from_sheets', true)

    return NextResponse.json({
      success: true,
      logs,
      totalSyncedPatients: count || 0,
    })
  } catch (error: any) {
    console.error('Get sync status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
