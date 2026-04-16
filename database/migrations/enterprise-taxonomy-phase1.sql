-- ============================================================
-- Enterprise Taxonomy — Phase 1: DDL
-- Crea le tabelle per la tassonomia unificata NACE/ATECO
-- Ref: BLUEPRINT-Enterprise-Taxonomy.md
-- ============================================================

-- 1. Aggiungere ENTERPRISE all'enum company_size
-- NOTA: ALTER TYPE ADD VALUE non può essere in transazione
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'ENTERPRISE'
          AND enumtypid = 'company_size'::regtype
    ) THEN
        ALTER TYPE company_size ADD VALUE 'ENTERPRISE';
    END IF;
END $$;

-- 2. Rinominare la tabella company_sizes legacy (codici MI/SM/MD/LG)
ALTER TABLE IF EXISTS company_sizes RENAME TO _company_sizes_legacy;

-- 3. Creare nuova company_sizes con codici standard UE 2003/361/CE
CREATE TABLE IF NOT EXISTS company_sizes (
    code            VARCHAR(20)     PRIMARY KEY,
    name_it         VARCHAR(100)    NOT NULL,
    name_en         VARCHAR(100)    NOT NULL,
    min_employees   INT             NOT NULL DEFAULT 0,
    max_employees   INT,
    max_revenue_eur BIGINT,
    max_balance_eur BIGINT,
    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

INSERT INTO company_sizes (code, name_it, name_en, min_employees, max_employees, max_revenue_eur, max_balance_eur, sort_order) VALUES
    ('MICRO',      'Microimpresa',     'Micro',      0,    9,     2000000,    2000000,  1),
    ('SMALL',      'Piccola impresa',  'Small',      10,   49,    10000000,   10000000, 2),
    ('MEDIUM',     'Media impresa',    'Medium',     50,   249,   50000000,   43000000, 3),
    ('LARGE',      'Grande impresa',   'Large',      250,  999,   NULL,       NULL,     4),
    ('ENTERPRISE', 'Enterprise',       'Enterprise', 1000, NULL,  NULL,       NULL,     5)
ON CONFLICT (code) DO NOTHING;

-- 4. Creare industry_classifications: tassonomia unificata NACE/ATECO
CREATE TABLE IF NOT EXISTS industry_classifications (
    code                    VARCHAR(10)     PRIMARY KEY,
    parent_code             VARCHAR(10)     REFERENCES industry_classifications(code),
    level                   SMALLINT        NOT NULL CHECK (level BETWEEN 1 AND 6),
    classification_system   VARCHAR(10)     NOT NULL DEFAULT 'NACE'
                            CHECK (classification_system IN ('NACE', 'ATECO')),
    name_it                 VARCHAR(500)    NOT NULL,
    name_en                 VARCHAR(500),
    description_it          TEXT,
    description_en          TEXT,
    icon                    VARCHAR(50),
    color                   VARCHAR(7),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Embeddings semantici (text-embedding-3-small, 1536-dim)
    embedding_it            vector(1536),
    embedding_en            vector(1536),
    embedding_model         VARCHAR(50),
    embedding_generated_at  TIMESTAMPTZ,

    -- Metadata
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    -- Vincoli di coerenza
    CONSTRAINT chk_level_system CHECK (
        (level <= 4 AND classification_system = 'NACE') OR
        (level >= 5 AND classification_system = 'ATECO')
    ),
    CONSTRAINT chk_parent_consistency CHECK (
        (level = 1 AND parent_code IS NULL) OR
        (level > 1 AND parent_code IS NOT NULL)
    )
);

COMMENT ON TABLE industry_classifications IS
    'Tassonomia unificata NACE Rev.2.1 (livelli 1-4) + ATECO 2025 (livelli 5-6). '
    'I codici ai livelli 1-4 sono identici tra NACE e ATECO per regolamento UE.';

-- Indici industry_classifications
CREATE INDEX IF NOT EXISTS idx_ic_parent ON industry_classifications(parent_code);
CREATE INDEX IF NOT EXISTS idx_ic_level ON industry_classifications(level);
CREATE INDEX IF NOT EXISTS idx_ic_system ON industry_classifications(classification_system);
CREATE INDEX IF NOT EXISTS idx_ic_active ON industry_classifications(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ic_name_it_trgm ON industry_classifications USING gin(name_it gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ic_name_en_trgm ON industry_classifications USING gin(name_en gin_trgm_ops);

-- 5. Creare industry_profiles: template configurazione per settore + dimensione
CREATE TABLE IF NOT EXISTS industry_profiles (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    VARCHAR(50)     UNIQUE NOT NULL,
    name                    VARCHAR(200)    NOT NULL,
    description             TEXT,

    -- Classificazione
    nace_class_code         VARCHAR(10)     NOT NULL REFERENCES industry_classifications(code),
    company_size_code       VARCHAR(20)     NOT NULL REFERENCES company_sizes(code),

    -- Template organizzativi
    typical_hierarchy       JSONB,
    typical_roles           TEXT[],
    typical_departments     TEXT[],
    typical_span_of_control JSONB,
    department_templates    JSONB,

    -- Collegamento ESCO
    esco_occupation_codes   TEXT[],
    esco_skill_uris         TEXT[],

    -- Metadata
    min_employees           INT,
    max_employees           INT,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_profile_nace_size UNIQUE (nace_class_code, company_size_code)
);

-- 6. Creare tenant_industry_classifications: classificazioni settoriali del tenant
CREATE TABLE IF NOT EXISTS tenant_industry_classifications (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    classification_code     VARCHAR(10)     NOT NULL REFERENCES industry_classifications(code),
    classification_role     VARCHAR(20)     NOT NULL DEFAULT 'PRIMARY'
                            CHECK (classification_role IN ('PRIMARY', 'SECONDARY')),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Partial unique index: un tenant può avere una sola classificazione PRIMARY
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_primary
    ON tenant_industry_classifications(tenant_id)
    WHERE classification_role = 'PRIMARY';

CREATE INDEX IF NOT EXISTS idx_tic_tenant ON tenant_industry_classifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tic_classification ON tenant_industry_classifications(classification_code);
