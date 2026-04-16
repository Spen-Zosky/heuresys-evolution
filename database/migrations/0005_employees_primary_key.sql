-- Verifica di sicurezza: eventuali duplicati su employees.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.employees
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate employee.id rows detected, cannot create PRIMARY KEY.';
  END IF;
END $$;

-- Imposta la PK su employees.id
ALTER TABLE public.employees
  ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
