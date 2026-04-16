-- ============================================================
-- Enterprise Taxonomy — Phase 3: Gap-fill L1-L3
-- Aggiunge codici ATECO 2025 Rev 2.1 mancanti ai livelli 1-3
-- Fonte: ISTAT StrutturaATECO-2025-IT-EN-1.xlsx
-- ============================================================

-- Step 1: Temp table per caricamento CSV
CREATE TEMP TABLE tmp_gapfill (
    code VARCHAR(10),
    name_it TEXT,
    name_en TEXT,
    parent_code VARCHAR(10),
    level INT,
    classification_system VARCHAR(10)
);

-- Step 2: Carica CSV
-- NOTE: adjust path to your local repo before running manually
\copy tmp_gapfill FROM 'db/migrations/industry_classifications_gapfill_l1_l3.csv' WITH (FORMAT csv, HEADER true, QUOTE '"');

-- Step 3: INSERT ordinato per livello (rispetto FK gerarchiche)

-- L1: Sezioni (parent_code NULL)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, NULLIF(TRIM(parent_code), ''), level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_gapfill WHERE level = 1
ON CONFLICT (code) DO NOTHING;

-- L2: Divisioni (parent = sezione L1)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, parent_code, level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_gapfill WHERE level = 2
ON CONFLICT (code) DO NOTHING;

-- L3: Gruppi (parent = divisione L2)
INSERT INTO industry_classifications (code, parent_code, level, classification_system, name_it, name_en, is_active, created_at)
SELECT code, parent_code, level, classification_system, name_it, name_en, TRUE, NOW()
FROM tmp_gapfill WHERE level = 3
ON CONFLICT (code) DO NOTHING;

-- Step 4: Cleanup
DROP TABLE tmp_gapfill;
