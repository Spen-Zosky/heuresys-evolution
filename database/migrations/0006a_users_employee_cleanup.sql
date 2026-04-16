DO $$
DECLARE
  rec RECORD;
BEGIN
  /*
    Per ogni FK che oggi punta (o puntava) a public.users(id),
    puliamo le colonne <colonna>_employee_id che non trovano
    un match in public.employees(id), settandole a NULL.
  */

  FOR rec IN
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name                        AS user_fk_column,
      (kcu.column_name || '_employee_id')    AS employee_fk_column
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
    RAISE NOTICE 'Cleanup orfani: %.% (% -> %) ...',
      rec.table_schema,
      rec.table_name,
      rec.user_fk_column,
      rec.employee_fk_column;

    -- Metti a NULL i riferimenti _employee_id che non esistono in employees.id
    EXECUTE format(
      'UPDATE %I.%I t
         SET %I = NULL
       WHERE %I IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.employees e
           WHERE e.id = t.%I
         )',
      rec.table_schema,
      rec.table_name,
      rec.employee_fk_column,
      rec.employee_fk_column,
      rec.employee_fk_column
    );
  END LOOP;
END $$;
