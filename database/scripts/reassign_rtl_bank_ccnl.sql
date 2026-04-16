-- Batch reassignment: RTL Bank employees → CCNL_CRED_2024 tabellare levels
-- Snapshot in contract_amendments + UPDATE employee_contracts.
-- Idempotente: riscrive solo se level/salary cambiano.

BEGIN;

-- RLS: bypass via superuser; se eseguito da ruolo applicativo serve SET LOCAL app.current_tenant_id.
-- Per sicurezza lo impostiamo comunque.
SET LOCAL app.current_tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

-- 1. Snapshot pre-update in tabella dedicata (audit trail separato da contract_amendments,
-- che ha FK a tabella legacy `contracts`, non `employee_contracts`).
CREATE TABLE IF NOT EXISTS employee_contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_contract_id UUID NOT NULL REFERENCES employee_contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  amendment_type VARCHAR(50) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eca_contract ON employee_contract_amendments (employee_contract_id);
CREATE INDEX IF NOT EXISTS idx_eca_tenant_type ON employee_contract_amendments (tenant_id, amendment_type);

WITH to_change AS (
  SELECT ec.id AS contract_id, ec.tenant_id, ec.level AS old_level,
         ec.annual_salary AS old_annual, ec.ccnl_code AS old_ccnl,
         ec.monthly_salary AS old_monthly, ec.num_monthly_payments AS old_nmens,
         fn_resolve_ccnl_level(ec.employee_id, 'CCNL_CRED_2024') AS new_level,
         l.monthly_salary AS new_monthly,
         CASE WHEN e.hire_date < '1999-07-11' THEN 14 ELSE l.num_monthly_payments END AS new_nmens,
         e.hire_date, e.job_title
  FROM employee_contracts ec
  JOIN employees e ON e.id = ec.employee_id
  JOIN ccnl_levels l ON l.ccnl_code='CCNL_CRED_2024' AND l.is_current
                    AND l.level_code = fn_resolve_ccnl_level(ec.employee_id, 'CCNL_CRED_2024')
  WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
    AND e.employment_status = 'active'
    AND ec.is_current = true
)
INSERT INTO employee_contract_amendments (employee_contract_id, tenant_id, amendment_type, description, previous_values, new_values)
SELECT contract_id, tenant_id, 'level_realignment',
       'Reassignment to CCNL_CRED_2024 tabellare levels ('||job_title||')',
       jsonb_build_object(
         'level', old_level,
         'annual_salary', old_annual,
         'ccnl_code', old_ccnl,
         'monthly_salary', old_monthly,
         'num_monthly_payments', old_nmens
       ),
       jsonb_build_object(
         'level', new_level,
         'monthly_salary', new_monthly,
         'num_monthly_payments', new_nmens,
         'ccnl_code', 'CCNL_CRED_2024',
         'resolved_from', 'fn_resolve_ccnl_level'
       )
FROM to_change
WHERE old_level IS DISTINCT FROM new_level
   OR old_monthly IS DISTINCT FROM new_monthly
   OR old_nmens   IS DISTINCT FROM new_nmens
   OR old_ccnl    IS DISTINCT FROM 'CCNL_CRED_2024';

-- 2. UPDATE batch
WITH target AS (
  SELECT ec.id AS contract_id,
         fn_resolve_ccnl_level(ec.employee_id, 'CCNL_CRED_2024') AS new_level,
         l.monthly_salary AS new_monthly,
         CASE WHEN e.hire_date < '1999-07-11' THEN 14 ELSE l.num_monthly_payments END AS new_nmens,
         l.monthly_salary * CASE WHEN e.hire_date < '1999-07-11' THEN 14 ELSE l.num_monthly_payments END AS min_annual,
         e.hire_date,
         ec.annual_salary AS cur_annual
  FROM employee_contracts ec
  JOIN employees e ON e.id = ec.employee_id
  JOIN ccnl_levels l ON l.ccnl_code='CCNL_CRED_2024' AND l.is_current
                    AND l.level_code = fn_resolve_ccnl_level(ec.employee_id, 'CCNL_CRED_2024')
  WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
    AND e.employment_status='active'
    AND ec.is_current = true
)
UPDATE employee_contracts ec
SET level = t.new_level,
    monthly_salary = t.new_monthly,
    num_monthly_payments = t.new_nmens,
    annual_salary = GREATEST(COALESCE(ec.annual_salary, 0), t.min_annual),
    ccnl_code = 'CCNL_CRED_2024',
    salary_override_reason = CASE
      WHEN t.hire_date < '1999-07-11' THEN 'legacy_14a'
      WHEN COALESCE(t.cur_annual, 0) > t.min_annual * 1.05 THEN 'superminimo'
      ELSE NULL
    END,
    updated_at = now()
FROM target t
WHERE ec.id = t.contract_id;

COMMIT;
