-- =============================================================================
-- Seed: Process Layer — EcoNova (Green Energy / Utilities)
-- Profile ID: 779d198e-720f-438c-bfaa-20bb3c6cd756
-- Idempotent: DELETE + re-INSERT in transaction
-- =============================================================================

BEGIN;

-- Set tenant context for RLS
SET LOCAL app.current_tenant_id = 'fb1e866c-e90a-4e25-a146-f68d660a0be8';

-- ── Cleanup existing data (CASCADE deletes phases, roles, skills, kpis) ──
DELETE FROM business_processes WHERE profile_id = '779d198e-720f-438c-bfaa-20bb3c6cd756';
DELETE FROM blueprint_templates WHERE profile_id = '779d198e-720f-438c-bfaa-20bb3c6cd756';

-- ── Blueprint Template ──
INSERT INTO blueprint_templates (id, profile_id, template_name, template_version, description, template_config, is_active)
VALUES (
  gen_random_uuid(),
  '779d198e-720f-438c-bfaa-20bb3c6cd756',
  'Green Energy - Medium Blueprint',
  '1.0',
  'Blueprint per aziende energy rinnovabili di media dimensione con focus su engineering, manutenzione predittiva e compliance ambientale',
  '{
    "modes": ["greenfield", "overlay"],
    "expected_processes": 7,
    "expected_org_depth": 4,
    "target_employee_range": [40, 150],
    "validation_rules": {
      "min_process_coverage": 1.0,
      "min_skill_coverage": 0.7,
      "max_span_of_control": 8
    }
  }'::jsonb,
  true
);

-- ── Business Processes ──

-- BP-EN-001: Progettazione Impianti Rinnovabili
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-001', 'Progettazione Impianti Rinnovabili', 'primary', 1,
  'Dimensionamento e progettazione impianti fotovoltaici, eolici e di accumulo con analisi di fattibilità e studi ambientali',
  ARRAY['Studio fattibilità', 'Dati irraggiamento/vento', 'Vincoli urbanistici'],
  ARRAY['Progetto esecutivo', 'Computo metrico', 'VIA'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-002: Installazione e Commissioning
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-002', 'Installazione e Commissioning', 'primary', 2,
  'Costruzione impianti, installazione componenti, test funzionali e messa in servizio con collaudo',
  ARRAY['Progetto esecutivo', 'Materiali approvvigionati', 'Permessi cantiere'],
  ARRAY['Impianto funzionante', 'Certificati collaudo', 'As-built'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-003: Manutenzione Predittiva
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-003', 'Manutenzione Predittiva', 'primary', 3,
  'Monitoraggio condizione asset, analisi vibrazioni e termografia, pianificazione interventi prima del guasto',
  ARRAY['Dati sensori IoT', 'Storico guasti', 'Modelli predittivi'],
  ARRAY['Piano manutenzione', 'Report interventi', 'Parti ricambio ordinate'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-004: Monitoraggio Energetico
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-004', 'Monitoraggio Energetico', 'primary', 4,
  'Supervisione real-time produzione energetica, analisi performance ratio, ottimizzazione resa impianti',
  ARRAY['Telemetria impianti', 'Dati meteo', 'Previsioni produzione'],
  ARRAY['Dashboard performance', 'Alert anomalie', 'Report produzione'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-005: Gestione Clienti Energia
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-005', 'Gestione Clienti Energia', 'primary', 5,
  'Gestione contratti fornitura, fatturazione, assistenza clienti business e residenziali',
  ARRAY['Contratti attivi', 'Dati consumo', 'Richieste assistenza'],
  ARRAY['Fatture', 'Report consumi', 'Ticket risolti'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-006: Compliance Ambientale
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-006', 'Compliance Ambientale', 'support', 6,
  'Gestione autorizzazioni ambientali, certificati verdi, carbon footprint, reporting ESG e rapporti con ARERA',
  ARRAY['Normativa vigente', 'Dati emissioni', 'Audit precedenti'],
  ARRAY['Report ESG', 'Certificazioni ambientali', 'Bilancio sostenibilità'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- BP-EN-007: Trading Energetico
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-EN-007', 'Trading Energetico', 'support', 7,
  'Compravendita energia su mercati GME/IPEX, gestione portafoglio certificati GO, hedging prezzo',
  ARRAY['Previsioni produzione', 'Prezzi mercato', 'Posizioni aperte'],
  ARRAY['Contratti bilanciamento', 'P&L trading', 'Certificati GO'],
  '779d198e-720f-438c-bfaa-20bb3c6cd756'
);

-- ── Process Phases ──

-- Fasi BP-EN-001 (Progettazione)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-001-01', 'Studio di Fattibilità', 1, 'Analisi sito, risorsa solare/eolica, vincoli, business plan', 30),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-001-02', 'Progettazione Esecutiva', 2, 'Layout impianto, dimensionamento, scelta componenti', 45),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-001-03', 'Iter Autorizzativo', 3, 'Permessi, VIA, connessione rete, conferenza servizi', 60);

-- Fasi BP-EN-002 (Installazione)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-002-01', 'Approvvigionamento e Cantiere', 1, 'Ordini materiali, allestimento cantiere, opere civili', 30),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-002-02', 'Montaggio Componenti', 2, 'Installazione pannelli/turbine, cablaggi, inverter', 20),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-002-03', 'Commissioning e Collaudo', 3, 'Test funzionali, connessione rete, certificazione', 10);

-- Fasi BP-EN-003 (Manutenzione)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-003-01', 'Monitoraggio Condizione', 1, 'Raccolta dati sensori, analisi trend, calcolo RUL', 1),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-003-02', 'Pianificazione Interventi', 2, 'Prioritizzazione, scheduling risorse, ordine ricambi', 3),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-003-03', 'Esecuzione Manutenzione', 3, 'Intervento tecnico, test post-manutenzione, report', 2);

-- Fasi BP-EN-004 (Monitoraggio)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-004-01', 'Acquisizione Dati Real-Time', 1, 'Telemetria SCADA, aggregazione metriche, pulizia dati', 1),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-004-02', 'Analisi Performance', 2, 'Calcolo PR, confronto previsionale vs reale, report', 5);

-- Fasi BP-EN-005 (Clienti)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-005-01', 'Onboarding Cliente', 1, 'Stipula contratto, configurazione profilo, attivazione', 10),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-005-02', 'Gestione Rapporto Continuativo', 2, 'Fatturazione, monitoraggio consumi, supporto', 30),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-005-03', 'Reclami e Retention', 3, 'Gestione ticket, analisi churn, azioni retention', 5);

