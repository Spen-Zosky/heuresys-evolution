-- Migration 180: rbp_field_classifications table
-- Part of RBP Step 2.2 + P9 (everything data-driven)
-- Moves the FIELD_CLASSIFICATION_REGISTRY hardcoded map from
-- services/api-gateway/src/utils/field-policy.ts into a DB table that
-- can be curated per tenant and evolved without code deploys.
--
-- Scope rules:
--   tenant_id NULL         -> platform-level default classification
--   tenant_id <uuid>       -> tenant-specific override (takes precedence)
--
-- The helper loadFieldClassifications(roleCode, tenantId) consumer reads
-- both scopes and layers the tenant override on top of the platform default.

CREATE TABLE IF NOT EXISTS rbp_field_classifications (
    id              serial PRIMARY KEY,
    tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
    table_name      varchar(100) NOT NULL,
    column_name     varchar(100) NOT NULL,
    classification  varchar(20)  NOT NULL
        CHECK (classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','SENSITIVE')),
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT rbp_field_classifications_unique UNIQUE (tenant_id, table_name, column_name)
);

CREATE INDEX IF NOT EXISTS idx_rbp_field_classifications_lookup
    ON rbp_field_classifications (table_name, tenant_id NULLS FIRST);

-- Platform-level defaults (tenant_id NULL). These mirror the legacy
-- FIELD_CLASSIFICATION_REGISTRY exactly so the migration is behaviour-neutral
-- when the loader flips from "hardcoded" to "DB".
INSERT INTO rbp_field_classifications (tenant_id, table_name, column_name, classification, notes) VALUES
    -- employees table
    (NULL, 'employees', 'email',             'INTERNAL',     'legacy registry import'),
    (NULL, 'employees', 'phone',             'INTERNAL',     'legacy registry import'),
    (NULL, 'employees', 'manager_id',        'INTERNAL',     'legacy registry import'),
    (NULL, 'employees', 'org_unit_id',       'INTERNAL',     'legacy registry import'),
    (NULL, 'employees', 'location_id',       'INTERNAL',     'legacy registry import'),
    (NULL, 'employees', 'hire_date',         'CONFIDENTIAL', 'legacy registry import'),
    (NULL, 'employees', 'employment_status', 'CONFIDENTIAL', 'legacy registry import'),
    (NULL, 'employees', 'performance_box',   'CONFIDENTIAL', 'legacy registry import'),
    (NULL, 'employees', 'potential_box',     'CONFIDENTIAL', 'legacy registry import'),
    (NULL, 'employees', 'birth_date',        'SENSITIVE',    'legacy registry import'),
    (NULL, 'employees', 'fiscal_code',       'SENSITIVE',    'legacy registry import'),
    (NULL, 'employees', 'gender',            'SENSITIVE',    'legacy registry import'),
    (NULL, 'employees', 'nationality',       'SENSITIVE',    'legacy registry import'),
    -- employee_contracts
    (NULL, 'employee_contracts', 'annual_salary', 'RESTRICTED', 'legacy registry import'),
    (NULL, 'employee_contracts', 'currency',      'RESTRICTED', 'legacy registry import'),
    (NULL, 'employee_contracts', 'ccnl_code',     'RESTRICTED', 'legacy registry import'),
    (NULL, 'employee_contracts', 'level',         'RESTRICTED', 'legacy registry import'),
    (NULL, 'employee_contracts', 'contract_type', 'RESTRICTED', 'legacy registry import'),
    -- performance_reviews
    (NULL, 'performance_reviews', 'overall_rating',         'CONFIDENTIAL', 'performance data, visible above line manager'),
    (NULL, 'performance_reviews', 'goal_achievement_rating','CONFIDENTIAL', 'performance data'),
    (NULL, 'performance_reviews', 'competency_rating',      'CONFIDENTIAL', 'performance data'),
    (NULL, 'performance_reviews', 'potential_rating',       'RESTRICTED',   'succession-sensitive'),
    (NULL, 'performance_reviews', 'performance_box',        'RESTRICTED',   'nine-box grid'),
    (NULL, 'performance_reviews', 'potential_box',          'RESTRICTED',   'nine-box grid'),
    -- payroll_slips (if table exists, classifications stage for later wiring)
    (NULL, 'payroll_slips', 'gross_amount',  'RESTRICTED', 'payroll'),
    (NULL, 'payroll_slips', 'net_amount',    'RESTRICTED', 'payroll'),
    (NULL, 'payroll_slips', 'tax_withheld',  'RESTRICTED', 'payroll'),
    (NULL, 'payroll_slips', 'bank_account',  'SENSITIVE',  'payment details'),
    -- leave_requests
    (NULL, 'leave_requests', 'reason',             'CONFIDENTIAL', 'may contain medical info'),
    (NULL, 'leave_requests', 'rejection_reason',   'CONFIDENTIAL', 'HR discretionary')
ON CONFLICT (tenant_id, table_name, column_name) DO UPDATE
    SET classification = EXCLUDED.classification,
        notes = EXCLUDED.notes,
        updated_at = NOW();

-- RLS: tenant_id NULL readable by everyone; tenant-scoped rows readable only
-- by the owning tenant. Writes must go through privileged code paths.
ALTER TABLE rbp_field_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rbp_field_classifications_read_policy ON rbp_field_classifications;
CREATE POLICY rbp_field_classifications_read_policy ON rbp_field_classifications
    FOR SELECT
    USING (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
    );

COMMENT ON TABLE rbp_field_classifications IS
'Data-driven field classification (P9). Replaces FIELD_CLASSIFICATION_REGISTRY in field-policy.ts. Rows with tenant_id NULL are platform defaults; tenant rows override.';
