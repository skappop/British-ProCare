import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPatientDataFromSheet } from '@/lib/google-sheets'

// Created per request, not when the file loads: building the site must not
// need the Supabase keys (Cloudflare and other hosts build without them).
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
  )
}

/**
 * Scheduled sync endpoint for cron jobs
 *
 * GET /api/cron/sync-sheets
 *
 * Automatically syncs patients from configured Google Sheet
 * Trigger via Vercel Cron or external scheduler
 */
export async function GET(request: Request) {
  const supabase = serviceClient()
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get configured spreadsheet ID from environment or database
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    const range = process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:Z'

    if (!spreadsheetId) {
      console.log('No spreadsheet configured for automatic sync')
      return NextResponse.json({
        success: true,
        message: 'No spreadsheet configured',
      })
    }

    console.log(`Starting scheduled sync for sheet: ${spreadsheetId}`)

    // Fetch data from Google Sheets
    const sheetResult = await fetchPatientDataFromSheet(spreadsheetId, range)

    if (!sheetResult.success) {
      console.error('Sheet fetch failed:', sheetResult.error)
      return NextResponse.json(
        { error: sheetResult.error },
        { status: 500 }
      )
    }

    const sheetPatients = sheetResult.patients

    // Sync logic: Smart update (only fill empty fields)
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      total: sheetPatients.length,
    }

    for (const sheetPatient of sheetPatients) {
      try {
        // Try to find existing patient by name + phone
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

        if (!existingPatient && sheetPatient.email) {
          const { data } = await supabase
            .from('patients')
            .select('*')
            .eq('full_name', sheetPatient.full_name)
            .eq('email', sheetPatient.email)
            .single()
          existingPatient = data
        }

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
          // Check if update needed
          const updateData: any = {
            updated_at: new Date().toISOString(),
            synced_from_sheets: true,
            sheet_row_number: sheetPatient.sheet_row_number,
          }

          let needsUpdate = false
          const fields = ['phone', 'email', 'date_of_birth', 'gender', 'address', 'file_number']

          for (const field of fields) {
            if (!existingPatient[field] && sheetPatient[field]) {
              updateData[field] = sheetPatient[field]
              needsUpdate = true
            }
          }

          if (needsUpdate) {
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

          const { error } = await supabase.from('patients').insert(insertData)

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

    console.log('Scheduled sync completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
    })
  } catch (error: any) {
    console.error('Scheduled sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
