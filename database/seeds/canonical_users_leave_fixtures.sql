-- Canonical users leave_requests fixtures (idempotent)
-- Run after apply-canonical-users.sh to populate demo leave data for all 8 canonical users.
-- Uses OLD employee UUIDs (post 2026-04-15 dedupe) — see docs/DEMO_CREDENTIALS.md

BEGIN;

WITH e AS (
  SELECT '5c50a8cc-da3c-4a4e-a8f9-96f221f299fe'::uuid AS federica,
         'bd9be51b-a4d4-4c2a-be8c-065806ce0c79'::uuid AS marco,
         '282dfaaf-5489-401f-a898-c055d10c6b0b'::uuid AS valentina,
         'c550cecf-0a3d-4b06-9578-39594c3a7229'::uuid AS maria,
         '3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d'::uuid AS paolo,
         'bff71948-22ba-4c44-a9ac-b340c5afa423'::uuid AS giuseppe,
         '665df87e-584e-4a82-aec8-2102037ddf9f'::uuid AS francesca,
         '78a646d5-5766-4da3-9f54-678528718bc3'::uuid AS pietro,
         '0c54b84a-db6e-4da4-bc91-af5d480d524e'::uuid AS tenant
)
-- Delete existing fixtures to make this idempotent
-- (skipped: we keep existing if any, use ON CONFLICT)
INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days_requested, reason, status, created_at, updated_at)
SELECT gen_random_uuid(), e.tenant, emp, ltype, sdate::date, edate::date, days, rsn, st,
       NOW() - (age_days || ' days')::interval,
       NOW() - ((age_days/2) || ' days')::interval
FROM e, (VALUES
  -- Each canonical: 2-4 mixed requests with EN reasons (locale-neutral)
  ('federica', 'annual',   CURRENT_DATE + 30, CURRENT_DATE + 39, 7, 'Annual leave',         'approved', 10),
  ('federica', 'personal', CURRENT_DATE - 5,  CURRENT_DATE - 5,  1, 'Personal day',         'approved', 20),
  ('marco',    'annual',   CURRENT_DATE + 20, CURRENT_DATE + 25, 5, 'Annual leave',         'pending',   3),
  ('marco',    'sick',     CURRENT_DATE - 40, CURRENT_DATE - 38, 3, 'Short illness',        'approved', 45),
  ('marco',    'personal', CURRENT_DATE + 10, CURRENT_DATE + 10, 1, 'Medical appointment',  'approved',  7),
  ('valentina','annual',   CURRENT_DATE + 50, CURRENT_DATE + 60, 8, 'Annual leave',         'approved',  5),
  ('valentina','sick',     CURRENT_DATE - 20, CURRENT_DATE - 18, 3, 'Flu',                  'approved', 25),
  ('valentina','parental', CURRENT_DATE - 90, CURRENT_DATE - 85, 5, 'Parental leave',       'approved', 95),
  ('maria',    'annual',   CURRENT_DATE + 25, CURRENT_DATE + 30, 4, 'Annual leave',         'pending',   2),
  ('maria',    'personal', CURRENT_DATE - 2,  CURRENT_DATE - 2,  1, 'Medical appointment',  'approved',  8),
  ('paolo',    'annual',   CURRENT_DATE + 15, CURRENT_DATE + 22, 6, 'Annual leave',         'approved', 12),
  ('paolo',    'sick',     CURRENT_DATE - 50, CURRENT_DATE - 48, 3, 'Short illness',        'approved', 55),
  ('giuseppe', 'annual',   CURRENT_DATE + 45, CURRENT_DATE + 52, 6, 'Annual leave',         'pending',   1),
  ('giuseppe', 'sick',     CURRENT_DATE - 15, CURRENT_DATE - 13, 3, 'Flu',                  'approved', 18),
  ('giuseppe', 'personal', CURRENT_DATE - 60, CURRENT_DATE - 60, 1, 'Personal day',         'approved', 62),
  ('francesca','annual',   CURRENT_DATE + 14, CURRENT_DATE + 20, 5, 'Annual holiday',       'pending',   1),
  ('francesca','sick',     CURRENT_DATE - 10, CURRENT_DATE - 8,  3, 'Flu',                  'approved', 15),
  ('francesca','personal', CURRENT_DATE + 5,  CURRENT_DATE + 5,  1, 'Medical appointment',  'approved',  3),
  ('pietro',   'annual',   CURRENT_DATE + 30, CURRENT_DATE + 40, 8, 'Annual leave',         'pending',   1),
  ('pietro',   'sick',     CURRENT_DATE - 30, CURRENT_DATE - 28, 3, 'Short illness',        'approved', 35),
  ('pietro',   'parental', CURRENT_DATE - 60, CURRENT_DATE - 55, 5, 'Parental leave',       'approved', 65)
) AS v(emp_key, ltype, sdate, edate, days, rsn, st, age_days)
JOIN LATERAL (
  SELECT CASE emp_key
    WHEN 'federica' THEN e.federica
    WHEN 'marco' THEN e.marco
    WHEN 'valentina' THEN e.valentina
    WHEN 'maria' THEN e.maria
    WHEN 'paolo' THEN e.paolo
    WHEN 'giuseppe' THEN e.giuseppe
    WHEN 'francesca' THEN e.francesca
    WHEN 'pietro' THEN e.pietro
  END AS emp
) x ON TRUE
-- Prevent duplicates on re-run by checking (employee_id, start_date, leave_type)
WHERE NOT EXISTS (
  SELECT 1 FROM leave_requests lr
  WHERE lr.employee_id = emp AND lr.start_date = sdate::date AND lr.leave_type = ltype
);

COMMIT;
