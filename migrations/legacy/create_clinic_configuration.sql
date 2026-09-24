-- Create clinic_configuration table for storing system calibration settings
CREATE TABLE IF NOT EXISTS clinic_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Practice profile
  practice_type TEXT CHECK (practice_type IN ('general', 'orthodontics', 'mixed', 'cosmetic')) DEFAULT 'general',

  -- Patient intake configuration
  patient_intake_method TEXT CHECK (patient_intake_method IN ('google_sheets', 'manual', 'direct')) DEFAULT 'manual',
  google_sheets_enabled BOOLEAN DEFAULT false,
  google_sheets_url TEXT,
  google_sheets_last_sync TIMESTAMPTZ,

  -- Imaging hardware configuration
  imaging_hardware TEXT CHECK (imaging_hardware IN ('osstem', 'twain', 'manual', 'none')) DEFAULT 'manual',
  osstem_enabled BOOLEAN DEFAULT false,
  osstem_folders JSONB DEFAULT '[]'::jsonb,

  -- Feature toggles
  features_enabled JSONB DEFAULT '{
    "appointments": true,
    "recall": true,
    "inventory": true,
    "lab_cases": true,
    "staff": true,
    "reports": true
  }'::jsonb,

  -- Navigation customization
  navigation_order JSONB DEFAULT '[]'::jsonb,

  -- Workflow preferences
  use_file_numbers BOOLEAN DEFAULT true,
  default_appointment_duration INTEGER DEFAULT 30, -- minutes
  require_appointment_confirmation BOOLEAN DEFAULT false,

  -- Staff size (affects feature visibility)
  staff_size TEXT CHECK (staff_size IN ('solo', 'small', 'medium', 'large')) DEFAULT 'small',

  -- Calibration metadata
  is_calibrated BOOLEAN DEFAULT false,
  last_calibrated_at TIMESTAMPTZ,
  calibrated_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one configuration row (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_config_singleton ON clinic_configuration ((1));

-- Index for quick feature lookups
CREATE INDEX IF NOT EXISTS idx_clinic_config_features ON clinic_configuration USING gin(features_enabled);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clinic_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_clinic_configuration_updated_at
  BEFORE UPDATE ON clinic_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_clinic_configuration_updated_at();

-- Insert default configuration if none exists
INSERT INTO clinic_configuration (is_calibrated)
VALUES (false)
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
ALTER TABLE clinic_configuration ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read configuration
CREATE POLICY "Anyone can read clinic configuration"
  ON clinic_configuration
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can update configuration
CREATE POLICY "Authenticated users can update clinic configuration"
  ON clinic_configuration
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
