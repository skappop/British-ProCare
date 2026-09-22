-- Image records table for storing patient images from all sources
-- (manual uploads, Osstem bridge, Dental Agent)

CREATE TABLE IF NOT EXISTS image_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  image_type TEXT NOT NULL,
  category TEXT CHECK (category IN ('radiograph', 'intraoral', 'document')) DEFAULT 'intraoral',
  is_baseline BOOLEAN DEFAULT false,
  notes TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'manual', -- 'manual', 'osstem-bridge', 'dental-agent'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_records_patient_id ON image_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_image_records_category ON image_records(category);
CREATE INDEX IF NOT EXISTS idx_image_records_patient_category ON image_records(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_image_records_taken_at ON image_records(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_records_source ON image_records(source);

-- RLS policies
ALTER TABLE image_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON image_records
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE image_records IS 'Stores all patient images from manual uploads, hardware bridges, and dental agent';
COMMENT ON COLUMN image_records.category IS 'Image category: radiograph (X-rays/DICOM), intraoral (camera photos), or document (PDFs/forms)';
COMMENT ON COLUMN image_records.source IS 'Upload source: manual (web upload), osstem-bridge (Osstem hardware), dental-agent (Python desktop agent)';
COMMENT ON COLUMN image_records.metadata IS 'Additional metadata like device info, capture settings, file counts, etc.';
