-- Migration 098: Augment 11 CRITICAL tables from <20% to ≥50% of Phase 1 targets
-- Part of REPRISE Phase 1 - Data Population
-- Tenant: RTL Bank (0c54b84a-db6e-4da4-bc91-af5d480d524e)
-- Tables: news_comments, goal_comments, goal_updates, workforce_plans, news_reactions,
--         org_unit_tasks, news_reads, engagement_feedback, org_unit_kpis,
--         document_acknowledgments, succession_candidates

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := '0c54b84a-db6e-4da4-bc91-af5d480d524e';
  v_emp_ids UUID[];
  v_user_ids UUID[];
  v_goal_ids UUID[];
  v_article_ids UUID[];
  v_doc_ids UUID[];
  v_template_ids UUID[];
  v_critical_role_ids UUID[];
  v_i INTEGER;
  v_j INTEGER;
  v_emp_id UUID;
  v_goal_id UUID;
  v_article_id UUID;
  v_user_id UUID;
  v_categories TEXT[] := ARRAY['recognition','suggestion','concern','other'];
  v_statuses TEXT[] := ARRAY['new','reviewed','actioned','archived'];
  v_update_types TEXT[] := ARRAY['progress','status_change','note','milestone','blocker'];
  v_goal_statuses TEXT[] := ARRAY['on_track','at_risk','behind','completed','not_started'];
  v_readiness TEXT[] := ARRAY['ready_now','ready_1_year','ready_2_years','ready_3_plus_years'];
  v_reaction_types TEXT[] := ARRAY['like','celebrate','support','insightful'];
  v_frequencies TEXT[] := ARRAY['daily','weekly','biweekly','monthly','quarterly','yearly','on_demand'];
  v_directions TEXT[] := ARRAY['increase','decrease','maintain','range'];
  v_units TEXT[] := ARRAY['percentage','count','currency','hours','score','ratio','index'];
  v_wf_statuses TEXT[] := ARRAY['draft','active','completed','archived'];
  -- Realistic Italian banking engagement messages
  v_eng_msgs TEXT[] := ARRAY[
    'Ottimo lavoro del team nella gestione dei nuovi clienti corporate',
    'Propongo di migliorare il processo di onboarding digitale',
    'Preoccupazione per i tempi di risposta del supporto clienti',
    'Complimenti al team per il raggiungimento degli obiettivi trimestrali',
    'Suggerimento: implementare sessioni di formazione cross-funzionale',
    'Il nuovo sistema di ticketing ha migliorato notevolmente il workflow',
    'Necessità di aggiornare le procedure di compliance AML',
    'Eccellente collaborazione tra i dipartimenti Risk e Operations',
    'Proposta per un programma di mentoring interno',
    'Il team ha gestito brillantemente la migrazione al nuovo core banking',
    'Richiesta di maggiore flessibilità negli orari di lavoro',
    'Feedback positivo sulla nuova piattaforma di e-learning',
    'Preoccupazione per il carico di lavoro durante il periodo di bilancio',
    'Complimenti per la gestione della crisi informatica',
    'Suggerimento per migliorare la comunicazione interna'
  ];
  -- Goal update messages
  v_goal_msgs TEXT[] := ARRAY[
    'Aggiornamento settimanale: progresso costante verso l''obiettivo',
    'Milestone raggiunto: completata la prima fase di implementazione',
    'Revisione intermedia: necessario riallineare le priorità',
    'Report mensile: KPI in linea con le aspettative',
    'Blocco temporaneo risolto, ripresa delle attività',
    'Collaborazione con il team di sviluppo per accelerare i tempi',
    'Feedback dal management: approvata la modifica dell''approccio',
    'Integrazione completata con il sistema legacy',
    'Test di validazione superati con successo',
    'Formazione del team completata, fase operativa avviata'
  ];
  -- Goal comment messages
  v_goal_comment_msgs TEXT[] := ARRAY[
    'Buon progresso, continuiamo così',
    'Dobbiamo rivedere la timeline per questo obiettivo',
    'Concordo con l''approccio proposto',
    'Possiamo coinvolgere il team IT per supporto tecnico?',
    'Ottimo risultato, ben fatto!',
    'Attenzione ai vincoli di budget per questa fase',
    'La quality review ha evidenziato punti di miglioramento',
    'Propongo di schedulare un checkpoint settimanale',
    'Il cliente ha confermato la soddisfazione per i risultati',
    'Necessario allineare questo obiettivo con la strategia Q2'
  ];
  -- News comment messages
  v_news_comment_msgs TEXT[] := ARRAY[
    'Ottima notizia per il team!',
    'Questo avrà un impatto significativo sul nostro lavoro quotidiano',
    'Grazie per la comunicazione tempestiva',
    'Quando saranno disponibili maggiori dettagli?',
    'Concordo pienamente con questa direzione strategica',
    'Importante aggiornamento, condivido con il mio team',
    'Complimenti a tutti i colleghi coinvolti',
    'Sarebbe utile organizzare una sessione informativa',
    'Quali sono le tempistiche previste per l''implementazione?',
    'Questo conferma il nostro impegno verso l''innovazione'
  ];
  -- KPI names for banking
  v_kpi_names TEXT[] := ARRAY[
    'Tasso di conversione lead',
    'NPS clientela retail',
    'Tempo medio apertura conto',
    'Volumi operazioni digitali',
    'Indice soddisfazione cliente',
    'Tasso di retention clienti',
    'Numero pratiche gestite',
    'Costo per acquisizione',
    'Revenue per FTE',
    'Tasso di errore operativo',
    'Compliance score AML/KYC',
    'Tempo medio risoluzione reclami',
    'Cross-selling ratio',
    'Margine di intermediazione',
    'Coverage ratio crediti'
  ];
  -- Task names for banking org units
  v_task_names TEXT[] := ARRAY[
    'Verifica documenti KYC nuovi clienti',
    'Elaborazione richieste di finanziamento',
    'Monitoraggio transazioni sospette',
    'Gestione portafoglio titoli',
    'Riconciliazione conti fine giornata',
    'Approvazione fidi e affidamenti',
    'Aggiornamento anagrafica clienti',
    'Report settimanale liquidità',
    'Verifica compliance normativa',
    'Gestione reclami clienti',
    'Preparazione reportistica BCE',
    'Analisi rischio credito',
    'Controllo margini operativi',
    'Audit interno processi',
    'Formazione nuove procedure'
  ];
