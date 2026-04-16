-- Migration 200: CCNL levels, job_title mapping, seniority rules + resolution function
-- Data-driven (P9) — tutto configurabile via DBMS, nessun hardcoded in codice.

BEGIN;

-- ============================================================
-- 1. ccnl_levels — catalogo livelli retributivi per CCNL
-- ============================================================
CREATE TABLE IF NOT EXISTS ccnl_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccnl_code VARCHAR(50) NOT NULL REFERENCES ccnl_contracts(code) ON UPDATE CASCADE ON DELETE CASCADE,
  level_code VARCHAR(20) NOT NULL,
  level_name VARCHAR(200) NOT NULL,
  level_order SMALLINT NOT NULL,
  category VARCHAR(30) NOT NULL,
  monthly_salary NUMERIC(10,2) NOT NULL,
  num_monthly_payments SMALLINT NOT NULL DEFAULT 13,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT true,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ccnl_levels_code_effdate UNIQUE (ccnl_code, level_code, effective_date),
  CONSTRAINT chk_ccnl_levels_category CHECK (category IN ('quadro_direttivo','area_professionale','area_unificata','impiegato','operaio','dirigente'))
);
CREATE INDEX IF NOT EXISTS idx_ccnl_levels_current ON ccnl_levels (ccnl_code, is_current);
CREATE INDEX IF NOT EXISTS idx_ccnl_levels_lookup ON ccnl_levels (ccnl_code, level_code) WHERE is_current = true;

COMMENT ON TABLE ccnl_levels IS
  'Livelli retributivi tabellari per CCNL. Fonte: sindacati (UILCA/FISAC/FIRST CISL). Data-driven P9.';

-- ============================================================
-- 2. ccnl_job_title_mapping — mapping ruolo → livello base
-- ============================================================
CREATE TABLE IF NOT EXISTS ccnl_job_title_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccnl_code VARCHAR(50) NOT NULL REFERENCES ccnl_contracts(code) ON UPDATE CASCADE,
  job_title_pattern TEXT NOT NULL,
  match_type VARCHAR(10) NOT NULL DEFAULT 'ilike',
  base_level_code VARCHAR(20) NOT NULL,
  is_management BOOLEAN NOT NULL DEFAULT false,
  priority SMALLINT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ccnl_jtm UNIQUE (ccnl_code, job_title_pattern),
  CONSTRAINT chk_ccnl_jtm_match_type CHECK (match_type IN ('ilike','regex','exact'))
);
CREATE INDEX IF NOT EXISTS idx_ccnl_jtm_lookup ON ccnl_job_title_mapping (ccnl_code, priority);

-- ============================================================
-- 3. ccnl_seniority_rules — matrice modulazione per anzianità
-- ============================================================
CREATE TABLE IF NOT EXISTS ccnl_seniority_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccnl_code VARCHAR(50) NOT NULL REFERENCES ccnl_contracts(code) ON UPDATE CASCADE,
  from_level_code VARCHAR(20) NOT NULL,
  min_years_service NUMERIC(4,1) NOT NULL,
  max_years_service NUMERIC(4,1),
  requires_reports BOOLEAN NOT NULL DEFAULT false,
  requires_management BOOLEAN NOT NULL DEFAULT false,
  target_level_code VARCHAR(20) NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ccnl_sr_lookup ON ccnl_seniority_rules (ccnl_code, from_level_code, priority);

-- ============================================================
-- 4. ALTER employee_contracts
-- ============================================================
ALTER TABLE employee_contracts
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS num_monthly_payments SMALLINT,
  ADD COLUMN IF NOT EXISTS salary_override_reason VARCHAR(50);

