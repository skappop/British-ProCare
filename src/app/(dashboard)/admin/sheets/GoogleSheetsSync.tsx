'use client'

import { useState, useTransition } from 'react'

type SyncLog = {
  id: string
  spreadsheet_id: string
  patients_created: number
  patients_updated: number
  patients_skipped: number
  total_patients: number
  errors: string[] | null
  synced_at: string
}

export default function GoogleSheetsSync() {
  const [isPending, startTransition] = useTransition()
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [range, setRange] = useState('Sheet1!A:Z')
  const [forceUpdate, setForceUpdate] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [totalSynced, setTotalSynced] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  // Load sync history on mount
  useState(() => {
    loadSyncHistory()
  })

  async function loadSyncHistory() {
    try {
      const res = await fetch('/api/admin/sync-sheets', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
        setTotalSynced(data.totalSyncedPatients || 0)
      }
    } catch (error) {
      console.error('Failed to load sync history:', error)
    }
  }

  async function handleValidate() {
    if (!spreadsheetId.trim()) {
      setResult({ ok: false, message: 'Please enter a Spreadsheet ID' })
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/validate-sheet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          },
          body: JSON.stringify({ spreadsheetId, range }),
        })

        const data = await res.json()

        if (data.success) {
          setValidationResult(data)
          setResult({
            ok: true,
            message: `✓ Sheet validated: "${data.metadata?.title}"`,
          })
        } else {
          setValidationResult(null)
          setResult({ ok: false, message: data.error || 'Validation failed' })
        }
      } catch (error: any) {
        setValidationResult(null)
        setResult({ ok: false, message: error.message || 'Validation failed' })
      }
    })
  }

  async function handleSync() {
    if (!spreadsheetId.trim()) {
      setResult({ ok: false, message: 'Please enter a Spreadsheet ID' })
      return
    }

    const confirmed = confirm(
      forceUpdate
        ? '⚠️ Force Update will overwrite existing patient data with sheet data. Continue?'
        : 'This will sync patients from Google Sheets. Continue?'
    )

    if (!confirmed) return

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/sync-sheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          },
          body: JSON.stringify({ spreadsheetId, range, forceUpdate }),
        })

        const data = await res.json()

        if (data.success) {
          setResult({
            ok: true,
            message: `✓ Sync complete: ${data.results.created} created, ${data.results.updated} updated, ${data.results.skipped} skipped`,
            details: data.results,
          })
          loadSyncHistory()
        } else {
          setResult({ ok: false, message: data.error || 'Sync failed' })
        }
      } catch (error: any) {
        setResult({ ok: false, message: error.message || 'Sync failed' })
      }
    })
  }

  function extractSheetIdFromUrl(url: string) {
    // Extract sheet ID from Google Sheets URL
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) {
      setSpreadsheetId(match[1])
      setResult({ ok: true, message: '✓ Sheet ID extracted from URL' })
    } else {
      setResult({ ok: false, message: 'Invalid Google Sheets URL' })
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-strong mb-2">
          Google Sheets Integration
        </h1>
        <p className="text-sm text-ink/60">
          Sync patient data from your Google Forms/Sheets into ProCare Clinic
        </p>
      </div>

      {/* Configuration Card */}
      <div className="bg-white rounded-card shadow-soft p-6 space-y-4">
        <h2 className="font-medium text-ink-strong">Sheet Configuration</h2>

        {result && (
          <div
            className={`text-sm px-4 py-3 rounded-control ${
              result.ok
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {result.message}
            {result.details && result.details.errors && result.details.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">View errors ({result.details.errors.length})</summary>
                <ul className="mt-2 text-xs space-y-1">
                  {result.details.errors.map((err: string, i: number) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Google Sheets URL or ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => {
                const val = e.target.value
                if (val.includes('docs.google.com/spreadsheets')) {
                  extractSheetIdFromUrl(val)
                } else {
                  setSpreadsheetId(val)
                }
              }}
              placeholder="Paste full URL or just the spreadsheet ID"
              className="flex-1 rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <p className="text-xs text-ink/50">
            Example: https://docs.google.com/spreadsheets/d/<strong>1A2B3C...</strong>/edit
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/70">Range (optional)</label>
          <input
            type="text"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder="Sheet1!A:Z"
            className="w-full rounded-control border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <p className="text-xs text-ink/50">
            Specify sheet name and columns (e.g., "Patients!A:H" or "Form Responses 1!A:Z")
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={forceUpdate}
            onChange={(e) => setForceUpdate(e.target.checked)}
            className="rounded"
          />
          Force Update (overwrite existing data)
        </label>

        {validationResult && (
          <div className="bg-marble/60 rounded-control p-4 space-y-2">
            <p className="text-sm font-medium text-ink-strong">
              📄 {validationResult.metadata?.title}
            </p>
            <p className="text-xs text-ink/60">
              Sheets: {validationResult.metadata?.sheetNames?.join(', ')}
            </p>
            <details>
              <summary className="text-xs text-ink/60 cursor-pointer">
                View detected columns ({validationResult.metadata?.headers?.length})
              </summary>
              <div className="mt-2 text-xs text-ink/50">
                {validationResult.metadata?.headers?.map((h: string, i: number) => (
                  <span key={i} className="inline-block bg-white px-2 py-1 rounded mr-2 mb-2">
                    {h}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={isPending || !spreadsheetId.trim()}
            className="bg-ink/10 hover:bg-ink/15 disabled:bg-ink/5 text-ink-strong text-sm px-4 py-2 rounded-control transition-colors"
          >
            {isPending ? 'Validating...' : 'Validate Sheet'}
          </button>

          <button
            onClick={handleSync}
            disabled={isPending || !spreadsheetId.trim()}
            className="bg-teal hover:bg-teal-deep disabled:bg-ink/20 text-white text-sm px-4 py-2 rounded-control transition-colors"
          >
            {isPending ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-card shadow-soft p-6">
        <h2 className="font-medium text-ink-strong mb-4">Sync Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-teal-deep">{totalSynced}</p>
            <p className="text-xs text-ink/60">Patients from Sheets</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink-strong">{logs.length}</p>
            <p className="text-xs text-ink/60">Total Syncs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink-strong">
              {logs[0]
                ? new Date(logs[0].synced_at).toLocaleDateString()
                : '—'}
            </p>
            <p className="text-xs text-ink/60">Last Sync</p>
          </div>
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-card shadow-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-ink-strong">Sync History</h2>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-sm text-teal-deep hover:underline"
          >
            {showLogs ? 'Hide' : 'Show'} logs
          </button>
        </div>

        {showLogs && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-ink/10 rounded-control p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-strong">
                    {new Date(log.synced_at).toLocaleString()}
                  </p>
                  <span className="text-xs bg-teal/10 text-teal-deep px-2 py-1 rounded-full">
                    {log.total_patients} total
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-ink/60">
                  <span>✓ {log.patients_created} created</span>
                  <span>↻ {log.patients_updated} updated</span>
                  <span>− {log.patients_skipped} skipped</span>
                </div>
                {log.errors && log.errors.length > 0 && (
                  <details className="text-xs text-danger">
                    <summary className="cursor-pointer">
                      {log.errors.length} errors
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {log.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {showLogs && logs.length === 0 && (
          <p className="text-sm text-ink/40 text-center py-4">No sync history yet</p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-marble/40 rounded-card p-6 space-y-3 text-sm">
        <h3 className="font-medium text-ink-strong">Setup Instructions</h3>
        <ol className="space-y-2 text-ink/70 list-decimal list-inside">
          <li>
            Create a Google Service Account and download credentials JSON
            <a
              href="https://console.cloud.google.com/iam-admin/serviceaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-deep hover:underline ml-1"
            >
              (Google Cloud Console)
            </a>
          </li>
          <li>
            Share your Google Sheet with the service account email (Viewer access)
          </li>
          <li>
            Add <code className="bg-white px-2 py-0.5 rounded text-xs">GOOGLE_SERVICE_ACCOUNT_JSON</code> to your .env.local
          </li>
          <li>Ensure your sheet has a "Full Name" or "Name" column (required)</li>
          <li>Click "Validate Sheet" to test the connection</li>
          <li>Click "Sync Now" to import patients</li>
        </ol>
        <div className="mt-4 p-3 bg-white rounded text-xs">
          <p className="font-medium text-ink-strong mb-1">Expected Sheet Structure:</p>
          <code className="text-ink/60">
            Full Name | Phone | Email | Date of Birth | Gender | File Number | Notes
          </code>
        </div>
      </div>
    </div>
  )
}
