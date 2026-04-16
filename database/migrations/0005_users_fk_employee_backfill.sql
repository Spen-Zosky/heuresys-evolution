DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Trova tutte le colonne che hanno una FK verso users(id)
  FOR rec IN
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
  LOOP
    -- 1) Aggiunge la colonna <colonna>_employee_id se non esiste
    EXECUTE format(
      'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS %I uuid',
      rec.table_schema,
      rec.table_name,
      rec.employee_col
    );

    -- 2) Popola la colonna con employees legati allo user
    EXECUTE format(
      'UPDATE %I.%I t
          SET %I = u.employee_id
         FROM public.users u
        WHERE t.%I = u.id
          AND t.%I IS NULL',
      rec.table_schema,
      rec.table_name,
      rec.employee_col,
      rec.column_name,
      rec.employee_col
    );
  END LOOP;
END $$;