-- ============================================================
-- 5. Funzione fn_resolve_ccnl_level(employee_id, ccnl_code)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_resolve_ccnl_level(p_employee_id UUID, p_ccnl_code VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_job_title TEXT;
  v_hire_date DATE;
  v_years NUMERIC;
  v_has_reports BOOLEAN;
  v_base_level VARCHAR(20);
  v_is_mgmt BOOLEAN;
  v_target_level VARCHAR(20);
BEGIN
  SELECT job_title, hire_date,
         EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.id AND r.employment_status='active')
  INTO v_job_title, v_hire_date, v_has_reports
  FROM employees e WHERE e.id = p_employee_id;

  IF v_job_title IS NULL THEN RETURN NULL; END IF;

  v_years := (CURRENT_DATE - COALESCE(v_hire_date, CURRENT_DATE))::numeric / 365.25;

  -- Step 1: base level da job_title (priorità ASC — più specifico prima)
  SELECT base_level_code, is_management INTO v_base_level, v_is_mgmt
  FROM ccnl_job_title_mapping
  WHERE ccnl_code = p_ccnl_code
    AND (
      (match_type = 'ilike' AND v_job_title ILIKE job_title_pattern) OR
      (match_type = 'exact' AND v_job_title = job_title_pattern) OR
      (match_type = 'regex' AND v_job_title ~* job_title_pattern)
    )
  ORDER BY priority ASC
  LIMIT 1;

  -- Fallback se nessun match
  IF v_base_level IS NULL THEN
    SELECT base_level_code, is_management INTO v_base_level, v_is_mgmt
    FROM ccnl_job_title_mapping
    WHERE ccnl_code = p_ccnl_code AND job_title_pattern = '%'
    ORDER BY priority DESC LIMIT 1;
  END IF;

  IF v_base_level IS NULL THEN RETURN NULL; END IF;

  -- Step 2: seniority rule (priorità ASC)
  SELECT target_level_code INTO v_target_level
  FROM ccnl_seniority_rules
  WHERE ccnl_code = p_ccnl_code
    AND from_level_code = v_base_level
    AND v_years >= min_years_service
    AND (max_years_service IS NULL OR v_years < max_years_service)
    AND (NOT requires_reports OR v_has_reports)
    AND (NOT requires_management OR v_is_mgmt)
  ORDER BY priority ASC, min_years_service DESC
  LIMIT 1;

  RETURN COALESCE(v_target_level, v_base_level);
END;
$$;

-- ============================================================
-- 6. Seed livelli CCNL_CRED_2024 (giugno 2025)
-- Fonti: UILCA, FIRST CISL, FISAC CGIL, Lexplain
-- ============================================================
INSERT INTO ccnl_levels (ccnl_code, level_code, level_name, level_order, category, monthly_salary, num_monthly_payments, effective_date, source_url) VALUES
  ('CCNL_CRED_2024','QD4','Quadro Direttivo 4° livello',9,'quadro_direttivo',5113.03,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','QD3','Quadro Direttivo 3° livello',8,'quadro_direttivo',4356.02,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','QD2','Quadro Direttivo 2° livello',7,'quadro_direttivo',3926.69,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','QD1','Quadro Direttivo 1° livello',6,'quadro_direttivo',3706.24,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','3A4L','3ª Area Professionale 4° livello',5,'area_professionale',3306.90,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','3A3L','3ª Area Professionale 3° livello',4,'area_professionale',3029.29,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','3A2L','3ª Area Professionale 2° livello',3,'area_professionale',2861.88,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','3A1L','3ª Area Professionale 1° livello',2,'area_professionale',2715.28,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/'),
  ('CCNL_CRED_2024','AU','Area Unificata (ex 1ª-2ª)',1,'area_unificata',2454.98,13,'2025-06-01','https://www.lexplain.it/tabelle-retributive-bancari-2024-2026/')
ON CONFLICT (ccnl_code, level_code, effective_date) DO UPDATE
SET monthly_salary = EXCLUDED.monthly_salary,
    num_monthly_payments = EXCLUDED.num_monthly_payments,
    updated_at = now();

