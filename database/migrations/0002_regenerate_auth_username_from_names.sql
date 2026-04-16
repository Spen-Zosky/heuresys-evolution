/*
 * 0002_regenerate_auth_username_from_names.sql
 *
 * Obiettivo:
 * - Rigenerare public.employees.auth_username usando:
 *     tenant.code + '.' + first_name + '.' + last_name
 * - Usare first_name / last_name come fonte di verità anagrafica
 * - NON toccare gli account speciali (SYSADMIN, ADMIN, DEMO)
 */

BEGIN;

------------------------------------------------------------
-- 1. Colonna di appoggio per i nuovi username (se non esiste già)
------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_username_candidate varchar(200);

------------------------------------------------------------
-- 2. Calcolo del candidato per i soli utenti "normali" (USER)
--    e con first_name / last_name valorizzati
------------------------------------------------------------

UPDATE public.employees e
SET auth_username_candidate =
  lower(
    t.code || '.' ||
    regexp_replace(e.first_name, '[^a-zA-Z0-9]+', '.', 'g') || '.' ||
    regexp_replace(e.last_name,  '[^a-zA-Z0-9]+', '.', 'g')
  )
FROM public.tenants t
WHERE e.tenant_id = t.id
  AND e.first_name IS NOT NULL
  AND e.last_name  IS NOT NULL
  AND e.auth_role = 'USER';

------------------------------------------------------------
-- 3. (Opzionale) Verifica duplicati prima di applicare
--    Puoi eseguire questa SELECT manualmente se vuoi controllare
------------------------------------------------------------

-- SELECT auth_username_candidate, COUNT(*) AS c
-- FROM public.employees
-- WHERE auth_username_candidate IS NOT NULL
-- GROUP BY auth_username_candidate
-- HAVING COUNT(*) > 1;

------------------------------------------------------------
-- 4. Applichiamo il candidato ad auth_username
--    Solo per i ruoli USER (SYSADMIN/ADMIN/DEMO NON vengono toccati)
------------------------------------------------------------

UPDATE public.employees e
SET auth_username = auth_username_candidate
WHERE auth_username_candidate IS NOT NULL
  AND auth_role = 'USER';

------------------------------------------------------------
-- 5. Ricreiamo l'indice di unicità su auth_username
------------------------------------------------------------

DROP INDEX IF EXISTS idx_employees_auth_username;

CREATE UNIQUE INDEX idx_employees_auth_username
  ON public.employees (auth_username)
  WHERE auth_username IS NOT NULL;

COMMIT;

/*
 * NOTE:
 * - Dopo questa migrazione, uno username tipico sarà:
 *     rtl-bank.francesca.gallo
 *     econova.elisa.cattaneo
 *     smartfood.mauro.dangelo
 *
 * - Gli account speciali come:
 *     auth_role = 'SYSADMIN' / 'ADMIN' / 'DEMO'
 *   mantengono il loro auth_username attuale (es. "sysadmin", "admin", "demo").
 */
