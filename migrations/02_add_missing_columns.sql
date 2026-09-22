-- Add missing columns to existing image_records table
-- Run this if you get "column does not exist" errors

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'image_records' AND column_name = 'category'
  ) THEN
    ALTER TABLE image_records
    ADD COLUMN category TEXT CHECK (category IN ('radiograph', 'intraoral', 'document')) DEFAULT 'intraoral';
  END IF;
END $$;

-- Add source column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'image_records' AND column_name = 'source'
  ) THEN
    ALTER TABLE image_records
    ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'image_records' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE image_records
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add taken_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'image_records' AND column_name = 'taken_at'
  ) THEN
    ALTER TABLE image_records
    ADD COLUMN taken_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add uploaded_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'image_records' AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE image_records
    ADD COLUMN uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_image_records_patient_id ON image_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_image_records_category ON image_records(category);
CREATE INDEX IF NOT EXISTS idx_image_records_patient_category ON image_records(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_image_records_taken_at ON image_records(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_records_source ON image_records(source);

-- Add comments
COMMENT ON COLUMN image_records.category IS 'Image category: radiograph (X-rays/DICOM), intraoral (camera photos), or document (PDFs/forms)';
COMMENT ON COLUMN image_records.source IS 'Upload source: manual (web upload), osstem-bridge (Osstem hardware), dental-agent (Python desktop agent)';
COMMENT ON COLUMN image_records.metadata IS 'Additional metadata like device info, capture settings, file counts, etc.';