-- ============================================================
-- 7. Seed job_title mapping CCNL_CRED_2024
-- Priorità: numero più basso = più specifico (match prima)
-- ============================================================
INSERT INTO ccnl_job_title_mapping (ccnl_code, job_title_pattern, match_type, base_level_code, is_management, priority, notes) VALUES
  -- Top management (priority 10-20)
  ('CCNL_CRED_2024','%ceo%','ilike','QD4',true,10,'Chief Executive'),
  ('CCNL_CRED_2024','%cfo%','ilike','QD4',true,10,'Chief Financial'),
  ('CCNL_CRED_2024','%cto%','ilike','QD4',true,10,'Chief Technology'),
  ('CCNL_CRED_2024','%chief %','ilike','QD4',true,15,'Chief C-Suite'),
  ('CCNL_CRED_2024','%general manager%','ilike','QD4',true,20,'General Manager'),
  -- Direction (priority 30-40)
  ('CCNL_CRED_2024','%head of %','ilike','QD3',true,30,'Head of function'),
  ('CCNL_CRED_2024','%director%','ilike','QD3',true,30,'Director'),
  ('CCNL_CRED_2024','%vice president%','ilike','QD3',true,35,'VP'),
  -- Management intermedio (priority 50)
  ('CCNL_CRED_2024','%branch manager%','ilike','QD1',true,50,'Branch manager'),
  ('CCNL_CRED_2024','%bank manager%','ilike','3A4L',true,55,'Bank manager'),
  ('CCNL_CRED_2024','%team lead%','ilike','3A4L',true,55,'Team lead'),
  ('CCNL_CRED_2024','%senior manager%','ilike','QD1',true,50,'Senior manager'),
  -- Area professionale senior (priority 60-70)
  ('CCNL_CRED_2024','%senior %analyst%','ilike','3A4L',false,60,'Senior analyst'),
  ('CCNL_CRED_2024','%compliance officer%','ilike','3A3L',false,65,'Compliance officer'),
  ('CCNL_CRED_2024','%investment advisor%','ilike','3A3L',false,65,'Investment advisor'),
  ('CCNL_CRED_2024','%securities dealer%','ilike','3A3L',false,65,'Securities dealer'),
  ('CCNL_CRED_2024','%relationship manager%','ilike','3A3L',false,65,'Relationship manager'),
  ('CCNL_CRED_2024','%portfolio manager%','ilike','3A3L',false,65,'Portfolio manager'),
  -- Area professionale intermedia (priority 80)
  ('CCNL_CRED_2024','%risk analyst%','ilike','3A2L',false,80,'Risk analyst'),
  ('CCNL_CRED_2024','%financial analyst%','ilike','3A2L',false,80,'Financial analyst'),
  ('CCNL_CRED_2024','%credit analyst%','ilike','3A2L',false,80,'Credit analyst'),
  ('CCNL_CRED_2024','%loan officer%','ilike','3A2L',false,80,'Loan officer'),
  ('CCNL_CRED_2024','%accountant%','ilike','3A2L',false,80,'Accountant'),
  ('CCNL_CRED_2024','%auditor%','ilike','3A2L',false,80,'Auditor'),
  -- Area professionale junior (priority 90)
  ('CCNL_CRED_2024','%bank teller%','ilike','3A1L',false,90,'Bank teller'),
  ('CCNL_CRED_2024','%cashier%','ilike','3A1L',false,90,'Cashier'),
  ('CCNL_CRED_2024','%customer service%','ilike','3A1L',false,90,'Customer service'),
  ('CCNL_CRED_2024','%back office%','ilike','3A1L',false,90,'Back office'),
  ('CCNL_CRED_2024','%junior %','ilike','3A1L',false,95,'Junior role'),
  -- Fallback (priority 999)
  ('CCNL_CRED_2024','%','ilike','3A1L',false,999,'Fallback: job_title non mappato')
ON CONFLICT (ccnl_code, job_title_pattern) DO UPDATE
SET base_level_code = EXCLUDED.base_level_code,
    is_management = EXCLUDED.is_management,
    priority = EXCLUDED.priority,
    notes = EXCLUDED.notes;

-- ============================================================
-- 8. Seed seniority rules CCNL_CRED_2024
-- ============================================================
INSERT INTO ccnl_seniority_rules (ccnl_code, from_level_code, min_years_service, max_years_service, requires_reports, requires_management, target_level_code, priority, notes) VALUES
  -- Area professionale progression
  ('CCNL_CRED_2024','3A1L',4,8,false,false,'3A2L',100,'Junior → Intermedio dopo 4 anni'),
  ('CCNL_CRED_2024','3A1L',8,12,false,false,'3A3L',90,'Junior → Senior dopo 8 anni'),
  ('CCNL_CRED_2024','3A1L',12,NULL,false,false,'3A4L',80,'Junior → Top area dopo 12 anni'),
  ('CCNL_CRED_2024','3A2L',4,8,false,false,'3A3L',100,'Intermedio → Senior dopo 4 anni'),
  ('CCNL_CRED_2024','3A2L',8,NULL,false,false,'3A4L',90,'Intermedio → Top area dopo 8 anni'),
  ('CCNL_CRED_2024','3A3L',4,NULL,false,false,'3A4L',100,'Senior → Top area dopo 4 anni in 3A3L'),
  -- Promozione a quadro per management con anzianità
  ('CCNL_CRED_2024','3A4L',10,NULL,true,true,'QD1',50,'Top area + management + riporti + 10 anni → QD1'),
  ('CCNL_CRED_2024','3A4L',15,NULL,false,false,'QD1',60,'Top area + 15 anni → QD1 anche senza riporti'),
  -- Progressione intra-QD
  ('CCNL_CRED_2024','QD1',5,NULL,true,true,'QD2',100,'QD1 → QD2 dopo 5 anni con riporti'),
  ('CCNL_CRED_2024','QD2',5,NULL,true,true,'QD3',100,'QD2 → QD3 dopo 5 anni con riporti');

COMMIT;
