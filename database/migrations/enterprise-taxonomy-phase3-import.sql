-- ============================================================
-- Enterprise Taxonomy — Phase 3: Import L4-L6
-- Importa classi NACE (L4) + categorie ATECO (L5) + sottocategorie ATECO (L6)
-- Fonte: ISTAT StrutturaATECO-2025-IT-EN-1.xlsx
-- ============================================================

-- Step 1: Temp table per caricamento CSV
CREATE TEMP TABLE tmp_import (
    code VARCHAR(10),
    name_it TEXT,
    name_en TEXT,
    parent_code VARCHAR(10),
    level INT,
    classification_system VARCHAR(10)
);

-- Step 2: Carica CSV
-- NOTE: adjust path to your local repo before running manually
\copy tmp_import FROM 'db/migrations/industry_classifications_import.csv' WITH (FORMAT csv, HEADER true, QUOTE '"');

-- Step 3: INSERT ordinato per livello (CRITICO: L4 → L5 → L6 per rispetto FK)

-- L4: Classi NACE (parent = gruppo L3)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, parent_code, level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_import WHERE level = 4
ON CONFLICT (code) DO NOTHING;

-- L5: Categorie ATECO (parent = classe L4)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, parent_code, level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_import WHERE level = 5
ON CONFLICT (code) DO NOTHING;

-- L6: Sottocategorie ATECO (parent = categoria L5)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, parent_code, level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_import WHERE level = 6
ON CONFLICT (code) DO NOTHING;

-- Step 4: Cleanup
DROP TABLE tmp_import;

-- Step 5: Aggiorna tenant_industry_classifications ai codici classe esatti

-- RTL Bank: 64.1 → 64.19
UPDATE tenant_industry_classifications SET classification_code = '64.19'
WHERE classification_code = '64.1' AND EXISTS (SELECT 1 FROM industry_classifications WHERE code = '64.19');

-- SmartFood: 10.8 → 10.89
UPDATE tenant_industry_classifications SET classification_code = '10.89'
WHERE classification_code = '10.8' AND EXISTS (SELECT 1 FROM industry_classifications WHERE code = '10.89');

-- EcoNova: 35.1 → 35.11
UPDATE tenant_industry_classifications SET classification_code = '35.11'
WHERE classification_code = '35.1' AND EXISTS (SELECT 1 FROM industry_classifications WHERE code = '35.11');

-- Heuresys: 70.2 → 70.20 (70.22 non esiste in ATECO 2025 Rev 2.1)
UPDATE tenant_industry_classifications SET classification_code = '70.20'
WHERE classification_code = '70.2' AND EXISTS (SELECT 1 FROM industry_classifications WHERE code = '70.20');
