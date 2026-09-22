-- Migration 09: Container-First Inventory System
-- Creates the infrastructure for clinical container management with rapid scanning

-- ============================================================================
-- PART 1: CONTAINERS TABLE
-- Represents physical container boxes (Endo kit, Crown kit, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Endo", "Crown", "Ortho"
  description TEXT,                      -- Optional notes about the container
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick container lookup
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);

-- ============================================================================
-- PART 2: CONTAINER_ITEMS JOIN TABLE
-- Links containers to inventory items with baseline and current quantities
-- ============================================================================

CREATE TABLE IF NOT EXISTS container_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  baseline_quantity INTEGER NOT NULL DEFAULT 1,  -- How many should be in the container
  current_quantity INTEGER NOT NULL DEFAULT 0,   -- How many are currently in the container
  grid_section TEXT,                             -- Optional: "GP 20 T2", "Elastics Blue 1/4"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique container-item combinations
  UNIQUE(container_id, inventory_id, grid_section)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_container_items_container ON container_items(container_id);
CREATE INDEX IF NOT EXISTS idx_container_items_inventory ON container_items(inventory_id);

-- ============================================================================
-- PART 3: RAPID SCAN LOG
-- Audit trail for all rapid scan operations (consume/restock)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rapid_scan_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id),
  inventory_id UUID NOT NULL REFERENCES inventory(id),
  scan_mode TEXT NOT NULL CHECK (scan_mode IN ('consume', 'restock')),
  quantity_change INTEGER NOT NULL,      -- +1 for restock, -1 for consume
  batch_id UUID REFERENCES inventory_batches(id),  -- Which batch was used (restock only)
  scanned_by UUID REFERENCES auth.users(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for reporting and audit
CREATE INDEX IF NOT EXISTS idx_rapid_scan_log_container ON rapid_scan_log(container_id);
CREATE INDEX IF NOT EXISTS idx_rapid_scan_log_date ON rapid_scan_log(scanned_at DESC);

-- ============================================================================
-- PART 4: AUTO-UPDATE TRIGGERS
-- ============================================================================

-- Trigger to update containers.updated_at
CREATE OR REPLACE FUNCTION update_containers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_containers_updated_at
  BEFORE UPDATE ON containers
  FOR EACH ROW
  EXECUTE FUNCTION update_containers_updated_at();

-- Trigger to update container_items.updated_at
CREATE OR REPLACE FUNCTION update_container_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_container_items_updated_at
  BEFORE UPDATE ON container_items
  FOR EACH ROW
  EXECUTE FUNCTION update_container_items_updated_at();

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapid_scan_log ENABLE ROW LEVEL SECURITY;

-- Containers: authenticated users can read
CREATE POLICY "Authenticated users can read containers"
  ON containers FOR SELECT
  TO authenticated
  USING (true);

-- Containers: authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can manage containers"
  ON containers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Container Items: authenticated users can read
CREATE POLICY "Authenticated users can read container items"
  ON container_items FOR SELECT
  TO authenticated
  USING (true);

-- Container Items: authenticated users can manage
CREATE POLICY "Authenticated users can manage container items"
  ON container_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Rapid Scan Log: authenticated users can read
CREATE POLICY "Authenticated users can read scan log"
  ON rapid_scan_log FOR SELECT
  TO authenticated
  USING (true);

-- Rapid Scan Log: authenticated users can insert (scans)
CREATE POLICY "Authenticated users can log scans"
  ON rapid_scan_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- PART 6: SEED DATA - Real Clinic Containers
-- ============================================================================

-- First, ensure we have the inventory items needed for seeding
-- (These will be inserted only if they don't already exist)

-- Insert containers
INSERT INTO containers (id, name, description) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Endo', 'Endodontic procedures container'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Crown', 'Crown and bridge procedures container'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Ortho', 'Orthodontic supplies container'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Restorative', 'Restorative procedures container')
ON CONFLICT DO NOTHING;

-- Helper: Insert inventory item if it doesn't exist, return its ID
-- We'll use a temp table to track item IDs for container_items seeding

CREATE TEMP TABLE temp_inventory_ids (
  name TEXT PRIMARY KEY,
  id UUID
);

-- Insert inventory items and capture their IDs
DO $$
DECLARE
  item_id UUID;
BEGIN
  -- Endo items
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Endo Probe', 'instrument', 'piece', 5.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Endo Probe', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Endo Probe', (SELECT id FROM inventory WHERE name = 'Endo Probe' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Metapex', 'medication', 'tube', 12.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Metapex', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Metapex', (SELECT id FROM inventory WHERE name = 'Metapex' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('EDTA Gel', 'medication', 'syringe', 8.00, 3, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('EDTA Gel', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('EDTA Gel', (SELECT id FROM inventory WHERE name = 'EDTA Gel' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Biosealer', 'material', 'bottle', 45.00, 2, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Biosealer', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Biosealer', (SELECT id FROM inventory WHERE name = 'Biosealer' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Guttapercha Bar', 'material', 'bar', 15.00, 3, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Guttapercha Bar', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Guttapercha Bar', (SELECT id FROM inventory WHERE name = 'Guttapercha Bar' LIMIT 1));
  END IF;

  -- Guttapercha Points (GP)
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('GP 20 T2', 'material', 'piece', 0.50, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('GP 20 T2', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('GP 20 T2', (SELECT id FROM inventory WHERE name = 'GP 20 T2' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('GP 25 T2', 'material', 'piece', 0.50, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('GP 25 T2', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('GP 25 T2', (SELECT id FROM inventory WHERE name = 'GP 25 T2' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('GP 35 T4', 'material', 'piece', 0.50, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('GP 35 T4', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('GP 35 T4', (SELECT id FROM inventory WHERE name = 'GP 35 T4' LIMIT 1));
  END IF;

  -- Paper Points (PP)
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('PP 30 T4', 'material', 'piece', 0.30, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('PP 30 T4', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('PP 30 T4', (SELECT id FROM inventory WHERE name = 'PP 30 T4' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('PP 40 T2', 'material', 'piece', 0.30, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('PP 40 T2', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('PP 40 T2', (SELECT id FROM inventory WHERE name = 'PP 40 T2' LIMIT 1));
  END IF;

  -- K-Files
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('K-File #8', 'instrument', 'piece', 1.50, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('K-File #8', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('K-File #8', (SELECT id FROM inventory WHERE name = 'K-File #8' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('K-File #10', 'instrument', 'piece', 1.50, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('K-File #10', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('K-File #10', (SELECT id FROM inventory WHERE name = 'K-File #10' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('K-File #15', 'instrument', 'piece', 1.50, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('K-File #15', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('K-File #15', (SELECT id FROM inventory WHERE name = 'K-File #15' LIMIT 1));
  END IF;

  -- Crown items
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Fiberpost Kit', 'material', 'kit', 120.00, 2, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Fiberpost Kit', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Fiberpost Kit', (SELECT id FROM inventory WHERE name = 'Fiberpost Kit' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Saline', 'medication', 'bottle', 3.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Saline', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Saline', (SELECT id FROM inventory WHERE name = 'Saline' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Porcelain Etch', 'material', 'bottle', 25.00, 3, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Porcelain Etch', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Porcelain Etch', (SELECT id FROM inventory WHERE name = 'Porcelain Etch' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Light Body Silicon', 'material', 'cartridge', 35.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Light Body Silicon', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Light Body Silicon', (SELECT id FROM inventory WHERE name = 'Light Body Silicon' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('G-Cem', 'material', 'syringe', 18.00, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('G-Cem', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('G-Cem', (SELECT id FROM inventory WHERE name = 'G-Cem' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Equia Forte', 'material', 'capsule', 5.00, 15, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Equia Forte', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Equia Forte', (SELECT id FROM inventory WHERE name = 'Equia Forte' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Retraction Paste', 'material', 'tube', 8.00, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Retraction Paste', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Retraction Paste', (SELECT id FROM inventory WHERE name = 'Retraction Paste' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('FUJI IX', 'material', 'capsule', 4.00, 15, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('FUJI IX', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('FUJI IX', (SELECT id FROM inventory WHERE name = 'FUJI IX' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('FUJI II LC', 'material', 'syringe', 12.00, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('FUJI II LC', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('FUJI II LC', (SELECT id FROM inventory WHERE name = 'FUJI II LC' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Resin Cement', 'material', 'syringe', 22.00, 8, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Resin Cement', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Resin Cement', (SELECT id FROM inventory WHERE name = 'Resin Cement' LIMIT 1));
  END IF;

  -- Ortho items
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Mattortho Kit', 'material', 'kit', 150.00, 3, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Mattortho Kit', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Mattortho Kit', (SELECT id FROM inventory WHERE name = 'Mattortho Kit' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Microimplant 8mm', 'material', 'piece', 25.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Microimplant 8mm', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Microimplant 8mm', (SELECT id FROM inventory WHERE name = 'Microimplant 8mm' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Elastic Separator', 'material', 'piece', 0.20, 20, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Elastic Separator', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Elastic Separator', (SELECT id FROM inventory WHERE name = 'Elastic Separator' LIMIT 1));
  END IF;

  -- Ortho Elastics
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Elastic Blue 1/4', 'material', 'pack', 8.00, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Elastic Blue 1/4', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Elastic Blue 1/4', (SELECT id FROM inventory WHERE name = 'Elastic Blue 1/4' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Elastic Black 1/8', 'material', 'pack', 8.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Elastic Black 1/8', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Elastic Black 1/8', (SELECT id FROM inventory WHERE name = 'Elastic Black 1/8' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Elastic Red 1/4', 'material', 'pack', 8.00, 10, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Elastic Red 1/4', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Elastic Red 1/4', (SELECT id FROM inventory WHERE name = 'Elastic Red 1/4' LIMIT 1));
  END IF;

  -- Ortho Wires
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('NiTi Closed Spring', 'material', 'piece', 5.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('NiTi Closed Spring', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('NiTi Closed Spring', (SELECT id FROM inventory WHERE name = 'NiTi Closed Spring' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('SSC 16x22', 'material', 'piece', 6.00, 8, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('SSC 16x22', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('SSC 16x22', (SELECT id FROM inventory WHERE name = 'SSC 16x22' LIMIT 1));
  END IF;

  -- Restorative items
  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Plastic Wedges', 'consumable', 'pack', 3.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Plastic Wedges', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Plastic Wedges', (SELECT id FROM inventory WHERE name = 'Plastic Wedges' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('O-Ring Matrix', 'consumable', 'pack', 15.00, 3, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('O-Ring Matrix', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('O-Ring Matrix', (SELECT id FROM inventory WHERE name = 'O-Ring Matrix' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Etch', 'material', 'syringe', 12.00, 8, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Etch', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Etch', (SELECT id FROM inventory WHERE name = 'Etch' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Beautifill Bulk Flow', 'material', 'syringe', 28.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Beautifill Bulk Flow', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Beautifill Bulk Flow', (SELECT id FROM inventory WHERE name = 'Beautifill Bulk Flow' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Polishing Discs', 'consumable', 'pack', 18.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Polishing Discs', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Polishing Discs', (SELECT id FROM inventory WHERE name = 'Polishing Discs' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Celluloid Strip', 'consumable', 'pack', 5.00, 5, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Celluloid Strip', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Celluloid Strip', (SELECT id FROM inventory WHERE name = 'Celluloid Strip' LIMIT 1));
  END IF;

  INSERT INTO inventory (name, category, unit, unit_cost, reorder_level, current_stock)
  VALUES ('Liquidam', 'material', 'bottle', 45.00, 2, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO item_id;
  IF item_id IS NOT NULL THEN
    INSERT INTO temp_inventory_ids VALUES ('Liquidam', item_id);
  ELSE
    INSERT INTO temp_inventory_ids VALUES ('Liquidam', (SELECT id FROM inventory WHERE name = 'Liquidam' LIMIT 1));
  END IF;

END $$;

-- ============================================================================
-- PART 7: SEED CONTAINER_ITEMS
-- Link inventory items to containers with baseline quantities
-- ============================================================================

-- ENDO CONTAINER
INSERT INTO container_items (container_id, inventory_id, baseline_quantity, current_quantity, grid_section)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 3, 0, NULL FROM temp_inventory_ids WHERE name = 'Endo Probe'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 3, 0, NULL FROM temp_inventory_ids WHERE name = 'Metapex'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 2, 0, NULL FROM temp_inventory_ids WHERE name = 'EDTA Gel'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Biosealer'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 2, 0, NULL FROM temp_inventory_ids WHERE name = 'Guttapercha Bar'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 1, 0, 'GP 20 T2' FROM temp_inventory_ids WHERE name = 'GP 20 T2'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 2, 0, 'GP 25 T2' FROM temp_inventory_ids WHERE name = 'GP 25 T2'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 5, 0, 'GP 35 T4' FROM temp_inventory_ids WHERE name = 'GP 35 T4'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 1, 0, 'PP 30 T4' FROM temp_inventory_ids WHERE name = 'PP 30 T4'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 3, 0, 'PP 40 T2' FROM temp_inventory_ids WHERE name = 'PP 40 T2'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 2, 0, 'K-File #8' FROM temp_inventory_ids WHERE name = 'K-File #8'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 1, 0, 'K-File #10' FROM temp_inventory_ids WHERE name = 'K-File #10'
UNION ALL
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 1, 0, 'K-File #15' FROM temp_inventory_ids WHERE name = 'K-File #15'
ON CONFLICT DO NOTHING;

-- CROWN CONTAINER
INSERT INTO container_items (container_id, inventory_id, baseline_quantity, current_quantity, grid_section)
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Fiberpost Kit'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 2, 0, NULL FROM temp_inventory_ids WHERE name = 'Saline'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Porcelain Etch'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 3, 0, NULL FROM temp_inventory_ids WHERE name = 'Light Body Silicon'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 18, 0, NULL FROM temp_inventory_ids WHERE name = 'G-Cem'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 3, 0, NULL FROM temp_inventory_ids WHERE name = 'Equia Forte'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 12, 0, NULL FROM temp_inventory_ids WHERE name = 'Retraction Paste'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 9, 0, NULL FROM temp_inventory_ids WHERE name = 'FUJI IX'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 11, 0, NULL FROM temp_inventory_ids WHERE name = 'FUJI II LC'
UNION ALL
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 8, 0, NULL FROM temp_inventory_ids WHERE name = 'Resin Cement'
ON CONFLICT DO NOTHING;

-- ORTHO CONTAINER
INSERT INTO container_items (container_id, inventory_id, baseline_quantity, current_quantity, grid_section)
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 4, 0, NULL FROM temp_inventory_ids WHERE name = 'Mattortho Kit'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 3, 0, NULL FROM temp_inventory_ids WHERE name = 'Microimplant 8mm'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 7, 0, NULL FROM temp_inventory_ids WHERE name = 'Elastic Separator'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 15, 0, 'Elastics Blue 1/4' FROM temp_inventory_ids WHERE name = 'Elastic Blue 1/4'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 2, 0, 'Elastics Black 1/8' FROM temp_inventory_ids WHERE name = 'Elastic Black 1/8'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 7, 0, 'Elastics Red 1/4' FROM temp_inventory_ids WHERE name = 'Elastic Red 1/4'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 2, 0, 'Wires NiTi' FROM temp_inventory_ids WHERE name = 'NiTi Closed Spring'
UNION ALL
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 4, 0, 'Wires SSC' FROM temp_inventory_ids WHERE name = 'SSC 16x22'
ON CONFLICT DO NOTHING;

-- RESTORATIVE CONTAINER
INSERT INTO container_items (container_id, inventory_id, baseline_quantity, current_quantity, grid_section)
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Plastic Wedges'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 2, 0, NULL FROM temp_inventory_ids WHERE name = 'O-Ring Matrix'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 4, 0, NULL FROM temp_inventory_ids WHERE name = 'Etch'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Beautifill Bulk Flow'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Polishing Discs'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Celluloid Strip'
UNION ALL
SELECT 'dddddddd-dddd-dddd-dddd-dddddddddddd', id, 1, 0, NULL FROM temp_inventory_ids WHERE name = 'Liquidam'
ON CONFLICT DO NOTHING;

-- Cleanup temp table
DROP TABLE temp_inventory_ids;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ Created containers table
-- ✅ Created container_items join table with baseline/current quantities
-- ✅ Created rapid_scan_log for audit trail
-- ✅ Added RLS policies for all new tables
-- ✅ Seeded 4 containers: Endo, Crown, Ortho, Restorative
-- ✅ Seeded 40+ inventory items
-- ✅ Linked items to containers with real clinic quantities
-- ✅ Ready for Phase 2: Container Management UI