-- Fasi BP-EN-006 (Compliance)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-006-01', 'Monitoraggio Normativo', 1, 'Tracking aggiornamenti ARERA, direttive EU, normativa regionale', 5),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-006-02', 'Audit e Reporting ESG', 2, 'Carbon footprint, bilancio sostenibilità, relazione GRI', 20);

-- Fasi BP-EN-007 (Trading)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-007-01', 'Previsione e Offerta', 1, 'Forecast produzione, formulazione offerte GME, bidding', 1),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'PH-EN-007-02', 'Bilanciamento e Settlement', 2, 'Riconciliazione produzione vs venduto, gestione sbilanciamento', 3);

-- ── Process Roles ──

-- Ruoli BP-EN-001 (Progettazione)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Responsabile Ingegneria', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='renewable energy engineer' LIMIT 1), 1, 1, 'Direzione tecnica progettazione impianti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Ingegnere Progettista', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='solar energy engineer' LIMIT 1), 2, 5, 'Progettazione esecutiva e dimensionamento'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Specialista Autorizzazioni', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='environmental engineer' LIMIT 1), 1, 2, 'Gestione iter autorizzativi e VIA');

-- Ruoli BP-EN-002 (Installazione)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Project Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='project manager' LIMIT 1), 1, 2, 'Gestione cantiere e coordinamento squadre'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Tecnico Installatore', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='installation engineer' LIMIT 1), 3, 8, 'Installazione e cablaggio componenti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Commissioning Engineer', 'reviewer', (SELECT id FROM esco_occupations WHERE preferred_label='electrical engineer' LIMIT 1), 1, 2, 'Collaudo e messa in servizio');

-- Ruoli BP-EN-003 (Manutenzione)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Responsabile O&M', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='energy manager' LIMIT 1), 1, 1, 'Coordinamento operations e manutenzione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Tecnico Manutenzione', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='energy engineer' LIMIT 1), 2, 6, 'Interventi manutentivi su impianti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Data Analyst IoT', 'executor', NULL, 1, 2, 'Analisi dati sensori e modelli predittivi');

