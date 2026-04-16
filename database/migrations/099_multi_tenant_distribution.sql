-- Migration 099: Multi-tenant data distribution
-- Part of REPRISE Phase 1 - Data Population
-- Distributes data across Heuresys, SmartFood, and EcoNova tenants
-- Proportional to employee count: SmartFood (~50% RTL), EcoNova (~17%), Heuresys (minimal)

BEGIN;

DO $$
DECLARE
  v_tenants RECORD;
  v_emp_ids UUID[];
  v_user_ids UUID[];
  v_goal_ids UUID[];
  v_article_ids UUID[];
  v_dept_ids UUID[];
  v_skill_ids UUID[];
  v_emp_count INTEGER;
  v_scale NUMERIC;
  v_i INTEGER;
  v_emp_id UUID;
  v_user_id UUID;
  v_goal_id UUID;
  v_article_id UUID;
  -- CHECK constraint-valid values
  v_categories TEXT[] := ARRAY['recognition','suggestion','concern','other'];
  v_ef_statuses TEXT[] := ARRAY['new','reviewed','actioned','archived'];
  v_update_types TEXT[] := ARRAY['progress','status_change','note','milestone','blocker'];
  v_reaction_types TEXT[] := ARRAY['like','celebrate','support','insightful'];
  v_wf_statuses TEXT[] := ARRAY['draft','active','completed','archived'];
  v_contract_types TEXT[] := ARRAY['tempo_indeterminato','tempo_determinato','apprendistato','collaborazione','stage'];
  v_ccnl_codes TEXT[] := ARRAY['CCNL_ALIM','CCNL_COMM','CCNL_META','CCNL_CRED','CCNL_SERV'];
  v_cities TEXT[] := ARRAY['Milano','Roma','Torino','Bologna','Firenze','Napoli','Palermo','Genova','Bari','Verona'];
  v_provinces TEXT[] := ARRAY['MI','RM','TO','BO','FI','NA','PA','GE','BA','VR'];
  v_streets TEXT[] := ARRAY['Via Roma','Corso Italia','Via Garibaldi','Viale Europa','Via Dante','Piazza Duomo','Via Manzoni','Corso Vittorio','Via Verdi','Via Leopardi'];
  v_eng_msgs TEXT[] := ARRAY[
    'Ottimo lavoro del team nel raggiungimento degli obiettivi',
    'Propongo di migliorare il processo interno',
    'Preoccupazione per i tempi di consegna',
    'Complimenti per la qualità del servizio',
    'Suggerimento per formazione cross-funzionale'
  ];
  v_goal_msgs TEXT[] := ARRAY[
    'Aggiornamento settimanale: progresso costante',
    'Milestone raggiunto con successo',
    'Revisione intermedia positiva',
    'Report mensile: KPI allineati',
    'Integrazione completata'
  ];
  v_comment_msgs TEXT[] := ARRAY[
    'Buon progresso, continuiamo così',
    'Dobbiamo rivedere la timeline',
    'Concordo con l''approccio',
    'Ottimo risultato!',
    'Attenzione ai vincoli di budget'
  ];
