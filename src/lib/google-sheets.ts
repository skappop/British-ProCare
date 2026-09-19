/**
 * Google Sheets Client for syncing patient data
 *
 * This module provides functions to read patient data from Google Sheets
 * and sync it into the ProCare Clinic database.
 */

import { google } from 'googleapis'

// Initialize Google Sheets API client
function getGoogleSheetsClient() {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'
  )

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}

/**
 * Fetch patient data from Google Sheets
 *
 * Expected sheet structure:
 * Row 1: Headers (Full Name, Phone, Email, Date of Birth, Gender, Notes, etc.)
 * Row 2+: Patient data
 *
 * @param spreadsheetId - The Google Sheet ID (from URL)
 * @param range - Sheet range (e.g., "Sheet1!A:Z" or "Patients!A1:H1000")
 */
export async function fetchPatientDataFromSheet(
  spreadsheetId: string,
  range: string = 'Sheet1!A:Z'
) {
  try {
    const sheets = getGoogleSheetsClient()

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return { success: false, error: 'No data found in sheet', patients: [] }
    }

    // First row is headers
    const headers = rows[0].map((h: string) => h.toLowerCase().trim())
    const dataRows = rows.slice(1)

    // Map sheet columns to patient fields
    const patients = dataRows
      .filter((row) => row.length > 0 && row[0]) // Skip empty rows
      .map((row) => {
        const patient: any = {}

        // Map common column names to database fields
        const columnMap: Record<string, string[]> = {
          full_name: ['full name', 'name', 'patient name', 'full_name', 'fullname'],
          phone: ['phone', 'phone number', 'mobile', 'contact', 'phone_number'],
          email: ['email', 'email address', 'e-mail'],
          date_of_birth: ['date of birth', 'dob', 'birth date', 'date_of_birth', 'birthdate'],
          gender: ['gender', 'sex'],
          file_number: ['file number', 'file #', 'file_number', 'patient id', 'patient_id'],
          address: ['address', 'location', 'street address'],
          notes: ['notes', 'comments', 'remarks', 'additional info'],
          is_ortho: ['ortho', 'orthodontic', 'is ortho', 'is_ortho', 'ortho case'],
        }

        // Find matching columns
        for (const [dbField, possibleNames] of Object.entries(columnMap)) {
          const colIndex = headers.findIndex((h: string) =>
            possibleNames.some((name) => h.includes(name))
          )

          if (colIndex !== -1 && row[colIndex]) {
            let value = row[colIndex].toString().trim()

            // Special handling for specific fields
            if (dbField === 'is_ortho') {
              patient[dbField] = ['yes', 'true', '1', 'y'].includes(value.toLowerCase())
            } else if (dbField === 'date_of_birth') {
              // Try to parse date
              patient[dbField] = parseDateFromSheet(value)
            } else if (dbField === 'gender') {
              // Normalize gender to M/F
              const firstChar = value.charAt(0).toUpperCase()
              if (firstChar === 'M' || firstChar === 'F') {
                patient[dbField] = firstChar
              }
            } else {
              patient[dbField] = value
            }
          }
        }

        // Add metadata
        patient.source = 'google_sheets'
        patient.sheet_row_number = dataRows.indexOf(row) + 2 // +2 because of header and 1-indexed

        return patient
      })
      .filter((p) => p.full_name) // Only include rows with a name

    return {
      success: true,
      patients,
      total: patients.length,
      headers,
    }
  } catch (error: any) {
    console.error('Google Sheets fetch error:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch from Google Sheets',
      patients: [],
    }
  }
}

/**
 * Parse date from various Google Sheets formats
 */
function parseDateFromSheet(dateStr: string): string | null {
  if (!dateStr) return null

  // Try ISO format first
  const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
  if (isoMatch) return dateStr

  // Try various common formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or DD/MM/YYYY
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY or DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
  ]

  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      try {
        // Assume MM/DD/YYYY for ambiguous dates
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]
        }
      } catch (e) {
        continue
      }
    }
  }

  return null
}

/**
 * Validate Google Sheet structure
 */
export async function validateSheetStructure(
  spreadsheetId: string,
  range: string = 'Sheet1!A1:Z1'
) {
  try {
    const sheets = getGoogleSheetsClient()

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const headers = response.data.values?.[0] || []
    const normalizedHeaders = headers.map((h: string) => h.toLowerCase().trim())

    // Check for required columns
    const hasName = normalizedHeaders.some((h: string) =>
      ['full name', 'name', 'patient name'].some((term) => h.includes(term))
    )

    if (!hasName) {
      return {
        valid: false,
        error: 'Sheet must have a "Name" or "Full Name" column',
        headers,
      }
    }

    return {
      valid: true,
      headers,
      normalizedHeaders,
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Failed to validate sheet',
      headers: [],
    }
  }
}

/**
 * Get sheet metadata (title, tab names, etc.)
 */
export async function getSheetMetadata(spreadsheetId: string) {
  try {
    const sheets = getGoogleSheetsClient()

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    })

    const metadata = response.data
    const sheetNames = metadata.sheets?.map((s) => s.properties?.title) || []

    return {
      success: true,
      title: metadata.properties?.title,
      sheetNames,
      locale: metadata.properties?.locale,
      timeZone: metadata.properties?.timeZone,
    }
  } catch (error: any) {
    console.error('Get sheet metadata error:', error)
    return {
      success: false,
      error: error.message || 'Failed to get sheet metadata',
    }
  }
}
