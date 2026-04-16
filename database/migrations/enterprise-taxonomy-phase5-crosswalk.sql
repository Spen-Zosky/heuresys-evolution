-- ============================================================
-- Enterprise Taxonomy — Phase 5: ESCO↔NACE Crosswalk
-- Crea tabella junction occupation → industry_classifications
-- Fonte: esco_occupations.nace_codes (URI + plain codes)
-- ============================================================

-- Task 1: Creare tabella junction
CREATE TABLE IF NOT EXISTS occupation_industry_classifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    occupation_id UUID NOT NULL REFERENCES esco_occupations(id) ON DELETE CASCADE,
    classification_code VARCHAR(10) NOT NULL REFERENCES industry_classifications(code) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL DEFAULT 'ESCO',
    relevance_score NUMERIC(3,2) DEFAULT 1.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(occupation_id, classification_code)
);

CREATE INDEX IF NOT EXISTS idx_oic_occupation ON occupation_industry_classifications(occupation_id);
CREATE INDEX IF NOT EXISTS idx_oic_classification ON occupation_industry_classifications(classification_code);
CREATE INDEX IF NOT EXISTS idx_oic_source ON occupation_industry_classifications(source);

-- Task 2: Popolare dal crosswalk ESCO
WITH raw_codes AS (
    SELECT
        o.id AS occupation_id,
        TRIM(REPLACE(REPLACE(nc, 'http://data.europa.eu/ux2/nace2.1/', ''), ',', '')) AS raw_code
    FROM esco_occupations o, unnest(o.nace_codes) AS nc
),
normalized AS (
    SELECT
        occupation_id,
        CASE
            WHEN raw_code LIKE '%.%' THEN raw_code
            WHEN length(raw_code) <= 2 THEN raw_code
            ELSE left(raw_code, 2) || '.' || substring(raw_code FROM 3)
        END AS nace_code
    FROM raw_codes
    WHERE raw_code IS NOT NULL AND raw_code != ''
)
INSERT INTO occupation_industry_classifications (occupation_id, classification_code, source)
SELECT DISTINCT n.occupation_id, n.nace_code, 'ESCO'
FROM normalized n
WHERE EXISTS (SELECT 1 FROM industry_classifications ic WHERE ic.code = n.nace_code)
ON CONFLICT (occupation_id, classification_code) DO NOTHING;