-- Ruoli BP-EN-004 (Monitoraggio)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Performance Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='energy manager' LIMIT 1), 1, 1, 'Supervisione performance energetica portfolio'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Operatore SCADA', 'executor', NULL, 2, 4, 'Monitoraggio real-time e gestione allarmi');

-- Ruoli BP-EN-005 (Clienti)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Responsabile Commerciale', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='energy consultant' LIMIT 1), 1, 1, 'Direzione commerciale e sviluppo clienti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Account Manager', 'executor', NULL, 2, 4, 'Gestione portafoglio clienti B2B'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Customer Care Specialist', 'executor', NULL, 1, 3, 'Supporto clienti e gestione reclami');

-- Ruoli BP-EN-006 (Compliance)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Sustainability Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='sustainability manager' LIMIT 1), 1, 1, 'Gestione ESG e compliance ambientale'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Specialista Ambientale', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='environmental engineer' LIMIT 1), 1, 2, 'Monitoraggio normativo e reporting');

-- Ruoli BP-EN-007 (Trading)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Energy Trader', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='energy trader' LIMIT 1), 1, 2, 'Operazioni su mercati energetici'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'Analista Mercato', 'executor', NULL, 1, 2, 'Analisi prezzi e previsioni domanda/offerta');

-- ── Process Skill Requirements ──

-- Skills BP-EN-001 (Progettazione)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='design power plant systems' LIMIT 1), 5, true, 'Progettazione impianti di generazione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='solar energy' LIMIT 1), 4, true, 'Conoscenza tecnologie fotovoltaiche'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='environmental legislation' LIMIT 1), 4, true, 'Normativa ambientale per autorizzazioni'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='perform project management' LIMIT 1), 4, false, 'Gestione progetto tecnico');

-- Skills BP-EN-002 (Installazione)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='install photovoltaic systems' LIMIT 1), 5, true, 'Installazione impianti fotovoltaici'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='safety engineering' LIMIT 1), 4, true, 'Sicurezza cantiere e impianti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='electricity' LIMIT 1), 4, true, 'Competenze elettriche per cablaggi'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage project information' LIMIT 1), 3, false, 'Documentazione progetto cantiere');

-- Skills BP-EN-003 (Manutenzione)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage maintenance operations' LIMIT 1), 5, true, 'Gestione operazioni manutenzione predittiva'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='maintain photovoltaic systems' LIMIT 1), 4, true, 'Manutenzione impianti FV'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='maintain wind turbines' LIMIT 1), 4, true, 'Manutenzione turbine eoliche'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='inspect wind turbines' LIMIT 1), 3, false, 'Ispezione periodica turbine');

-- Skills BP-EN-004 (Monitoraggio)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='energy efficiency' LIMIT 1), 5, true, 'Analisi efficienza energetica impianti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='adapt energy distribution schedules' LIMIT 1), 4, true, 'Ottimizzazione scheduling distribuzione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='analyse environmental data' LIMIT 1), 4, true, 'Analisi dati ambientali e meteo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='design smart grids' LIMIT 1), 3, false, 'Progettazione smart grid');

-- Skills BP-EN-005 (Clienti)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='customer relationship management' LIMIT 1), 5, true, 'Gestione relazione clienti energia'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='customer service' LIMIT 1), 4, true, 'Assistenza clienti e ticket'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage contracts' LIMIT 1), 4, true, 'Gestione contratti fornitura energia'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage commercial risks' LIMIT 1), 3, false, 'Gestione rischi commerciali');

-- Skills BP-EN-006 (Compliance)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='ensure compliance with environmental legislation' LIMIT 1), 5, true, 'Conformità normativa ambientale'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='advise on sustainability solutions' LIMIT 1), 4, true, 'Consulenza soluzioni sostenibili'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='environmental policy' LIMIT 1), 4, true, 'Politiche ambientali e ESG'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='advise on environmental risk management systems' LIMIT 1), 3, false, 'Sistemi gestione rischio ambientale');