BEGIN
  -- Load shared skill IDs for cross-tenant references
  SELECT array_agg(id ORDER BY random()) INTO v_skill_ids
  FROM esco_skills LIMIT 50;

  FOR v_tenants IN
    SELECT id, code, name FROM tenants WHERE code != 'rtl-bank' ORDER BY code
  LOOP
    SELECT array_agg(id ORDER BY random()) INTO v_emp_ids
    FROM employees WHERE tenant_id = v_tenants.id;

    SELECT array_agg(u.id ORDER BY random()) INTO v_user_ids
    FROM users u INNER JOIN employees e ON u.employee_id = e.id
    WHERE e.tenant_id = v_tenants.id;

    SELECT array_agg(id ORDER BY random()) INTO v_goal_ids
    FROM goals WHERE tenant_id = v_tenants.id;

    SELECT array_agg(id ORDER BY random()) INTO v_article_ids
    FROM news_articles WHERE tenant_id = v_tenants.id;

    SELECT array_agg(id ORDER BY random()) INTO v_dept_ids
    FROM departments WHERE tenant_id = v_tenants.id;

    v_emp_count := COALESCE(array_length(v_emp_ids, 1), 0);
    IF v_emp_count = 0 THEN
      RAISE NOTICE 'Skipping tenant % — no employees', v_tenants.code;
      CONTINUE;
    END IF;

    v_scale := v_emp_count::numeric / 156.0;
    RAISE NOTICE 'Processing tenant: % (% employees, scale: %)', v_tenants.code, v_emp_count, ROUND(v_scale, 2);

    -- ═══════════════════════════════════════════════════════════════
    -- 1. EMPLOYEE_CONTRACTS (1 per employee)
    -- Cols: tenant_id, employee_id, contract_type, start_date, ccnl_code, level,
    --       annual_salary, currency, fte_percentage, probation_end_date, is_current
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..v_emp_count LOOP
      v_emp_id := v_emp_ids[v_i];
      INSERT INTO employee_contracts (tenant_id, employee_id, contract_type, start_date,
        ccnl_code, level, annual_salary, currency, fte_percentage, probation_end_date, is_current, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        v_contract_types[1 + (v_i % array_length(v_contract_types, 1))],
        (CURRENT_DATE - (365 + floor(random() * 1825))::integer),
        v_ccnl_codes[1 + (v_i % array_length(v_ccnl_codes, 1))],
        'L' || (1 + (v_i % 7)),
        (25000 + floor(random() * 55000))::numeric,
        'EUR',
        CASE WHEN random() < 0.9 THEN 100.0 ELSE 50.0 + floor(random() * 50) END,
        CURRENT_DATE - (300 + floor(random() * 500))::integer,
        (random() < 0.85),
        now() - (random() * interval '730 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 2. EMPLOYEE_ADDRESSES (~1.2 per employee)
    -- Cols: tenant_id, employee_id, address_type, street, city, province,
    --       postal_code, country_code, is_primary
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(v_emp_count * 1.2)::integer) LOOP
      v_emp_id := v_emp_ids[1 + (v_i % v_emp_count)];
      INSERT INTO employee_addresses (tenant_id, employee_id, address_type,
        street, city, province, postal_code, country_code, is_primary, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        CASE WHEN v_i <= v_emp_count THEN 'residenza' ELSE 'domicilio' END,
        v_streets[1 + (v_i % array_length(v_streets, 1))] || ' ' || (1 + v_i % 150),
        v_cities[1 + (v_i % array_length(v_cities, 1))],
        v_provinces[1 + (v_i % array_length(v_provinces, 1))],
        LPAD((10100 + v_i * 37 % 90000)::text, 5, '0'),
        'IT',
        (v_i <= v_emp_count),
        now() - (random() * interval '730 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 3. EMPLOYEE_EMERGENCY_CONTACTS (1 per employee)
    -- Cols: tenant_id, employee_id, name, relationship, phone, is_primary
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..v_emp_count LOOP
      v_emp_id := v_emp_ids[v_i];
      INSERT INTO employee_emergency_contacts (tenant_id, employee_id, name,
        relationship, phone, is_primary, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        'Contatto Emergenza ' || v_i,
        CASE (v_i % 4) WHEN 0 THEN 'coniuge' WHEN 1 THEN 'genitore' WHEN 2 THEN 'fratello' ELSE 'altro' END,
        '+39 ' || (300 + v_i % 100) || ' ' || LPAD((1000000 + v_i * 7919 % 9000000)::text, 7, '0'),
        true,
        now() - (random() * interval '730 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 4. EMPLOYEE_BANK_DETAILS (1 per employee)
    -- Cols: tenant_id, employee_id, bank_name, iban, swift_bic, bank_country,
    --       bank_key, bank_account_number, is_primary
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..v_emp_count LOOP
      v_emp_id := v_emp_ids[v_i];
      INSERT INTO employee_bank_details (tenant_id, employee_id, bank_name, iban,
        swift_bic, bank_country, is_primary, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        CASE (v_i % 5) WHEN 0 THEN 'UniCredit' WHEN 1 THEN 'Intesa Sanpaolo' WHEN 2 THEN 'BNL' WHEN 3 THEN 'Mediolanum' ELSE 'Banca Sella' END,
        'IT' || LPAD((60 + v_i % 40)::text, 2, '0') || 'X' || LPAD((v_i * 31337 % 100000)::text, 5, '0') || LPAD((v_i * 12345 % 10000000000)::text, 12, '0'),
        CASE (v_i % 3) WHEN 0 THEN 'UNCRITMM' WHEN 1 THEN 'BCITITMM' ELSE 'BNLIITRR' END,
        'IT',
        true,
        now() - (random() * interval '730 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 5. SALARY_HISTORY (~1.5 per employee)
    -- Cols: tenant_id, employee_id, effective_date, salary, previous_salary,
    --       salary_type, currency, change_reason, change_percentage, approved_by
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(v_emp_count * 1.5)::integer) LOOP
      v_emp_id := v_emp_ids[1 + (v_i % v_emp_count)];
      INSERT INTO salary_history (tenant_id, employee_id, effective_date, salary,
        previous_salary, salary_type, currency, change_reason, change_percentage, approved_by, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        (CURRENT_DATE - (v_i * 120 % 1825 + 30))::date,
        (25000 + floor(random() * 55000))::numeric,
        (22000 + floor(random() * 50000))::numeric,
        'annual',
        'EUR',
        CASE (v_i % 4) WHEN 0 THEN 'merito' WHEN 1 THEN 'promozione' WHEN 2 THEN 'adeguamento_ccnl' ELSE 'cambio_ruolo' END,
        ROUND((1 + random() * 15)::numeric, 1),
        v_emp_ids[1 + ((v_i + 10) % v_emp_count)],
        now() - (random() * interval '730 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 6. EMPLOYEE_TRAINING_RECORDS (~1.5 per employee)
    -- Cols: tenant_id, employee_id, training_title, training_type, provider,
    --       start_date, end_date, status, score, certificate_url, passed
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(v_emp_count * 1.5)::integer) LOOP
      v_emp_id := v_emp_ids[1 + (v_i % v_emp_count)];
      INSERT INTO employee_training_records (tenant_id, employee_id, training_title,
        training_type, provider, start_date, end_date, status, score, passed, certificate_url, created_at)
      VALUES (
        v_tenants.id, v_emp_id,
        CASE (v_i % 6)
          WHEN 0 THEN 'Formazione Sicurezza Lavoro'
          WHEN 1 THEN 'Corso Privacy GDPR'
          WHEN 2 THEN 'Leadership e Gestione Team'
          WHEN 3 THEN 'Competenze Digitali Avanzate'
          WHEN 4 THEN 'Gestione Progetti Agile'
          ELSE 'Compliance Normativa'
        END,
        CASE (v_i % 3) WHEN 0 THEN 'obbligatorio' WHEN 1 THEN 'professionale' ELSE 'soft_skills' END,
        CASE (v_i % 4) WHEN 0 THEN 'Interno' WHEN 1 THEN 'ISACA' WHEN 2 THEN 'Coursera' ELSE 'SDA Bocconi' END,
        (CURRENT_DATE - (30 + floor(random() * 365))::integer),
        (CURRENT_DATE - (floor(random() * 30))::integer),
        CASE WHEN random() < 0.8 THEN 'completed' WHEN random() < 0.9 THEN 'in_progress' ELSE 'planned' END,
        CASE WHEN random() < 0.8 THEN (60 + floor(random() * 41))::numeric ELSE NULL END,
        (random() < 0.85),
        CASE WHEN random() < 0.6 THEN 'https://certificates.example.com/' || gen_random_uuid()::text ELSE NULL END,
        now() - (random() * interval '365 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 7. ENGAGEMENT_FEEDBACK (scaled)
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(400 * v_scale)::integer) LOOP
      INSERT INTO engagement_feedback (tenant_id, category, message, status, created_at)
      VALUES (
        v_tenants.id,
        v_categories[1 + (v_i % array_length(v_categories, 1))],
        v_eng_msgs[1 + (v_i % array_length(v_eng_msgs, 1))],
        v_ef_statuses[1 + (v_i % array_length(v_ef_statuses, 1))],
        now() - (random() * interval '365 days')
      );
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 8. GOAL_UPDATES (scaled)
    -- ═══════════════════════════════════════════════════════════════
    IF v_goal_ids IS NOT NULL AND array_length(v_goal_ids, 1) > 0 THEN
      FOR v_i IN 1..GREATEST(1, ROUND(1000 * v_scale)::integer) LOOP
        v_goal_id := v_goal_ids[1 + (v_i % array_length(v_goal_ids, 1))];
        v_emp_id := v_emp_ids[1 + (v_i % v_emp_count)];
        INSERT INTO goal_updates (tenant_id, goal_id, author_id, update_type,
          previous_progress, new_progress, content, created_at)
        VALUES (
          v_tenants.id, v_goal_id, v_emp_id,
          v_update_types[1 + (v_i % array_length(v_update_types, 1))],
          ROUND((random() * 80)::numeric, 1),
          ROUND((random() * 100)::numeric, 1),
          v_goal_msgs[1 + (v_i % array_length(v_goal_msgs, 1))],
          now() - (random() * interval '365 days')
        );
      END LOOP;

      -- ═══════════════════════════════════════════════════════════════
      -- 9. GOAL_COMMENTS (scaled)
      -- ═══════════════════════════════════════════════════════════════
      FOR v_i IN 1..GREATEST(1, ROUND(500 * v_scale)::integer) LOOP
        v_goal_id := v_goal_ids[1 + (v_i % array_length(v_goal_ids, 1))];
        v_emp_id := v_emp_ids[1 + (v_i % v_emp_count)];
        INSERT INTO goal_comments (tenant_id, goal_id, author_id, content, is_private, created_at)
        VALUES (
          v_tenants.id, v_goal_id, v_emp_id,
          v_comment_msgs[1 + (v_i % array_length(v_comment_msgs, 1))],
          (random() < 0.2),
          now() - (random() * interval '365 days')
        );
      END LOOP;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- 10. NEWS_COMMENTS, REACTIONS, READS (if articles+users exist)
    -- ═══════════════════════════════════════════════════════════════
    IF v_article_ids IS NOT NULL AND array_length(v_article_ids, 1) > 0
       AND v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN

      FOR v_i IN 1..GREATEST(1, ROUND(250 * v_scale)::integer) LOOP
        v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
        v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
        INSERT INTO news_comments (tenant_id, article_id, user_id, content, created_at, updated_at)
        VALUES (
          v_tenants.id, v_article_id, v_user_id,
          v_comment_msgs[1 + (v_i % array_length(v_comment_msgs, 1))],
          now() - (random() * interval '180 days'),
          now() - (random() * interval '90 days')
        );
      END LOOP;

      FOR v_i IN 1..GREATEST(1, ROUND(500 * v_scale)::integer) LOOP
        v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
        v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
        INSERT INTO news_reactions (tenant_id, article_id, user_id, type, created_at)
        VALUES (
          v_tenants.id, v_article_id, v_user_id,
          v_reaction_types[1 + (v_i % array_length(v_reaction_types, 1))],
          now() - (random() * interval '180 days')
        )
        ON CONFLICT DO NOTHING;
      END LOOP;

      FOR v_i IN 1..GREATEST(1, ROUND(750 * v_scale)::integer) LOOP
        v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
        v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
        INSERT INTO news_reads (tenant_id, article_id, user_id, read_at, reading_time_seconds)
        VALUES (
          v_tenants.id, v_article_id, v_user_id,
          now() - (random() * interval '180 days'),
          (30 + floor(random() * 300))::integer
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- 11. WORKFORCE_PLANS (small count per tenant)
    -- ═══════════════════════════════════════════════════════════════
    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
      FOR v_i IN 1..GREATEST(1, ROUND(25 * v_scale)::integer) LOOP
        INSERT INTO workforce_plans (tenant_id, name, description, target_date, status,
          requirements, gap_analysis, hiring_recommendations, training_investments, summary,
          created_by, created_at)
        VALUES (
          v_tenants.id,
          'Piano Workforce ' || v_tenants.code || ' ' || v_i,
          'Piano strategico risorse umane per ' || v_tenants.name,
          (CURRENT_DATE + (v_i * 30 || ' days')::interval)::date,
          v_wf_statuses[1 + (v_i % array_length(v_wf_statuses, 1))],
          '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
          jsonb_build_object('total_headcount_change', v_i % 5, 'risk_level', 'medium'),
          v_user_ids[1 + (v_i % array_length(v_user_ids, 1))],
          now() - (random() * interval '180 days')
        );
      END LOOP;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- 12. ONTOLOGY_FEEDBACK (scaled)
    -- Cols: tenant_id, entity_type, entity_id, feedback_type, feedback_text,
    --       submitted_by, metadata
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(30 * v_scale)::integer) LOOP
      INSERT INTO ontology_feedback (tenant_id, entity_type, entity_id, feedback_type,
        feedback_text, submitted_by, created_at)
      VALUES (
        v_tenants.id,
        CASE (v_i % 3) WHEN 0 THEN 'skill' WHEN 1 THEN 'occupation' ELSE 'competency' END,
        gen_random_uuid(),
        CASE (v_i % 4) WHEN 0 THEN 'correction' WHEN 1 THEN 'addition' WHEN 2 THEN 'removal' ELSE 'clarification' END,
        'Feedback ontologico #' || v_i || ' per ' || v_tenants.code,
        v_emp_ids[1 + (v_i % v_emp_count)],
        now() - (random() * interval '180 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 13. CROSS_ENTITY_RELATIONS (scaled)
    -- Cols: tenant_id, source_entity_type, source_entity_id,
    --       target_entity_type, target_entity_id, relation_type,
    --       confidence_score, source
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(50 * v_scale)::integer) LOOP
      INSERT INTO cross_entity_relations (tenant_id, source_entity_type, source_entity_id,
        target_entity_type, target_entity_id, relation_type, confidence_score, source, created_at)
      VALUES (
        v_tenants.id,
        CASE (v_i % 3) WHEN 0 THEN 'employee' WHEN 1 THEN 'department' ELSE 'skill' END,
        CASE (v_i % 3) WHEN 0 THEN v_emp_ids[1 + (v_i % v_emp_count)]
          WHEN 1 THEN v_dept_ids[1 + (v_i % GREATEST(1, COALESCE(array_length(v_dept_ids, 1), 1)))]
          ELSE gen_random_uuid() END,
        CASE (v_i % 3) WHEN 0 THEN 'skill' WHEN 1 THEN 'employee' ELSE 'department' END,
        gen_random_uuid(),
        CASE (v_i % 4) WHEN 0 THEN 'has_skill' WHEN 1 THEN 'reports_to' WHEN 2 THEN 'requires' ELSE 'related_to' END,
        ROUND((0.5 + random() * 0.5)::numeric, 3),
        'migration_099',
        now() - (random() * interval '365 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- 14. SKILL_TAXONOMY_EXTENSIONS (scaled)
    -- Cols: tenant_id, skill_id, extension_type, extension_key,
    --       extension_value, source, language, is_approved
    -- ═══════════════════════════════════════════════════════════════
    IF v_skill_ids IS NOT NULL AND array_length(v_skill_ids, 1) > 0 THEN
      FOR v_i IN 1..GREATEST(1, ROUND(30 * v_scale)::integer) LOOP
        INSERT INTO skill_taxonomy_extensions (tenant_id, skill_id, extension_type,
          extension_key, extension_value, source, language, is_approved, created_at)
        VALUES (
          v_tenants.id,
          v_skill_ids[1 + (v_i % array_length(v_skill_ids, 1))],
          CASE (v_i % 3) WHEN 0 THEN 'alias' WHEN 1 THEN 'description' ELSE 'proficiency_level' END,
          'ext_' || v_tenants.code || '_' || v_i,
          'Estensione personalizzata per ' || v_tenants.name || ' #' || v_i,
          'migration_099',
          'it',
          (random() < 0.7),
          now() - (random() * interval '365 days')
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- 15. INTERNAL_MOBILITY_POSTINGS (small count)
    -- Cols: tenant_id, title, department_id, summary, required_skills,
    --       status, created_by, posted_at, expires_at
    -- ═══════════════════════════════════════════════════════════════
    IF v_dept_ids IS NOT NULL AND array_length(v_dept_ids, 1) > 0 THEN
      FOR v_i IN 1..GREATEST(1, ROUND(15 * v_scale)::integer) LOOP
        INSERT INTO internal_mobility_postings (tenant_id, title, department_id,
          summary, required_skills, status, created_by, posted_at, expires_at, created_at)
        VALUES (
          v_tenants.id,
          CASE (v_i % 4) WHEN 0 THEN 'Team Leader' WHEN 1 THEN 'Senior Analyst' WHEN 2 THEN 'Project Manager' ELSE 'Specialist' END || ' - ' || v_tenants.code,
          v_dept_ids[1 + (v_i % array_length(v_dept_ids, 1))],
          'Opportunità di mobilità interna per ' || v_tenants.name,
          ARRAY['3+ anni esperienza', 'Problem solving', 'Teamwork'],
          CASE WHEN random() < 0.6 THEN 'open' WHEN random() < 0.8 THEN 'closed' ELSE 'draft' END,
          v_emp_ids[1 + (v_i % v_emp_count)],
          now() - (random() * interval '90 days'),
          now() + interval '60 days',
          now() - (random() * interval '90 days')
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- 16. JOB_FAMILIES (small count)
    -- Cols: tenant_id, code, name, description, is_active
    -- ═══════════════════════════════════════════════════════════════
    FOR v_i IN 1..GREATEST(1, ROUND(15 * v_scale)::integer) LOOP
      INSERT INTO job_families (tenant_id, code, name, description, is_active, created_at)
      VALUES (
        v_tenants.id,
        'JF-' || UPPER(LEFT(v_tenants.code, 3)) || '-' || LPAD(v_i::text, 3, '0'),
        CASE (v_i % 5) WHEN 0 THEN 'Operations' WHEN 1 THEN 'Technology' WHEN 2 THEN 'Management' WHEN 3 THEN 'Sales' ELSE 'Support' END,
        'Famiglia professionale per ' || v_tenants.name,
        true,
        now() - (random() * interval '365 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Completed tenant: %', v_tenants.code;
  END LOOP;

  RAISE NOTICE 'Multi-tenant distribution complete for all tenants';
END;
$$;

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('099_multi_tenant_distribution', now());

COMMIT;
