DO $$
DECLARE
  rec RECORD;
BEGIN
  /*
    Per ogni FK che oggi punta a public.users(id):

      - DROP della vecchia FK (se esiste ancora)
      - ADD di una nuova FK che punta a public.employees(id)
        usando la colonna <colonna>_employee_id

    Le regole ON UPDATE / ON DELETE vengono mantenute
    uguali a quelle originali.
  */

  FOR rec IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name                        AS user_fk_column,
      (kcu.column_name || '_employee_id')    AS employee_fk_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema    = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name  = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type   = 'FOREIGN KEY'
      AND ccu.table_schema     = 'public'
      AND ccu.table_name       = 'users'
      AND ccu.column_name      = 'id'
  LOOP
    RAISE NOTICE 'Switch FK: %.% (constraint=%, col=% -> col=%) ON UPDATE %, ON DELETE %',
      rec.table_schema,
      rec.table_name,
      rec.constraint_name,
      rec.user_fk_column,
      rec.employee_fk_column,
      rec.update_rule,
      rec.delete_rule;

    -- 1) Drop della vecchia FK verso users(id), se ancora presente
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      rec.table_schema,
      rec.table_name,
      rec.constraint_name
    );

    -- 2) Creazione nuova FK verso employees(id)
    EXECUTE format(
      'ALTER TABLE %I.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (%I)
         REFERENCES public.employees(id)
         ON UPDATE %s
         ON DELETE %s',
      rec.table_schema,
      rec.table_name,
      rec.constraint_name || '_emp',
      rec.employee_fk_column,
      rec.update_rule,
      rec.delete_rule
    );
  END LOOP;
END $$;
