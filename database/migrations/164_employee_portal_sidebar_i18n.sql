-- Migration 164: Translate employee_portal sidebar nav items to Italian
-- Align sections and labels with the approved mockup design
-- Source of truth: .superpowers/brainstorm/702426-1775610642/content/employee-portal-v5.html

BEGIN;

-- ============================================================
-- 1. Translate label_override for all employee_portal nav items
-- ============================================================

-- MAIN section items
UPDATE rbp_dashboard_nav_items SET label_override = 'Il Mio Profilo', section = 'main', sort_order = 10
WHERE id = 76; -- My Profile

UPDATE rbp_dashboard_nav_items SET label_override = 'Notifiche', section = 'main', sort_order = 20
WHERE id = 132; -- Notification Settings

UPDATE rbp_dashboard_nav_items SET label_override = 'Workspace', section = 'main', sort_order = 30
WHERE id = 185; -- Workspace Editor

-- Remove Workspace Templates from main (not in mockup)
UPDATE rbp_dashboard_nav_items SET is_visible = false
WHERE id = 186; -- Workspace Templates

-- CAREER section items
UPDATE rbp_dashboard_nav_items SET label_override = 'Obiettivi', section = 'career', sort_order = 10
WHERE id = 77; -- My Goals

UPDATE rbp_dashboard_nav_items SET label_override = 'Valutazioni', section = 'career', sort_order = 20
WHERE id = 78; -- My Reviews

UPDATE rbp_dashboard_nav_items SET label_override = 'Formazione', section = 'career', sort_order = 30
WHERE id = 79; -- My Learning

-- DOCS section items
UPDATE rbp_dashboard_nav_items SET label_override = 'I Miei Documenti', section = 'docs', sort_order = 10
WHERE id = 81; -- My Documents

UPDATE rbp_dashboard_nav_items SET label_override = 'Cedolini', section = 'docs', sort_order = 20, icon_override = 'gem'
WHERE id = 82; -- My Payslips → Cedolini with Gem icon

-- ACTIONS section
UPDATE rbp_dashboard_nav_items SET label_override = 'Approvazioni', section = 'actions', sort_order = 10
WHERE id = 83; -- Approvals

-- EXPLORE section
UPDATE rbp_dashboard_nav_items SET label_override = 'Organigramma', section = 'explore', sort_order = 10
WHERE id = 85; -- Org Chart

-- PERSPECTIVES section (move from main)
UPDATE rbp_dashboard_nav_items SET label_override = 'Process', section = 'perspectives', sort_order = 10
WHERE id = 166; -- Process Perspective

UPDATE rbp_dashboard_nav_items SET label_override = 'Enterprise', section = 'perspectives', sort_order = 20
WHERE id = 167; -- Organization & Systems Perspective

UPDATE rbp_dashboard_nav_items SET label_override = 'Talent', section = 'perspectives', sort_order = 30
WHERE id = 168; -- Human Resources Perspective

-- TOOLS section
UPDATE rbp_dashboard_nav_items SET label_override = 'AI Chat', section = 'tools', sort_order = 10
WHERE id = 86; -- AI Chat

-- TIME section → move to main or hide (not in mockup as separate section)
-- My Time & Leave not in mockup sidebar — hide it
UPDATE rbp_dashboard_nav_items SET is_visible = false
WHERE id = 80; -- My Time & Leave

-- SOCIAL section → hide Recognition (not in mockup sidebar)
UPDATE rbp_dashboard_nav_items SET is_visible = false
WHERE id = 84; -- Recognition

-- ============================================================
-- 2. Fix contract: set is_current = true for Pietro Barbieri
-- ============================================================
UPDATE employee_contracts SET is_current = true
WHERE employee_id = '78a646d5-5766-4da3-9f54-678528718bc3';

COMMIT;
