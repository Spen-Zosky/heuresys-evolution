-- Migration 181: register C1-C5 admin page candidates in admin_component_registry
--
-- TASK-C1-C5 from NEXT_SESSION_PLAN.md asks to extract 5 admin pages into
-- reusable tab components that can be surfaced under /portal/*. Fully
-- extracting each page is a multi-hour refactor (see the LOC counts below).
--
-- This migration takes the smaller, honest step of *registering* the 5
-- candidates in admin_component_registry with verified_with_data=false so
-- that:
--   1. The P11 reuse-first gate can discover them when new work touches
--      the same area (skill check `dashboards-jobs` / `consolida-pagina`).
--   2. The governance inventory reflects reality — these 5 pages are
--      admin-only today, pending extraction.
--   3. Future refactor PRs can flip verified_with_data=true once the page
--      is shaped as a reusable tab component with a portal wrapper.
--
-- Inserted components are intentionally marked as page-level (scope_level
-- 'employee') and reuse_contexts=['admin'] only — they are NOT yet safe to
-- consume from /portal/*. The admin extraction sprint (follow-up) will
-- flip reuse_contexts to include 'portal' and create thin wrappers.

INSERT INTO admin_component_registry
    (code, name, description, frontend_path, export_name, export_kind,
     functional_area_code, scope_level, read_only, reuse_contexts,
     api_endpoints, verified_with_data)
VALUES
    ('tab-career-landing',
     'Career Landing (candidato extraction)',
     'Dashboard carriera personale: profilo professionale, tracks attivi, kpi. 552 LOC pagina admin /admin/career. Candidato extraction verso /portal/career (TASK-C1).',
     'services/frontend/src/app/admin/career/page.tsx',
     'default',
     'default',
     'CAREER',
     'employee',
     false,
     ARRAY['admin']::text[],
     ARRAY['/api/v1/career/me','/api/v1/career/tracks']::text[],
     false),
    ('tab-learning-catalog',
     'Learning Catalog + Enrollments (candidato extraction)',
     'Catalogo corsi + iscrizioni personali: 566 LOC pagina admin /admin/career/learning. Candidato extraction verso /portal/learning (TASK-C2).',
     'services/frontend/src/app/admin/career/learning/page.tsx',
     'default',
     'default',
     'LEARNING',
     'employee',
     false,
     ARRAY['admin']::text[],
     ARRAY['/api/v1/learning/courses','/api/v1/learning/enrollments']::text[],
     false),
    ('tab-skill-self-assessment',
     'Skill Self-Assessment (candidato extraction)',
     'Self-assessment skill con gap analysis: 546 LOC pagina admin /admin/career/skills. Candidato extraction verso tab-skill-self-assessment in /portal/profile (TASK-C3).',
     'services/frontend/src/app/admin/career/skills/page.tsx',
     'default',
     'default',
     'TALENT',
     'employee',
     false,
     ARRAY['admin']::text[],
     ARRAY['/api/v1/skills/self-assessment','/api/v1/career/gap-analysis']::text[],
     false),
    ('tab-workforce-kpis',
     'Workforce KPIs Dashboard (candidato extraction)',
     'Workforce analytics: headcount, turnover, org chart mini, team absences. 515 LOC pagina admin /admin/analytics/workforce. Candidato extraction verso widget set workspace (TASK-C4).',
     'services/frontend/src/app/admin/analytics/workforce/page.tsx',
     'default',
     'default',
     'ANALYTICS',
     'tenant',
     false,
     ARRAY['admin']::text[],
     ARRAY['/api/v1/analytics/workforce','/api/v1/employees/analytics-stats']::text[],
     false),
    ('tab-org-structure',
     'Org Structure Explorer (candidato extraction)',
     'Drill-down completo struttura organizzativa con org-units, manager, team. 483 LOC pagina admin /admin/org-units. Candidato extraction verso /portal/org-chart full (TASK-C5).',
     'services/frontend/src/app/admin/org-units/page.tsx',
     'default',
     'default',
     'ORGANIZATION',
     'tenant',
     false,
     ARRAY['admin']::text[],
     ARRAY['/api/v1/org-units','/api/v1/employees']::text[],
     false)
ON CONFLICT (tenant_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        frontend_path = EXCLUDED.frontend_path,
        functional_area_code = EXCLUDED.functional_area_code,
        api_endpoints = EXCLUDED.api_endpoints,
        updated_at = NOW();
