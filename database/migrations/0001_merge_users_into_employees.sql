/*
 * 0001_merge_users_into_employees.sql
 *
 * Obiettivo:
 * - Estendere public.employees con i campi necessari per autenticazione/autorizzazione
 * - Copiare in employees i dati attualmente presenti in public.users
 *
 * NOTA:
 * - Non vengono modificate né eliminate foreign key verso public.users
 * - La tabella public.users NON viene eliminata in questa migrazione
 * - Pensata per PostgreSQL 16 (supporto ADD COLUMN IF NOT EXISTS, ecc.)
 */

BEGIN;

------------------------------------------------------------
-- 1. Aggiunta colonne di autenticazione su public.employees
------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_username       varchar(100),
  ADD COLUMN IF NOT EXISTS auth_password_hash  varchar(255),
  ADD COLUMN IF NOT EXISTS auth_role           varchar(50)  DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS auth_permissions    text[]       DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS auth_last_login     timestamp without time zone;

------------------------------------------------------------
-- 2. Controllo opzionale: duplicati potenziali su users.employee_id
--    (utile per verificare che ci sia al massimo uno user per employee)
------------------------------------------------------------

-- Questa SELECT NON modifica dati: serve solo per verifica manuale.
-- Se restituisce righe, esistono employee con più di uno user associato.
-- Eseguire fuori da tool che non consentono SELECT nelle migrazioni,
-- oppure semplicemente ignorare l'output.

-- SELECT employee_id, COUNT(*) AS user_count
-- FROM public.users
-- WHERE employee_id IS NOT NULL
-- GROUP BY employee_id
-- HAVING COUNT(*) > 1;

------------------------------------------------------------
-- 3. Merge dei dati di autenticazione da public.users in public.employees
--    Join logica: users.employee_id -> employees.id
------------------------------------------------------------

UPDATE public.employees e
SET
  auth_username       = u.username,
  auth_password_hash  = u.password_hash,
  auth_role           = COALESCE(u.role, e.auth_role),
  auth_permissions    = COALESCE(u.permissions, e.auth_permissions),
  auth_last_login     = COALESCE(u.last_login, e.auth_last_login),
  is_active           = COALESCE(u.is_active, e.is_active)
FROM public.users u
WHERE u.employee_id = e.id;

------------------------------------------------------------
-- 4. Indici per supportare login e lookup veloci su employees
------------------------------------------------------------

-- Unicità "soft" su auth_username (solo se non NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_auth_username
  ON public.employees (auth_username)
  WHERE auth_username IS NOT NULL;

-- Indice su email per ricerche frequenti (login/email, lookup, ecc.)
CREATE INDEX IF NOT EXISTS idx_employees_email
  ON public.employees (email);

COMMIT;

/*
 * NOTE OPERATIVE (per la roadmap futura, NON eseguite da questo file):
 *
 * - Il nuovo backend Heuresys EVO dovrebbe da ora in poi usare SOLO public.employees
 *   per:
 *     - autenticazione (auth_username, auth_password_hash)
 *     - autorizzazioni (auth_role, auth_permissions)
 *     - stato attivo/non attivo (is_active)
 *     - contesto HR (tenant_id, org_unit_id, job_title, ecc.)
 *
 * - In una migrazione successiva si potranno:
 *     - aggiungere colonne employee_id alle tabelle che oggi referenziano users.id
 *     - popolarle via join users.employee_id -> employees.id
 *     - spostare le foreign key da users.id a employees.id
 *     - infine, eliminare public.users o sostituirla con una VIEW di compatibilità.
 */
