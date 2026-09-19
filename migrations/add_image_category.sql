-- Add category column to image_records table for categorizing images
-- Run this migration in your Supabase SQL editor

-- Add category column with check constraint
ALTER TABLE image_records
ADD COLUMN IF NOT EXISTS category TEXT
CHECK (category IN ('radiograph', 'intraoral', 'document'))
DEFAULT 'intraoral';

-- Add notes column for optional metadata
ALTER TABLE image_records
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_image_records_category
ON image_records(category);

-- Add index for patient_id + category combination queries
CREATE INDEX IF NOT EXISTS idx_image_records_patient_category
ON image_records(patient_id, category);

-- Backfill existing records based on image_type
UPDATE image_records
SET category = CASE
  WHEN image_type IN ('panoramic', 'cephalometric', 'xray') THEN 'radiograph'
  WHEN image_type IN ('intraoral_front', 'intraoral_left', 'intraoral_right', 'occlusal_upper', 'occlusal_lower') THEN 'intraoral'
  ELSE 'intraoral'
END
WHERE category IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN image_records.category IS 'Image category: radiograph (X-rays/DICOM), intraoral (camera photos), or document (PDFs/forms)';
