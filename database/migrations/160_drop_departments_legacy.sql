-- Drop legacy departments table (org-units refactor cleanup)
-- Safe: 0 references in services/*.ts, column legacy_department_id already removed
DROP TABLE IF EXISTS _departments_legacy CASCADE;