-- Skills BP-EN-007 (Trading)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='energy market' LIMIT 1), 5, true, 'Conoscenza mercati energetici GME/IPEX'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage commercial risks' LIMIT 1), 4, true, 'Gestione rischio prezzo energia'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='manage budgets' LIMIT 1), 4, true, 'Gestione budget e P&L trading'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), (SELECT id FROM esco_skills WHERE preferred_label='negotiate with stakeholders' LIMIT 1), 3, false, 'Negoziazione contratti bilanciamento');

-- ── Process KPIs ──

-- KPIs BP-EN-001 (Progettazione)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-001-KPI-01', 'Tempo autorizzazione', 'giorni', 'lower_better', 90, 60, 180, 'Tempo medio ottenimento permessi'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-001-KPI-02', 'Accuratezza stime produzione', 'percentuale', 'higher_better', 92, 85, 98, 'Scostamento previsionale vs reale primo anno'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-001' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-001-KPI-03', 'Costo progettazione su CAPEX', 'percentuale', 'lower_better', 5, 3, 8, 'Incidenza costi engineering');

-- KPIs BP-EN-002 (Installazione)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-002-KPI-01', 'Aderenza cronogramma', 'percentuale', 'higher_better', 90, 80, 98, 'Rispetto tempistiche cantiere'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-002-KPI-02', 'Infortuni cantiere', 'numero/anno', 'lower_better', 0, 0, 2, 'Incidenti con assenza'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-002' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-002-KPI-03', 'Scostamento budget', 'percentuale', 'lower_better', 5, 0, 15, 'Variazione costi vs preventivo');

-- KPIs BP-EN-003 (Manutenzione)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-003-KPI-01', 'Disponibilità impianto', 'percentuale', 'higher_better', 97, 95, 99, 'Uptime medio portfolio impianti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-003-KPI-02', 'MTTR (Mean Time To Repair)', 'ore', 'lower_better', 8, 4, 24, 'Tempo medio ripristino'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-003' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-003-KPI-03', 'Guasti non previsti', 'numero/trimestre', 'lower_better', 2, 0, 5, 'Guasti non intercettati da predittiva');

-- KPIs BP-EN-004 (Monitoraggio)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-004-KPI-01', 'Performance Ratio', 'percentuale', 'higher_better', 82, 75, 90, 'Rapporto energia reale vs teorica'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-004-KPI-02', 'Tempo rilevamento anomalie', 'minuti', 'lower_better', 15, 5, 60, 'Tempo medio detect anomalia'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-004' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-004-KPI-03', 'Produzione specifica', 'kWh/kWp', 'higher_better', 1350, 1100, 1600, 'Resa annua per kWp installato');

-- KPIs BP-EN-005 (Clienti)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-005-KPI-01', 'Churn rate', 'percentuale', 'lower_better', 5, 2, 10, 'Tasso abbandono clienti annuo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-005-KPI-02', 'NPS clienti', 'punteggio', 'higher_better', 45, 30, 70, 'Net Promoter Score'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-005' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-005-KPI-03', 'Tempo medio risoluzione ticket', 'ore', 'lower_better', 24, 8, 48, 'SLA risoluzione richieste');

-- KPIs BP-EN-006 (Compliance)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-006-KPI-01', 'Riduzione CO2', 'tonnellate/anno', 'higher_better', 5000, 2000, 15000, 'CO2 evitata da produzione rinnovabile'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-006-KPI-02', 'Compliance normativa', 'percentuale', 'higher_better', 100, 95, 100, 'Aderenza requisiti ARERA e direttive EU'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-006' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-006-KPI-03', 'Rating ESG', 'punteggio', 'higher_better', 75, 60, 95, 'Score ESG da provider rating');

-- KPIs BP-EN-007 (Trading)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-007-KPI-01', 'Spread medio vendita', 'euro/MWh', 'higher_better', 8, 3, 15, 'Margine medio su prezzo mercato'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-007-KPI-02', 'Errore previsione produzione', 'percentuale', 'lower_better', 8, 3, 15, 'Scostamento forecast vs reale'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-EN-007' AND profile_id='779d198e-720f-438c-bfaa-20bb3c6cd756'), 'BP-EN-007-KPI-03', 'Penalità sbilanciamento', 'euro/mese', 'lower_better', 2000, 500, 5000, 'Costo penalità per sbilanciamento rete');

COMMIT;
