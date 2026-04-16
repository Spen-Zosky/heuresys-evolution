BEGIN;

-- 1) Employees con auth_username (fonte di verità già pulita)
WITH employee_per_auth AS (
    SELECT
        e.id AS employee_id,
        e.auth_username,
        COUNT(*) OVER (PARTITION BY e.auth_username) AS cnt_per_auth
    FROM public.employees e
    WHERE e.auth_username IS NOT NULL
),

-- 2) Users con username "business" (escludiamo account tecnici tipo sysadmin/demo)
user_per_auth AS (
    SELECT
        u.id   AS user_id,
        u.username,
        u.role
    FROM public.users u
    WHERE u.username IS NOT NULL
      AND (
           u.username LIKE 'rtl-bank.%'
        OR u.username LIKE 'smartfood.%'
        OR u.username LIKE 'econova.%'
        OR u.username LIKE 'heuresys.%'
      )
),

-- 3) Mappa tra user e employee via auth_username <-> username
mapping AS (
    SELECT
        u.user_id,
        e.employee_id
    FROM user_per_auth u
    JOIN employee_per_auth e
      ON e.auth_username = u.username
    WHERE e.cnt_per_auth = 1   -- solo match univoci
)

-- 4) Allineiamo users.employee_id sulla base della mappa
UPDATE public.users u
SET employee_id = m.employee_id
FROM mapping m
WHERE u.id = m.user_id
  AND (u.employee_id IS DISTINCT FROM m.employee_id);

COMMIT;

-- 5) Report: quanti users "business" restano senza employee_id
SELECT
  COUNT(*) AS users_without_employee_after_fix
FROM public.users u
WHERE u.username IS NOT NULL
  AND (
       u.username LIKE 'rtl-bank.%'
    OR u.username LIKE 'smartfood.%'
    OR u.username LIKE 'econova.%'
    OR u.username LIKE 'heuresys.%'
  )
  AND u.employee_id IS NULL;
