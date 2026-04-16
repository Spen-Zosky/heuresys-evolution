-- Migration 097: Seed 19 new tables with realistic RTL Bank data
-- Uses subqueries to reference existing employees, departments, etc.
-- ON CONFLICT DO NOTHING for idempotency

BEGIN;

DO $$
DECLARE
  v_rtl UUID := '0c54b84a-db6e-4da4-bc91-af5d480d524e';
  v_emp_ids UUID[];
  v_dept_ids UUID[];
  v_contract_ids UUID[];
  v_course_ids UUID[];
  v_wf_plan_ids UUID[];
  v_calib_ids UUID[];
  v_review_ids UUID[];
  v_skill_ids UUID[];
  v_perm_ids UUID[];
  v_loc_ids UUID[];
  v_i INTEGER;
  v_emp UUID;
  v_dept UUID;
BEGIN
  -- Load FK arrays
  SELECT array_agg(id) INTO v_emp_ids FROM (SELECT id FROM employees WHERE tenant_id = v_rtl ORDER BY random() LIMIT 100) x;
  SELECT array_agg(id) INTO v_dept_ids FROM departments WHERE tenant_id = v_rtl;
  SELECT array_agg(id) INTO v_contract_ids FROM (SELECT id FROM contracts WHERE tenant_id = v_rtl LIMIT 50) x;
  SELECT array_agg(id) INTO v_course_ids FROM courses WHERE tenant_id = v_rtl;
  SELECT array_agg(id) INTO v_wf_plan_ids FROM workforce_plans WHERE tenant_id = v_rtl;
  SELECT array_agg(id) INTO v_calib_ids FROM calibration_sessions WHERE tenant_id = v_rtl;
  SELECT array_agg(id) INTO v_review_ids FROM (SELECT id FROM performance_reviews WHERE tenant_id = v_rtl LIMIT 50) x;
  SELECT array_agg(id) INTO v_skill_ids FROM (SELECT id FROM esco_skills LIMIT 50) x;
  SELECT array_agg(id) INTO v_perm_ids FROM (SELECT id FROM permissions LIMIT 20) x;
  SELECT array_agg(id) INTO v_loc_ids FROM locations WHERE tenant_id = v_rtl;

  -- ============================================================
  -- 1. employee_contracts (~100 rows)
  -- ============================================================
  FOR v_i IN 1..100 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    INSERT INTO employee_contracts (tenant_id, employee_id, contract_type, start_date, end_date, ccnl_code, level, annual_salary, fte_percentage, is_current)
    VALUES (
      v_rtl, v_emp,
      CASE (v_i % 4) WHEN 0 THEN 'permanent' WHEN 1 THEN 'permanent' WHEN 2 THEN 'fixed_term' ELSE 'apprenticeship' END,
      CURRENT_DATE - (v_i * 30 + random() * 365)::integer,
      CASE WHEN v_i % 4 >= 2 THEN CURRENT_DATE + (random() * 365)::integer ELSE NULL END,
      CASE (v_i % 3) WHEN 0 THEN 'CCNL_CB' WHEN 1 THEN 'CCNL_CB' ELSE 'CCNL_DIR' END,
      CASE (v_i % 5) WHEN 0 THEN 'A1' WHEN 1 THEN 'A2' WHEN 2 THEN 'B1' WHEN 3 THEN 'QD1' ELSE 'QD2' END,
      30000 + (random() * 80000)::integer,
      CASE WHEN v_i % 10 = 0 THEN 80.00 ELSE 100.00 END,
      v_i <= 50
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 2. employee_addresses (~200 rows)
  -- ============================================================
  FOR v_i IN 1..100 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    -- Home address
    INSERT INTO employee_addresses (tenant_id, employee_id, address_type, street, city, postal_code, province, country_code, is_primary)
    VALUES (v_rtl, v_emp, 'home',
      'Via ' || CASE (v_i % 8)
        WHEN 0 THEN 'Roma' WHEN 1 THEN 'Milano' WHEN 2 THEN 'Garibaldi'
        WHEN 3 THEN 'Manzoni' WHEN 4 THEN 'Verdi' WHEN 5 THEN 'Dante'
        WHEN 6 THEN 'Cavour' ELSE 'Marconi' END || ' ' || (1 + v_i % 150)::text,
      CASE (v_i % 6)
        WHEN 0 THEN 'Milano' WHEN 1 THEN 'Bergamo' WHEN 2 THEN 'Brescia'
        WHEN 3 THEN 'Monza' WHEN 4 THEN 'Como' ELSE 'Varese' END,
      '20' || lpad((100 + v_i % 99)::text, 3, '0'),
      CASE (v_i % 4) WHEN 0 THEN 'MI' WHEN 1 THEN 'BG' WHEN 2 THEN 'BS' ELSE 'MB' END,
      'IT', true
    ) ON CONFLICT DO NOTHING;
    -- Work address for 50%
    IF v_i <= 50 THEN
      INSERT INTO employee_addresses (tenant_id, employee_id, address_type, street, city, postal_code, province, country_code, is_primary)
      VALUES (v_rtl, v_emp, 'work', 'Piazza del Duomo 1', 'Milano', '20121', 'MI', 'IT', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- ============================================================
  -- 3. employee_emergency_contacts (~100 rows)
  -- ============================================================
  FOR v_i IN 1..100 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    INSERT INTO employee_emergency_contacts (tenant_id, employee_id, name, phone, relationship, is_primary)
    VALUES (v_rtl, v_emp,
      CASE (v_i % 6)
        WHEN 0 THEN 'Maria Rossi' WHEN 1 THEN 'Giuseppe Bianchi' WHEN 2 THEN 'Anna Verdi'
        WHEN 3 THEN 'Marco Ferrari' WHEN 4 THEN 'Laura Russo' ELSE 'Paolo Colombo' END,
      '+39 ' || (320 + v_i % 30)::text || ' ' || lpad((1000000 + v_i * 7919)::text, 7, '0'),
      CASE (v_i % 4) WHEN 0 THEN 'coniuge' WHEN 1 THEN 'genitore' WHEN 2 THEN 'figlio/a' ELSE 'fratello/sorella' END,
      true
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 4. employee_bank_details (~100 rows)
  -- ============================================================
  FOR v_i IN 1..100 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    INSERT INTO employee_bank_details (tenant_id, employee_id, iban, swift_bic, bank_name, is_primary)
    VALUES (v_rtl, v_emp,
      'IT' || lpad((60 + v_i % 40)::text, 2, '0') || 'X' || lpad((v_i * 31)::text, 5, '0') || lpad((v_i * 137)::text, 5, '0') || lpad((v_i * 997)::text, 12, '0'),
      CASE (v_i % 4) WHEN 0 THEN 'UNCRITMM' WHEN 1 THEN 'BCITITMM' WHEN 2 THEN 'BPMOIT22' ELSE 'PASCITMM' END,
      CASE (v_i % 4) WHEN 0 THEN 'UniCredit' WHEN 1 THEN 'Intesa Sanpaolo' WHEN 2 THEN 'Banco BPM' ELSE 'MPS' END,
      true
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 5. salary_history (~200 rows)
  -- ============================================================
  FOR v_i IN 1..100 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    -- Initial salary
    INSERT INTO salary_history (tenant_id, employee_id, effective_date, salary, salary_type, change_reason, contract_id)
    VALUES (v_rtl, v_emp,
      CURRENT_DATE - (365 * 2 + v_i * 10)::integer,
      28000 + (random() * 60000)::integer,
      'annual', 'hire',
      v_contract_ids[1 + (v_i - 1) % array_length(v_contract_ids, 1)]
    ) ON CONFLICT DO NOTHING;
    -- Salary adjustment for 50%
    IF v_i <= 50 THEN
      INSERT INTO salary_history (tenant_id, employee_id, effective_date, salary, salary_type, change_reason, previous_salary, change_percentage)
      VALUES (v_rtl, v_emp,
        CURRENT_DATE - (365 + v_i * 5)::integer,
        32000 + (random() * 65000)::integer,
        'annual',
        CASE (v_i % 3) WHEN 0 THEN 'merit' WHEN 1 THEN 'promotion' ELSE 'adjustment' END,
        28000 + (random() * 60000)::integer,
        2.0 + (random() * 8)::numeric(3,1)
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- ============================================================
  -- 6. employee_training_records (~150 rows)
  -- ============================================================
  FOR v_i IN 1..150 LOOP
    v_emp := v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)];
    INSERT INTO employee_training_records (tenant_id, employee_id, course_id, training_title, training_type, provider, start_date, completion_date, status, score, passed, credit_hours)
    VALUES (v_rtl, v_emp,
      CASE WHEN v_i % 3 = 0 THEN v_course_ids[1 + (v_i - 1) % array_length(v_course_ids, 1)] ELSE NULL END,
      CASE (v_i % 10)
        WHEN 0 THEN 'AML/KYC Compliance' WHEN 1 THEN 'Basel III Framework'
        WHEN 2 THEN 'Credit Risk Assessment' WHEN 3 THEN 'GDPR Data Protection'
        WHEN 4 THEN 'Cybersecurity Awareness' WHEN 5 THEN 'Financial Derivatives'
        WHEN 6 THEN 'Customer Due Diligence' WHEN 7 THEN 'Treasury Management'
        WHEN 8 THEN 'Leadership Development' ELSE 'Agile Project Management' END,
      CASE WHEN v_i % 3 = 0 THEN 'internal' WHEN v_i % 3 = 1 THEN 'external' ELSE 'compliance' END,
      CASE WHEN v_i % 3 != 0 THEN
        CASE (v_i % 4) WHEN 0 THEN 'SDA Bocconi' WHEN 1 THEN 'AIFIRM' WHEN 2 THEN 'AIDP' ELSE 'MIP Politecnico' END
      ELSE NULL END,
      CURRENT_DATE - (v_i * 7 + (random() * 100)::integer),
      CASE WHEN v_i % 5 != 0 THEN CURRENT_DATE - (v_i * 5)::integer ELSE NULL END,
      CASE WHEN v_i % 5 = 0 THEN 'in_progress' WHEN v_i % 7 = 0 THEN 'cancelled' ELSE 'completed' END,
      CASE WHEN v_i % 5 != 0 AND v_i % 7 != 0 THEN 60 + (random() * 40)::integer ELSE NULL END,
      CASE WHEN v_i % 5 != 0 AND v_i % 7 != 0 THEN (random() > 0.1) ELSE NULL END,
      4 + (random() * 36)::integer
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 7. workforce_plan_scenarios (~10 rows)
  -- ============================================================
  FOR v_i IN 1..LEAST(10, array_length(v_wf_plan_ids, 1) * 3) LOOP
    INSERT INTO workforce_plan_scenarios (tenant_id, workforce_plan_id, name, description, scenario_type, target_date, status)
    VALUES (v_rtl,
      v_wf_plan_ids[1 + (v_i - 1) % array_length(v_wf_plan_ids, 1)],
      CASE (v_i % 3) WHEN 0 THEN 'Scenario Base' WHEN 1 THEN 'Scenario Ottimistico' ELSE 'Scenario Pessimistico' END || ' ' || ((v_i - 1) / 3 + 1)::text,
      'Proiezione workforce ' || CASE (v_i % 3) WHEN 0 THEN 'baseline' WHEN 1 THEN 'con espansione' ELSE 'con riduzione' END,
      CASE (v_i % 3) WHEN 0 THEN 'base' WHEN 1 THEN 'optimistic' ELSE 'pessimistic' END,
      CURRENT_DATE + (180 + v_i * 30),
      CASE WHEN v_i <= 3 THEN 'active' ELSE 'draft' END
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 8. workforce_plan_actions (~20 rows)
  -- ============================================================
  FOR v_i IN 1..20 LOOP
    v_dept := v_dept_ids[1 + (v_i - 1) % array_length(v_dept_ids, 1)];
    INSERT INTO workforce_plan_actions (tenant_id, workforce_plan_id, action_type, priority, title, description, target_department_id, headcount, target_date, status, estimated_cost)
    VALUES (v_rtl,
      v_wf_plan_ids[1 + (v_i - 1) % array_length(v_wf_plan_ids, 1)],
      CASE (v_i % 5) WHEN 0 THEN 'hire' WHEN 1 THEN 'train' WHEN 2 THEN 'transfer' WHEN 3 THEN 'promote' ELSE 'redeploy' END,
      CASE (v_i % 4) WHEN 0 THEN 'critical' WHEN 1 THEN 'high' WHEN 2 THEN 'medium' ELSE 'low' END,
      CASE (v_i % 5)
        WHEN 0 THEN 'Assunzione Analista Rischio' WHEN 1 THEN 'Formazione AI/ML Team'
        WHEN 2 THEN 'Trasferimento da Retail a Corporate' WHEN 3 THEN 'Promozione Team Lead IT'
        ELSE 'Riposizionamento Operations' END || ' #' || v_i::text,
      'Azione pianificata per il Q' || (1 + v_i % 4)::text || ' 2026',
      v_dept, 1 + (v_i % 3),
      CURRENT_DATE + (30 + v_i * 15),
      CASE WHEN v_i <= 5 THEN 'in_progress' WHEN v_i <= 10 THEN 'pending' ELSE 'draft' END,
      10000 + (random() * 50000)::integer
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 9. internal_mobility_postings (~15 rows)
  -- ============================================================
  FOR v_i IN 1..15 LOOP
    v_dept := v_dept_ids[1 + (v_i - 1) % array_length(v_dept_ids, 1)];
    INSERT INTO internal_mobility_postings (tenant_id, title, department_id, location_id, work_type, summary, job_level, job_family, required_skills, min_tenure_months, status, posted_at, expires_at, hiring_manager_id)
    VALUES (v_rtl,
      CASE (v_i % 8)
        WHEN 0 THEN 'Senior Risk Analyst' WHEN 1 THEN 'IT Project Manager'
        WHEN 2 THEN 'Compliance Officer' WHEN 3 THEN 'Corporate Relationship Manager'
        WHEN 4 THEN 'Data Engineer' WHEN 5 THEN 'Branch Manager'
        WHEN 6 THEN 'Treasury Specialist' ELSE 'HR Business Partner' END,
      v_dept,
      v_loc_ids[1 + (v_i - 1) % array_length(v_loc_ids, 1)],
      CASE (v_i % 3) WHEN 0 THEN 'hybrid' WHEN 1 THEN 'onsite' ELSE 'remote' END,
      'Opportunita di mobilita interna per profilo bancario qualificato.',
      CASE (v_i % 4) WHEN 0 THEN 'senior' WHEN 1 THEN 'middle' WHEN 2 THEN 'junior' ELSE 'lead' END,
      CASE (v_i % 5) WHEN 0 THEN 'Risk' WHEN 1 THEN 'IT' WHEN 2 THEN 'Compliance' WHEN 3 THEN 'Commercial' ELSE 'Operations' END,
      ARRAY[CASE (v_i % 4) WHEN 0 THEN 'risk_management' WHEN 1 THEN 'project_management' WHEN 2 THEN 'aml_kyc' ELSE 'data_analysis' END],
      6 + (v_i % 12),
      CASE WHEN v_i <= 8 THEN 'open' WHEN v_i <= 12 THEN 'draft' ELSE 'closed' END,
      CASE WHEN v_i <= 8 THEN now() - (v_i || ' days')::interval ELSE NULL END,
      CASE WHEN v_i <= 8 THEN now() + ((60 - v_i * 3) || ' days')::interval ELSE NULL END,
      v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)]
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 10. job_families (~15 rows)
  -- ============================================================
  INSERT INTO job_families (tenant_id, code, name, description) VALUES
    (v_rtl, 'RISK', 'Risk Management', 'Gestione del rischio e compliance normativa'),
    (v_rtl, 'IT', 'Information Technology', 'Sistemi informativi e infrastruttura tecnologica'),
    (v_rtl, 'FIN', 'Finance & Accounting', 'Contabilita, tesoreria e pianificazione finanziaria'),
    (v_rtl, 'COMM', 'Commercial Banking', 'Banca commerciale e gestione clienti corporate'),
    (v_rtl, 'RETAIL', 'Retail Banking', 'Banca retail e gestione clienti privati'),
    (v_rtl, 'HR', 'Human Resources', 'Gestione risorse umane e sviluppo organizzativo'),
    (v_rtl, 'LEGAL', 'Legal & Compliance', 'Affari legali e conformita normativa'),
    (v_rtl, 'OPS', 'Operations', 'Operazioni bancarie e back office'),
    (v_rtl, 'MKT', 'Marketing & Communications', 'Marketing, comunicazione e branding'),
    (v_rtl, 'AUDIT', 'Internal Audit', 'Revisione interna e controllo'),
    (v_rtl, 'WM', 'Wealth Management', 'Gestione patrimoniale e consulenza finanziaria'),
    (v_rtl, 'TREAS', 'Treasury', 'Tesoreria e gestione liquidita'),
    (v_rtl, 'DATA', 'Data & Analytics', 'Data science, analytics e business intelligence'),
    (v_rtl, 'PM', 'Project Management', 'Gestione progetti e programmi'),
    (v_rtl, 'ADMIN', 'General Administration', 'Servizi generali e amministrazione')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 11. job_analysis (~20 rows)
  -- ============================================================
  INSERT INTO job_analysis (tenant_id, job_title, job_family_id, department_id, job_level, scope_of_work, complexity_score, analysis_date, status)
  SELECT v_rtl, t.title, jf.id, d.id, t.level, t.scope, t.complexity, CURRENT_DATE - (random() * 180)::integer, 'approved'
  FROM (VALUES
    ('Senior Risk Analyst', 'RISK', 'Risk Management', 'senior', 'Analisi quantitativa del rischio di credito e mercato', 4),
    ('IT Security Specialist', 'IT', 'Information Technology', 'senior', 'Gestione sicurezza informatica e penetration testing', 5),
    ('Credit Analyst', 'FIN', 'Finance & Treasury', 'middle', 'Valutazione merito creditizio clienti corporate', 3),
    ('Relationship Manager Corporate', 'COMM', 'Commercial Banking', 'senior', 'Gestione portafoglio clienti corporate top-tier', 4),
    ('Branch Operations Manager', 'RETAIL', 'Retail Banking', 'middle', 'Coordinamento operazioni di filiale', 3),
    ('HR Business Partner', 'HR', 'Human Resources', 'senior', 'Supporto strategico HR per business unit', 4),
    ('Compliance Officer', 'LEGAL', 'Legal & Compliance', 'senior', 'Monitoraggio conformita normativa bancaria', 5),
    ('Back Office Specialist', 'OPS', 'Operations', 'junior', 'Elaborazione operazioni post-trade', 2),
    ('Digital Marketing Manager', 'MKT', 'Marketing', 'middle', 'Strategia marketing digitale e social media', 3),
    ('Internal Auditor', 'AUDIT', 'Legal & Compliance', 'middle', 'Audit processi e controlli interni', 4),
    ('Portfolio Manager', 'WM', 'Commercial Banking', 'senior', 'Gestione portafogli clienti HNWI', 5),
    ('Treasury Analyst', 'TREAS', 'Finance & Treasury', 'middle', 'Gestione liquidita e posizioni cambi', 4),
    ('Data Engineer', 'DATA', 'Information Technology', 'middle', 'Progettazione pipeline dati e data warehouse', 4),
    ('Scrum Master', 'PM', 'Information Technology', 'middle', 'Facilitazione processi agili per team IT', 3),
    ('Receptionist', 'ADMIN', 'Direzione Generale', 'junior', 'Accoglienza e gestione centralino', 1)
  ) AS t(title, jf_code, dept_name, level, scope, complexity)
  JOIN job_families jf ON jf.tenant_id = v_rtl AND jf.code = t.jf_code
  JOIN departments d ON d.tenant_id = v_rtl AND d.name = t.dept_name
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 12. job_evaluations (~15 rows)
  -- ============================================================
  INSERT INTO job_evaluations (tenant_id, job_analysis_id, job_title, evaluation_method, total_points, job_grade, knowledge_points, problem_solving_points, accountability_points, evaluation_date, status)
  SELECT v_rtl, ja.id, ja.job_title, 'point_factor',
    (ja.complexity_score * 100 + (random() * 150)::integer),
    CASE ja.complexity_score WHEN 5 THEN 'A' WHEN 4 THEN 'B' WHEN 3 THEN 'C' WHEN 2 THEN 'D' ELSE 'E' END,
    ja.complexity_score * 30 + (random() * 50)::integer,
    ja.complexity_score * 25 + (random() * 40)::integer,
    ja.complexity_score * 20 + (random() * 30)::integer,
    CURRENT_DATE - (random() * 90)::integer,
    'approved'
  FROM job_analysis ja WHERE ja.tenant_id = v_rtl
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 13. ontology_feedback (~30 rows)
  -- ============================================================
  FOR v_i IN 1..30 LOOP
    INSERT INTO ontology_feedback (tenant_id, entity_type, entity_id, feedback_type, feedback_text, submitted_by)
    VALUES (v_rtl,
      CASE (v_i % 3) WHEN 0 THEN 'skill_relation' WHEN 1 THEN 'skill_suggestion' ELSE 'embedding' END,
      v_skill_ids[1 + (v_i - 1) % array_length(v_skill_ids, 1)],
      CASE (v_i % 4) WHEN 0 THEN 'approve' WHEN 1 THEN 'reject' WHEN 2 THEN 'flag' ELSE 'suggest_edit' END,
      CASE (v_i % 4)
        WHEN 0 THEN 'Relazione corretta e ben categorizzata'
        WHEN 1 THEN 'Skill non pertinente al contesto bancario'
        WHEN 2 THEN 'Necessita revisione da parte di esperto del dominio'
        ELSE 'Suggerisco aggiungere il contesto regolamentare' END,
      v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)]
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 14. ontology_quality_metrics (~50 rows)
  -- ============================================================
  FOR v_i IN 1..50 LOOP
    INSERT INTO ontology_quality_metrics (entity_type, entity_id, metric_name, metric_value, model_version)
    VALUES (
      CASE (v_i % 2) WHEN 0 THEN 'ontology_skill' ELSE 'ontology_skill_relations' END,
      v_skill_ids[1 + (v_i - 1) % array_length(v_skill_ids, 1)],
      CASE (v_i % 3) WHEN 0 THEN 'coverage' WHEN 1 THEN 'accuracy' ELSE 'completeness' END,
      0.5 + (random() * 0.5)::numeric(5,4),
      'text-embedding-3-small-v1'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 15. ontology_source_mappings (~40 rows)
  -- ============================================================
  FOR v_i IN 1..40 LOOP
    INSERT INTO ontology_source_mappings (tenant_id, source_system, source_id, source_type, target_table, target_id, confidence_score, mapping_method, verified)
    VALUES (v_rtl,
      CASE (v_i % 3) WHEN 0 THEN 'esco' WHEN 1 THEN 'onet' ELSE 'sap' END,
      CASE (v_i % 3) WHEN 0 THEN 'http://data.europa.eu/esco/skill/' || v_i::text WHEN 1 THEN 'O*NET/' || (11 + v_i)::text || '.0' ELSE 'SAP/QK/' || lpad(v_i::text, 4, '0') END,
      'skill',
      'esco_skills',
      v_skill_ids[1 + (v_i - 1) % array_length(v_skill_ids, 1)],
      0.6 + (random() * 0.4)::numeric(5,4),
      CASE (v_i % 4) WHEN 0 THEN 'exact' WHEN 1 THEN 'fuzzy' WHEN 2 THEN 'ai_inferred' ELSE 'manual' END,
      v_i % 3 = 0
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 16. cross_entity_relations (~50 rows)
  -- ============================================================
  FOR v_i IN 1..50 LOOP
    INSERT INTO cross_entity_relations (tenant_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type, confidence_score, source)
    VALUES (v_rtl,
      CASE (v_i % 4) WHEN 0 THEN 'skill' WHEN 1 THEN 'employee' WHEN 2 THEN 'course' ELSE 'job_posting' END,
      CASE (v_i % 4)
        WHEN 0 THEN v_skill_ids[1 + (v_i - 1) % array_length(v_skill_ids, 1)]
        WHEN 1 THEN v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)]
        WHEN 2 THEN v_course_ids[1 + (v_i - 1) % array_length(v_course_ids, 1)]
        ELSE v_emp_ids[1 + v_i % array_length(v_emp_ids, 1)] END,
      CASE (v_i % 3) WHEN 0 THEN 'skill' WHEN 1 THEN 'course' ELSE 'employee' END,
      CASE (v_i % 3)
        WHEN 0 THEN v_skill_ids[1 + v_i % array_length(v_skill_ids, 1)]
        WHEN 1 THEN v_course_ids[1 + v_i % array_length(v_course_ids, 1)]
        ELSE v_emp_ids[1 + v_i % array_length(v_emp_ids, 1)] END,
      CASE (v_i % 4) WHEN 0 THEN 'requires' WHEN 1 THEN 'enables' WHEN 2 THEN 'related_to' ELSE 'maps_to' END,
      0.5 + (random() * 0.5)::numeric(5,4),
      CASE (v_i % 3) WHEN 0 THEN 'ai_inferred' WHEN 1 THEN 'manual' ELSE 'esco_hierarchy' END
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 17. skill_taxonomy_extensions (~30 rows)
  -- ============================================================
  FOR v_i IN 1..30 LOOP
    INSERT INTO skill_taxonomy_extensions (tenant_id, skill_id, extension_type, extension_key, extension_value, source, is_approved)
    VALUES (v_rtl,
      v_skill_ids[1 + (v_i - 1) % array_length(v_skill_ids, 1)],
      CASE (v_i % 4) WHEN 0 THEN 'alias' WHEN 1 THEN 'custom_description' WHEN 2 THEN 'industry_context' ELSE 'proficiency_guide' END,
      CASE (v_i % 4)
        WHEN 0 THEN 'banking_alias' WHEN 1 THEN 'it_description'
        WHEN 2 THEN 'banking_context' ELSE 'level_' || (1 + v_i % 5)::text END,
      CASE (v_i % 4)
        WHEN 0 THEN 'Termine bancario alternativo per la competenza'
        WHEN 1 THEN 'Descrizione adattata al contesto IT bancario'
        WHEN 2 THEN 'Applicazione specifica nel settore bancario regolamentato'
        ELSE 'Guida alla valutazione del livello di competenza' END,
      CASE (v_i % 3) WHEN 0 THEN 'manual' WHEN 1 THEN 'ai_generated' ELSE 'imported' END,
      v_i % 2 = 0
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 18. calibration_results (~50 rows)
  -- ============================================================
  FOR v_i IN 1..LEAST(50, array_length(v_calib_ids, 1) * 20) LOOP
    INSERT INTO calibration_results (tenant_id, calibration_session_id, employee_id, performance_review_id, pre_calibration_rating, post_calibration_rating, final_rating, justification, is_outlier)
    VALUES (v_rtl,
      v_calib_ids[1 + (v_i - 1) % array_length(v_calib_ids, 1)],
      v_emp_ids[1 + (v_i - 1) % array_length(v_emp_ids, 1)],
      CASE WHEN v_i <= array_length(v_review_ids, 1) THEN v_review_ids[v_i] ELSE NULL END,
      (2 + random() * 3)::numeric(3,1),
      (2 + random() * 3)::numeric(3,1),
      (2.5 + random() * 2.5)::numeric(3,1),
      CASE (v_i % 5)
        WHEN 0 THEN 'Rating confermato dopo calibrazione'
        WHEN 1 THEN 'Allineato alla media del dipartimento'
        WHEN 2 THEN 'Rating alzato per risultati eccezionali Q4'
        WHEN 3 THEN 'Rating abbassato per normalizzazione curva'
        ELSE 'Calibrato secondo distribuzione target' END,
      v_i % 10 = 0
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================================
  -- 19. permission_overrides (~10 rows)
  -- ============================================================
  FOR v_i IN 1..LEAST(10, array_length(v_perm_ids, 1)) LOOP
    INSERT INTO permission_overrides (tenant_id, role, permission_id, is_granted, reason)
    VALUES (v_rtl,
      CASE (v_i % 4) WHEN 0 THEN 'HR' WHEN 1 THEN 'ADMIN' WHEN 2 THEN 'USER' ELSE 'DEMO' END,
      v_perm_ids[v_i],
      v_i % 3 != 0,
      CASE WHEN v_i % 3 = 0 THEN 'Permesso revocato per policy bancaria' ELSE 'Override concesso per ruolo specifico' END
    ) ON CONFLICT DO NOTHING;
  END LOOP;

END $$;

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('097_seed_new_tables', now())
ON CONFLICT DO NOTHING;

COMMIT;
