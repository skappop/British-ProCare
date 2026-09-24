-- Add INSERT policy for clinic_configuration
-- The calibration wizard needs to INSERT on first save (not just UPDATE)

DROP POLICY IF EXISTS "Authenticated users can insert clinic configuration" ON clinic_configuration;

CREATE POLICY "Authenticated users can insert clinic configuration"
  ON clinic_configuration
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
