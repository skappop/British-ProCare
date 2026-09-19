-- Add columns to track Google Sheets sync status
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS synced_from_sheets BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sheet_row_number INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for faster queries on synced patients
CREATE INDEX IF NOT EXISTS idx_patients_synced_from_sheets
ON patients(synced_from_sheets);

-- Create table to track sync history
CREATE TABLE IF NOT EXISTS sheet_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id TEXT NOT NULL,
  range TEXT,
  patients_created INTEGER DEFAULT 0,
  patients_updated INTEGER DEFAULT 0,
  patients_skipped INTEGER DEFAULT 0,
  total_patients INTEGER DEFAULT 0,
  errors TEXT[],
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on synced_at for faster history queries
CREATE INDEX IF NOT EXISTS idx_sheet_sync_logs_synced_at
ON sheet_sync_logs(synced_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN patients.synced_from_sheets IS 'Whether this patient was imported from Google Sheets';
COMMENT ON COLUMN patients.sheet_row_number IS 'Row number in the source Google Sheet (for debugging)';
COMMENT ON TABLE sheet_sync_logs IS 'Audit log of Google Sheets sync operations';
