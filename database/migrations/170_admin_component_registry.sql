-- ============================================================================
-- Migration 170: Admin Component Registry
-- ============================================================================
-- Data-driven catalog of reusable admin UI components. Before creating any
-- new page, skills/commands/agents MUST query this registry to find existing
-- self-contained components and reuse them via import. This enforces the
-- P11 "Reuse-First Admin Components" principle.
--
-- A component is eligible for the registry when it:
--   1. Is self-contained (fetches its own data)
--   2. Accepts a simple prop contract (e.g., { employeeId: string })
--   3. Renders a complete functional view
--   4. Has been verified against real DB data
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS admin_component_registry (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id              UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code                   VARCHAR(100) NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    description            TEXT,
    frontend_path          TEXT NOT NULL,
    export_name            VARCHAR(100) NOT NULL,
    export_kind            VARCHAR(20) NOT NULL DEFAULT 'named'
                           CHECK (export_kind IN ('default','named')),
    prop_shape             JSONB NOT NULL DEFAULT '{}'::jsonb,
    functional_area_code   VARCHAR(50) NOT NULL REFERENCES rbp_functional_areas(code),
    scope_level            VARCHAR(20) NOT NULL DEFAULT 'employee'
                           CHECK (scope_level IN ('self','employee','team','department','tenant','platform')),
    read_only              BOOLEAN NOT NULL DEFAULT true,
    reuse_contexts         TEXT[] NOT NULL DEFAULT ARRAY['admin','portal'],
    api_endpoints          TEXT[],
    verified_with_data     BOOLEAN NOT NULL DEFAULT false,
    verified_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

COMMENT ON TABLE admin_component_registry IS
  'Registry of reusable admin UI components. Enforces P11 "Reuse-First Admin Components" — skills and agents query this before creating new UI.';

CREATE INDEX IF NOT EXISTS idx_admin_components_area
  ON admin_component_registry (functional_area_code);
CREATE INDEX IF NOT EXISTS idx_admin_components_tenant
  ON admin_component_registry (tenant_id);

-- ----------------------------------------------------------------------------
-- Seed with the 10 tab components currently reused in /portal/profile
-- All verified against Pietro Barbieri data on 2026-04-10
-- ----------------------------------------------------------------------------
INSERT INTO admin_component_registry (
    tenant_id, code, name, description, frontend_path, export_name, export_kind,
    prop_shape, functional_area_code, scope_level, read_only, reuse_contexts,
    api_endpoints, verified_with_data, verified_at
) VALUES
(NULL, 'tab-overview',
 'Dati Anagrafici Dipendente',
 'Identità, documenti, indirizzi, contatti, emergenza, famiglia, istruzione, bancari. Nessuna chiamata API: riceve employee object completo.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-overview.tsx',
 'default', 'default',
 '{"employee":"object"}'::jsonb,
 'CORE_HR', 'employee', true, ARRAY['admin','portal'],
 ARRAY[]::text[], true, '2026-04-10'::timestamptz),

(NULL, 'tab-organization',
 'Organizzazione Dipendente',
 'Ruolo, posizione, dipartimento, ciclo di vita contrattuale, retribuzione, SAP, autenticazione. Riceve employee object completo.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-organization.tsx',
 'default', 'default',
 '{"employee":"object"}'::jsonb,
 'ORGANIZATION', 'employee', true, ARRAY['admin','portal'],
 ARRAY[]::text[], true, '2026-04-10'::timestamptz),

(NULL, 'tab-contracts',
 'Contratti Dipendente',
 'Tabella contratti con tipo, CCNL, date, RAL, FTE, stato. Gestisce scadenza naturale per pensionamento.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-contracts.tsx',
 'TabContracts', 'named',
 '{"employeeId":"string"}'::jsonb,
 'CORE_HR', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/contracts/employee/:employeeId'], true, '2026-04-10'::timestamptz),

(NULL, 'tab-skills',
 'Competenze e Certificazioni',
 'Skill list con composite score e gruppo, certificazioni con scadenza.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-skills.tsx',
 'TabSkills', 'named',
 '{"employeeId":"string"}'::jsonb,
 'TALENT', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/employee-skill-profiles/:employeeId','/api/v1/certifications/employee/:employeeId'],
 true, '2026-04-10'::timestamptz),

(NULL, 'tab-training',
 'Formazione e Corsi',
 'Enrollments con progress, stato, date iscrizione e completamento.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-training.tsx',
 'TabTraining', 'named',
 '{"employeeId":"string"}'::jsonb,
 'LEARNING', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/enrollments?employee_id=:employeeId'], true, '2026-04-10'::timestamptz),

(NULL, 'tab-goals',
 'Obiettivi Dipendente',
 'Cards con progress bar, categoria, scadenza per ogni obiettivo.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-goals.tsx',
 'TabGoals', 'named',
 '{"employeeId":"string"}'::jsonb,
 'PERFORMANCE', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/goals?employee_id=:employeeId'], true, '2026-04-10'::timestamptz),

(NULL, 'tab-performance',
 'Performance: Review, Check-in, Feedback',
 'Valutazioni con star rating, check-in con mood, feedback (continuous + 360).',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-performance.tsx',
 'TabPerformance', 'named',
 '{"employeeId":"string"}'::jsonb,
 'PERFORMANCE', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/performance-reviews?employee_id=:employeeId','/api/v1/check-ins?employee_id=:employeeId','/api/v1/feedback?employee_id=:employeeId'],
 true, '2026-04-10'::timestamptz),

(NULL, 'tab-attendance',
 'Presenze e Richieste',
 'Tabelle presenze, richieste ferie/permessi (self-service), straordinari.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-attendance.tsx',
 'TabAttendance', 'named',
 '{"employeeId":"string"}'::jsonb,
 'TIME_ATTENDANCE', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/attendance?employee_id=:employeeId','/api/v1/time-off/my/requests','/api/v1/overtime?employee_id=:employeeId'],
 true, '2026-04-10'::timestamptz),

(NULL, 'tab-documents',
 'Documenti Dipendente',
 'Tabella documenti con tipo, stato, file, scadenza. Badge riservato per documenti con visibility=confidential.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-documents.tsx',
 'TabDocuments', 'named',
 '{"employeeId":"string"}'::jsonb,
 'CORE_HR', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/employee-documents?employee_id=:employeeId'], true, '2026-04-10'::timestamptz),

(NULL, 'tab-career-risk',
 'Carriera e Rischio',
 'Profilo carriera (recommendations), piani successione (candidate filter), benessere (aggregato da check-in), rischio turnover.',
 'services/frontend/src/app/admin/employees/[id]/_components/tab-career-risk.tsx',
 'TabCareerRisk', 'named',
 '{"employeeId":"string"}'::jsonb,
 'CAREER', 'employee', true, ARRAY['admin','portal'],
 ARRAY['/api/v1/career-paths/recommendations/:employeeId','/api/v1/succession/candidates','/api/v1/wellbeing/employee/:employeeId','/api/v1/predictions/turnover/high-risk'],
 true, '2026-04-10'::timestamptz)
ON CONFLICT (tenant_id, code) DO UPDATE SET
    name                 = EXCLUDED.name,
    description          = EXCLUDED.description,
    frontend_path        = EXCLUDED.frontend_path,
    export_name          = EXCLUDED.export_name,
    export_kind          = EXCLUDED.export_kind,
    prop_shape           = EXCLUDED.prop_shape,
    functional_area_code = EXCLUDED.functional_area_code,
    scope_level          = EXCLUDED.scope_level,
    read_only            = EXCLUDED.read_only,
    reuse_contexts       = EXCLUDED.reuse_contexts,
    api_endpoints        = EXCLUDED.api_endpoints,
    verified_with_data   = EXCLUDED.verified_with_data,
    verified_at          = EXCLUDED.verified_at,
    updated_at           = NOW();

COMMIT;
