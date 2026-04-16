BEGIN;

DO $$
DECLARE
  r              record;
  col_exists     boolean;
  new_col_name   text;
  constraint_name text;
BEGIN
  /*
    Trova tutte le foreign key che puntano a public.users(id)
    in qualunque tabella/schema (tipicamente public.* nel tuo caso)
  */
  FOR r IN
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema    = ccu.table_schema
    WHERE tc.constraint_type   = 'FOREIGN KEY'
      AND ccu.table_schema     = 'public'
      AND ccu.table_name       = 'users'
      AND ccu.column_name      = 'id'
  LOOP
    -- nome della nuova colonna: <colonna_fk>_employee_id
    new_col_name := r.column_name || '_employee_id';
    constraint_name := r.table_name || '_' || new_col_name || '_fkey';

    -- 1) se la colonna non esiste, la aggiungiamo
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name   = r.table_name
        AND column_name  = new_col_name
    )
    INTO col_exists;

    IF NOT col_exists THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN %I uuid NULL;',
        r.table_schema,
        r.table_name,
        new_col_name
      );
    END IF;

    -- 2) backfill: valorizziamo la nuova colonna con employees.id
    --    via join su users.employee_id (già allineato e vincolato da 0003/0004)
    EXECUTE format(
      'UPDATE %I.%I AS t
       SET %I = u.employee_id
       FROM public.users AS u
       WHERE t.%I = u.id
         AND u.employee_id IS NOT NULL
         AND (t.%I IS DISTINCT FROM u.employee_id);',
      r.table_schema,
      r.table_name,
      new_col_name,
      r.column_name,
      new_col_name
    );

    -- 3) aggiungiamo la FK verso employees(id)
    --    (se esegui due volte la migration fallirebbe, ma nel flusso normale
    --     viene eseguita una sola volta)
    EXECUTE format(
      'ALTER TABLE %I.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (%I)
         REFERENCES public.employees(id);',
      r.table_schema,
      r.table_name,
      constraint_name,
      new_col_name
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Report (solo informativo): quanti record per tabella hanno ancora user_id non nullo
-- ma colonna _employee_id NULL dopo il backfill (dovrebbero essere 0 o casi molto speciali).
WITH fk_cols AS (
  SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    (kcu.column_name || '_employee_id') AS employee_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema    = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema    = ccu.table_schema
  WHERE tc.constraint_type   = 'FOREIGN KEY'
    AND ccu.table_schema     = 'public'
    AND ccu.table_name       = 'users'
    AND ccu.column_name      = 'id'
),
checks AS (
  SELECT
    table_schema,
    table_name,
    column_name,
    employee_col,
    format(
      'SELECT count(*) AS cnt FROM %I.%I WHERE %I IS NOT NULL AND %I IS NULL',
      table_schema, table_name, column_name, employee_col
    ) AS sql_check
  FROM fk_cols
)
SELECT table_schema, table_name, column_name, employee_col
FROM checks;