BEGIN
  -- Load FK arrays
  SELECT array_agg(id ORDER BY random()) INTO v_emp_ids
  FROM employees WHERE tenant_id = v_tenant_id;

  SELECT array_agg(id ORDER BY random()) INTO v_goal_ids
  FROM goals WHERE tenant_id = v_tenant_id;

  SELECT array_agg(id ORDER BY random()) INTO v_article_ids
  FROM news_articles WHERE tenant_id = v_tenant_id;

  SELECT array_agg(id ORDER BY random()) INTO v_doc_ids
  FROM employee_documents WHERE tenant_id = v_tenant_id LIMIT 200;

  SELECT array_agg(id ORDER BY random()) INTO v_template_ids
  FROM org_unit_templates;

  SELECT array_agg(id ORDER BY random()) INTO v_critical_role_ids
  FROM critical_roles WHERE tenant_id = v_tenant_id;

  -- Load user IDs (via join with employees for RTL Bank tenant)
  SELECT array_agg(u.id ORDER BY random()) INTO v_user_ids
  FROM users u
  INNER JOIN employees e ON u.employee_id = e.id
  WHERE e.tenant_id = v_tenant_id;

  -- ═══════════════════════════════════════════════════════════════════
  -- 1. ENGAGEMENT_FEEDBACK: 60 → 400 (need 340 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..340 LOOP
    INSERT INTO engagement_feedback (tenant_id, category, message, status, created_at)
    VALUES (
      v_tenant_id,
      v_categories[1 + (v_i % array_length(v_categories, 1))],
      v_eng_msgs[1 + (v_i % array_length(v_eng_msgs, 1))],
      v_statuses[1 + (v_i % array_length(v_statuses, 1))],
      now() - (random() * interval '365 days')
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 2. GOAL_UPDATES: 100 → 1000 (need 900 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..900 LOOP
    v_goal_id := v_goal_ids[1 + (v_i % array_length(v_goal_ids, 1))];
    v_emp_id := v_emp_ids[1 + (v_i % array_length(v_emp_ids, 1))];
    INSERT INTO goal_updates (tenant_id, goal_id, author_id, update_type,
      previous_progress, new_progress, content, created_at)
    VALUES (
      v_tenant_id,
      v_goal_id,
      v_emp_id,
      v_update_types[1 + (v_i % array_length(v_update_types, 1))],
      ROUND((random() * 80)::numeric, 1),
      ROUND((random() * 100)::numeric, 1),
      v_goal_msgs[1 + (v_i % array_length(v_goal_msgs, 1))],
      now() - (random() * interval '365 days')
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. GOAL_COMMENTS: 50 → 500 (need 450 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..450 LOOP
    v_goal_id := v_goal_ids[1 + (v_i % array_length(v_goal_ids, 1))];
    v_emp_id := v_emp_ids[1 + (v_i % array_length(v_emp_ids, 1))];
    INSERT INTO goal_comments (tenant_id, goal_id, author_id, content, is_private, created_at)
    VALUES (
      v_tenant_id,
      v_goal_id,
      v_emp_id,
      v_goal_comment_msgs[1 + (v_i % array_length(v_goal_comment_msgs, 1))],
      (random() < 0.2),
      now() - (random() * interval '365 days')
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 4. NEWS_COMMENTS: 20 → 250 (need 230 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..230 LOOP
    v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
    v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
    INSERT INTO news_comments (tenant_id, article_id, user_id, content, created_at, updated_at)
    VALUES (
      v_tenant_id,
      v_article_id,
      v_user_id,
      v_news_comment_msgs[1 + (v_i % array_length(v_news_comment_msgs, 1))],
      now() - (random() * interval '180 days'),
      now() - (random() * interval '90 days')
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 5. NEWS_REACTIONS: 60 → 500 (need 440 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..440 LOOP
    v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
    v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
    INSERT INTO news_reactions (tenant_id, article_id, user_id, type, created_at)
    VALUES (
      v_tenant_id,
      v_article_id,
      v_user_id,
      v_reaction_types[1 + (v_i % array_length(v_reaction_types, 1))],
      now() - (random() * interval '180 days')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 6. NEWS_READS: 100 → 750 (need 650 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..650 LOOP
    v_article_id := v_article_ids[1 + (v_i % array_length(v_article_ids, 1))];
    v_user_id := v_user_ids[1 + (v_i % array_length(v_user_ids, 1))];
    INSERT INTO news_reads (tenant_id, article_id, user_id, read_at, reading_time_seconds)
    VALUES (
      v_tenant_id,
      v_article_id,
      v_user_id,
      now() - (random() * interval '180 days'),
      (30 + floor(random() * 300))::integer
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 7. DOCUMENT_ACKNOWLEDGMENTS: 78 → 250 (need 172 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..172 LOOP
    v_emp_id := v_emp_ids[1 + (v_i % array_length(v_emp_ids, 1))];
    INSERT INTO document_acknowledgments (tenant_id, document_id, employee_id, acknowledged_at)
    VALUES (
      v_tenant_id,
      v_doc_ids[1 + (v_i % array_length(v_doc_ids, 1))],
      v_emp_id,
      now() - (random() * interval '365 days')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 8. ORG_UNIT_TASKS: 12 → 100 (need 88 more)
  -- org_unit_tasks references org_unit_template_id (no tenant_id)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..88 LOOP
    INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description,
      frequency, complexity_level, estimated_hours, requires_approval)
    VALUES (
      v_template_ids[1 + (v_i % array_length(v_template_ids, 1))],
      'TSK-' || LPAD(v_i::text, 4, '0'),
      v_task_names[1 + (v_i % array_length(v_task_names, 1))] || ' ' || v_i,
      'Descrizione dettagliata del task operativo #' || v_i || ' per l''unità organizzativa bancaria',
      v_frequencies[1 + (v_i % array_length(v_frequencies, 1))],
      1 + (v_i % 5),
      ROUND((1 + random() * 40)::numeric, 1),
      (random() < 0.3)
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 9. ORG_UNIT_KPIS: 15 → 100 (need 85 more)
  -- org_unit_kpis references org_unit_template_id (no tenant_id)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..85 LOOP
    INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description,
      measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max)
    VALUES (
      v_template_ids[1 + (v_i % array_length(v_template_ids, 1))],
      'KPI-' || LPAD(v_i::text, 4, '0'),
      v_kpi_names[1 + (v_i % array_length(v_kpi_names, 1))] || ' ' || ((v_i / 15) + 1),
      'Indicatore chiave di performance per il monitoraggio delle attività bancarie',
      v_units[1 + (v_i % array_length(v_units, 1))],
      v_directions[1 + (v_i % array_length(v_directions, 1))],
      ROUND((50 + random() * 50)::numeric, 2),
      ROUND((20 + random() * 30)::numeric, 2),
      ROUND((80 + random() * 20)::numeric, 2)
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 10. SUCCESSION_CANDIDATES: 39 → 100 (need 61 more)
  -- succession_candidates references critical_role_id and candidate_employee_id
  -- No tenant_id column — inherits tenant context from critical_roles FK
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..61 LOOP
    INSERT INTO succession_candidates (critical_role_id, candidate_employee_id,
      readiness_level, strengths, development_needs, development_plan, rank_order)
    VALUES (
      v_critical_role_ids[1 + (v_i % array_length(v_critical_role_ids, 1))],
      v_emp_ids[1 + ((v_i + 39) % array_length(v_emp_ids, 1))],
      v_readiness[1 + (v_i % array_length(v_readiness, 1))],
      CASE (v_i % 5)
        WHEN 0 THEN 'Leadership naturale, capacità di gestione del team, visione strategica'
        WHEN 1 THEN 'Eccellente competenza tecnica, problem solving avanzato, mentoring'
        WHEN 2 THEN 'Forte orientamento ai risultati, gestione progetti complessi'
        WHEN 3 THEN 'Ottime capacità relazionali, gestione stakeholder, negoziazione'
        ELSE 'Competenza cross-funzionale, innovazione, gestione del cambiamento'
      END,
      CASE (v_i % 4)
        WHEN 0 THEN 'Sviluppare competenze di public speaking e comunicazione esecutiva'
        WHEN 1 THEN 'Approfondire conoscenze di risk management e compliance'
        WHEN 2 THEN 'Rafforzare capacità di gestione budget e P&L'
        ELSE 'Ampliare network interno e visibilità cross-divisionale'
      END,
      CASE (v_i % 3)
        WHEN 0 THEN 'Programma di executive coaching + rotazione dipartimentale 6 mesi'
        WHEN 1 THEN 'MBA sponsorizzato + assignment internazionale'
        ELSE 'Mentoring con C-level + progetto strategico di trasformazione'
      END,
      1 + (v_i % 5)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- 11. WORKFORCE_PLANS: 3 → 25 (need 22 more)
  -- ═══════════════════════════════════════════════════════════════════
  FOR v_i IN 1..22 LOOP
    INSERT INTO workforce_plans (tenant_id, name, description, target_date, status,
      requirements, gap_analysis, hiring_recommendations, training_investments, summary,
      created_by, created_at)
    VALUES (
      v_tenant_id,
      CASE (v_i % 6)
        WHEN 0 THEN 'Piano Workforce Digital Banking ' || (2026 + (v_i / 6))
        WHEN 1 THEN 'Piano Risorse Compliance & Risk ' || (2026 + (v_i / 6))
        WHEN 2 THEN 'Strategia Talent Acquisition IT ' || (2026 + (v_i / 6))
        WHEN 3 THEN 'Piano Successione Management ' || (2026 + (v_i / 6))
        WHEN 4 THEN 'Workforce Optimization Operations ' || (2026 + (v_i / 6))
        ELSE 'Piano Sviluppo Competenze ESG ' || (2026 + (v_i / 6))
      END,
      'Piano strategico per la gestione della forza lavoro - area ' ||
        CASE (v_i % 4) WHEN 0 THEN 'tecnologica' WHEN 1 THEN 'compliance' WHEN 2 THEN 'commerciale' ELSE 'operativa' END,
      (CURRENT_DATE + (v_i * 30 || ' days')::interval)::date,
      v_wf_statuses[1 + (v_i % array_length(v_wf_statuses, 1))],
      jsonb_build_array(
        jsonb_build_object('role', 'Data Analyst', 'count', 2 + (v_i % 5), 'priority', 'high'),
        jsonb_build_object('role', 'Risk Manager', 'count', 1 + (v_i % 3), 'priority', 'medium')
      ),
      jsonb_build_array(
        jsonb_build_object('area', 'Digital Skills', 'gap_percentage', 15 + (v_i % 30), 'impact', 'high')
      ),
      jsonb_build_array(
        jsonb_build_object('role', 'Senior Developer', 'timeline', 'Q' || (1 + v_i % 4) || ' 2026', 'source', 'external')
      ),
      jsonb_build_array(
        jsonb_build_object('program', 'Formazione AI/ML', 'budget', 25000 + (v_i * 5000), 'participants', 10 + v_i)
      ),
      jsonb_build_object(
        'total_headcount_change', v_i % 10 - 3,
        'estimated_cost', 150000 + (v_i * 20000),
        'risk_level', CASE WHEN v_i % 3 = 0 THEN 'low' WHEN v_i % 3 = 1 THEN 'medium' ELSE 'high' END
      ),
      v_user_ids[1 + (v_i % array_length(v_user_ids, 1))],
      now() - (random() * interval '180 days')
    );
  END LOOP;

  RAISE NOTICE 'Augmentation complete: 11 CRITICAL tables brought to ≥50%% of Phase 1 targets';
END;
$$;

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('098_augment_critical_tables', now());

COMMIT;
