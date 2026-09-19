import { NextResponse } from 'next/server'
import { validateSheetStructure, getSheetMetadata } from '@/lib/google-sheets'

/**
 * Validate Google Sheets connection and structure
 *
 * POST /api/admin/validate-sheet
 * Body: { spreadsheetId, range? }
 */
export async function POST(request: Request) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spreadsheetId, range } = await request.json()

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'spreadsheetId is required' },
        { status: 400 }
      )
    }

    // Get sheet metadata
    const metadata = await getSheetMetadata(spreadsheetId)

    if (!metadata.success) {
      return NextResponse.json(
        {
          success: false,
          error: metadata.error || 'Failed to access sheet. Check sharing permissions.',
        },
        { status: 400 }
      )
    }

    // Validate structure
    const validation = await validateSheetStructure(
      spreadsheetId,
      range || 'Sheet1!A1:Z1'
    )

    return NextResponse.json({
      success: validation.valid,
      error: validation.error,
      metadata: {
        title: metadata.title,
        sheetNames: metadata.sheetNames,
        headers: validation.headers,
        normalizedHeaders: validation.normalizedHeaders,
      },
    })
  } catch (error: any) {
    console.error('Validate sheet error:', error)
    return NextResponse.json(
      { error: error.message || 'Validation failed' },
      { status: 500 }
    )
  }
}
