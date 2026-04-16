BEGIN;

-- 1) Vincolo: gli utenti di business devono avere employee_id valorizzato
--    Supponiamo che gli account tecnici siano quelli con role IN ('SYSADMIN', 'DEMO')
--    Puoi estendere l'elenco se in futuro avrai altri ruoli "tecnici".
ALTER TABLE public.users
ADD CONSTRAINT users_business_must_have_employee
CHECK (
  role IN ('SYSADMIN', 'DEMO')
  OR employee_id IS NOT NULL
);

-- 2) Indice univoco parziale:
--    Per gli utenti di business (role NOT IN ('SYSADMIN','DEMO'))
--    employee_id deve essere univoco (non posso avere 2 users per lo stesso employee).
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_business
ON public.users (employee_id)
WHERE role NOT IN ('SYSADMIN','DEMO') AND employee_id IS NOT NULL;

COMMIT;

-- 3) Report di controllo: eventuali utenti tecnici (per riferimento)
SELECT id, username, role, employee_id
FROM public.users
WHERE role IN ('SYSADMIN','DEMO')
ORDER BY role, username;
