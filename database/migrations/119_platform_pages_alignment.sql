-- Migration 119: Align platform_pages with filesystem (23 missing pages)
-- Adds pages that exist in filesystem but were not registered in the DB

BEGIN;

-- ============================================
-- ADMIN-STANDALONE: shortcut pages (8 pages)
-- These are top-level admin routes that duplicate functionality
-- available in other sections but provide direct access
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/candidates', 'Candidati', 'Lista candidati per selezione', '{recruiting,candidates}', 'active', 9, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/certifications', 'Certificazioni', 'Gestione certificazioni dipendenti', '{learning,certifications}', 'active', 10, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/check-ins', 'Check-in', 'Check-in periodici manager-dipendente', '{performance,check-ins}', 'active', 11, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/courses', 'Corsi', 'Catalogo corsi di formazione', '{learning,courses}', 'active', 12, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/feedback', 'Feedback 360', 'Feedback multi-direzionale', '{performance,feedback}', 'active', 13, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/goals', 'Obiettivi', 'Gestione obiettivi aziendali', '{performance,goals}', 'active', 14, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/reviews', 'Valutazioni', 'Valutazioni performance dipendenti', '{performance,reviews}', 'active', 15, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/users', 'Utenti', 'Gestione utenti del tenant', '{admin,users}', 'active', 16, true);

-- ============================================
-- HR-CORE: form di creazione (4 pages)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('hr-core', 'HR Core Management', 'Gestione anagrafica e struttura organizzativa', 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/departments/new', 'Nuovo Dipartimento', 'Form creazione nuovo dipartimento', '{hr-core,departments,create}', 'active', 7, true),
  ('hr-core', 'HR Core Management', 'Gestione anagrafica e struttura organizzativa', 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/locations/new', 'Nuova Sede', 'Form creazione nuova sede', '{hr-core,locations,create}', 'active', 8, true),
  ('hr-core', 'HR Core Management', 'Gestione anagrafica e struttura organizzativa', 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/cost-centers/new', 'Nuovo Centro Costo', 'Form creazione nuovo centro di costo', '{hr-core,cost-centers,create}', 'active', 9, true),
  ('hr-core', 'HR Core Management', 'Gestione anagrafica e struttura organizzativa', 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/org-units/new', 'Nuova Unita Organizzativa', 'Form creazione nuova unita organizzativa', '{hr-core,org-units,create}', 'active', 10, true);

-- ============================================
-- ADMIN-STANDALONE: form di creazione dipendenti + onboarding (2 pages)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/employees/new', 'Nuovo Dipendente', 'Form creazione nuovo dipendente', '{hr-core,employees,create}', 'active', 17, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/employees/onboarding', 'Onboarding', 'Processo di onboarding nuovi dipendenti', '{hr-core,employees,onboarding}', 'active', 18, true);

-- ============================================
-- LEARNING: form e sotto-pagine corsi (3 pages)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('learning', 'Learning & Development', 'Formazione, certificazioni e percorsi di apprendimento', 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/courses/new', 'Nuovo Corso', 'Form creazione nuovo corso', '{learning,courses,create}', 'active', 5, true),
  ('learning', 'Learning & Development', 'Formazione, certificazioni e percorsi di apprendimento', 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/courses/enrollments', 'Iscrizioni Corsi', 'Gestione iscrizioni ai corsi di formazione', '{learning,courses,enrollments}', 'active', 6, true),
  ('learning', 'Learning & Development', 'Formazione, certificazioni e percorsi di apprendimento', 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/knowledge-base', 'Knowledge Base', 'Base di conoscenza aziendale', '{learning,knowledge}', 'active', 7, true);

-- ============================================
-- PERFORMANCE: form e sotto-pagine obiettivi (2 pages)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('performance', 'Performance', 'Obiettivi, valutazioni, OKR e calibrazione', 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/goals/new', 'Nuovo Obiettivo', 'Form creazione nuovo obiettivo', '{performance,goals,create}', 'active', 9, true),
  ('performance', 'Performance', 'Obiettivi, valutazioni, OKR e calibrazione', 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/goals/cascading', 'Cascading Obiettivi', 'Cascading obiettivi da top management a team', '{performance,goals,cascading}', 'active', 10, true);

-- ============================================
-- MARKETPLACE: form creazione plugin (1 page)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('marketplace', 'Marketplace', 'Marketplace plugin e integrazioni', 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace/developer/new', 'Nuovo Plugin', 'Form creazione nuovo plugin developer', '{marketplace,developer,create}', 'active', 6, true);

-- ============================================
-- DESIGN: pagine design/wireframes (2 pages) — experimental
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/design', 'Design System', 'Esplorazione componenti e design system', '{design,ui}', 'experimental', 19, true),
  ('admin-standalone', 'Pagine Admin Standalone', 'Pagine di accesso diretto alle funzionalita admin', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/design/wireframes', 'Wireframes', 'Wireframes e prototipi UI', '{design,wireframes}', 'experimental', 20, true);

-- ============================================
-- PLATFORM: Blueprint page (1 page)
-- ============================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, page_order, is_visible)
VALUES
  ('platform', 'Platform Dashboard', 'Dashboard e strumenti amministrazione piattaforma', 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/panoramica', 'Blueprint', 'Mappa completa delle pagine e sezioni della piattaforma', '{platform,blueprint,map}', 'active', 7, true);

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('119_platform_pages_alignment');

COMMIT;
