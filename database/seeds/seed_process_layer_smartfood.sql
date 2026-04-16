-- =============================================================================
-- Seed: Process Layer — SmartFood S.r.l. (Food & Beverage / Retail)
-- Profile ID: 9317a314-25e8-4ca7-9041-a5b69096d210
-- Idempotent: DELETE + re-INSERT in transaction
-- =============================================================================

BEGIN;

-- Set tenant context for RLS
SET LOCAL app.current_tenant_id = '1d7bf448-ceac-4215-917d-45ff13678104';

-- ── Cleanup existing data (CASCADE deletes phases, roles, skills, kpis) ──
DELETE FROM business_processes WHERE profile_id = '9317a314-25e8-4ca7-9041-a5b69096d210';
DELETE FROM blueprint_templates WHERE profile_id = '9317a314-25e8-4ca7-9041-a5b69096d210';

-- ── Blueprint Template ──
INSERT INTO blueprint_templates (id, profile_id, template_name, template_version, description, template_config, is_active)
VALUES (
  gen_random_uuid(),
  '9317a314-25e8-4ca7-9041-a5b69096d210',
  'Food & Beverage - Medium Blueprint',
  '1.0',
  'Blueprint per aziende food & beverage di media dimensione con focus su qualità, HACCP e supply chain',
  '{
    "modes": ["greenfield", "overlay"],
    "expected_processes": 7,
    "expected_org_depth": 4,
    "target_employee_range": [50, 200],
    "validation_rules": {
      "min_process_coverage": 1.0,
      "min_skill_coverage": 0.7,
      "max_span_of_control": 8
    }
  }'::jsonb,
  true
);

-- ── Business Processes ──

-- BP-SF-001: Gestione Acquisti Materie Prime
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-001', 'Gestione Acquisti Materie Prime', 'primary', 1,
  'Approvvigionamento materie prime alimentari con controllo fornitori, certificazioni e tracciabilità lotto',
  ARRAY['Richieste produzione', 'Livelli stock', 'Specifiche qualità'],
  ARRAY['Ordini fornitori', 'Documenti trasporto', 'Certificati lotto'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-002: Produzione e Trasformazione Alimentare
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-002', 'Produzione e Trasformazione Alimentare', 'primary', 2,
  'Trasformazione materie prime in prodotti finiti con rispetto ricettari, tempi e temperature di processo',
  ARRAY['Materie prime certificate', 'Piani produzione', 'Ricettari'],
  ARRAY['Prodotti finiti', 'Scarti classificati', 'Report produzione'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-003: Controllo Qualità e HACCP
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-003', 'Controllo Qualità e HACCP', 'primary', 3,
  'Monitoraggio CCP, analisi microbiologiche, gestione non conformità e tracciabilità completa',
  ARRAY['Campioni prodotto', 'Registrazioni CCP', 'Segnalazioni NC'],
  ARRAY['Report analisi', 'Certificati conformità', 'Azioni correttive'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-004: Logistica e Distribuzione
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-004', 'Logistica e Distribuzione', 'primary', 4,
  'Gestione magazzino refrigerato, pianificazione trasporti a temperatura controllata, consegne GDO e HoReCa',
  ARRAY['Prodotti finiti', 'Ordini clienti', 'Piani consegna'],
  ARRAY['DDT', 'Bolle scarico', 'Report consegne'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-005: Vendite e Trade Marketing
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-005', 'Vendite e Trade Marketing', 'primary', 5,
  'Gestione portafoglio clienti GDO/HoReCa, promozioni trade, gestione listini e contratti commerciali',
  ARRAY['Catalogo prodotti', 'Budget commerciale', 'Dati sell-out'],
  ARRAY['Ordini cliente', 'Contratti GDO', 'Report vendite'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-006: R&D Nuovi Prodotti
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-006', 'R&D Nuovi Prodotti', 'support', 6,
  'Sviluppo nuove ricette, test shelf-life, prototipi packaging, validazione nutrizionale e normativa',
  ARRAY['Brief marketing', 'Trend mercato', 'Feedback consumatori'],
  ARRAY['Prototipi prodotto', 'Schede tecniche', 'Dossier regolatorio'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- BP-SF-007: Compliance Alimentare
INSERT INTO business_processes (id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs, profile_id)
VALUES (
  gen_random_uuid(), 'BP-SF-007', 'Compliance Alimentare', 'support', 7,
  'Gestione certificazioni (BRC, IFS, ISO 22000), audit interni/esterni, aggiornamento normativo',
  ARRAY['Normative vigenti', 'Report audit precedenti', 'NC aperte'],
  ARRAY['Certificazioni aggiornate', 'Report audit', 'Piano miglioramento'],
  '9317a314-25e8-4ca7-9041-a5b69096d210'
);

-- ── Process Phases ──

-- Fasi BP-SF-001 (Acquisti)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-001-01', 'Selezione e Qualifica Fornitori', 1, 'Valutazione fornitori, audit stabilimenti, verifica certificazioni', 30),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-001-02', 'Emissione Ordini di Acquisto', 2, 'Generazione ordini, negoziazione prezzi, conferme ordine', 5),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-001-03', 'Ricevimento e Controllo Merci', 3, 'Verifica documenti trasporto, controllo temperatura, campionamento', 2);

-- Fasi BP-SF-002 (Produzione)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-002-01', 'Pianificazione Produzione', 1, 'Scheduling linee, allocazione risorse, calcolo fabbisogni', 3),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-002-02', 'Esecuzione Produzione', 2, 'Lavorazione, cottura/pastorizzazione, confezionamento', 5),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-002-03', 'Etichettatura e Lottizzazione', 3, 'Stampa etichette, assegnazione lotto, tracciabilità', 1);

-- Fasi BP-SF-003 (Qualità HACCP)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-003-01', 'Monitoraggio CCP', 1, 'Registrazione temperature, pH, contaminanti ai punti critici', 1),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-003-02', 'Analisi di Laboratorio', 2, 'Campionamento, analisi microbiologiche e chimiche', 3),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-003-03', 'Gestione Non Conformità', 3, 'Apertura NC, investigazione causa, azioni correttive', 5);

-- Fasi BP-SF-004 (Logistica)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-004-01', 'Gestione Magazzino Refrigerato', 1, 'Stoccaggio, rotazione FIFO/FEFO, controllo temperature', 1),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-004-02', 'Pianificazione Spedizioni', 2, 'Consolidamento ordini, routing, prenotazione trasportatori', 2),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-004-03', 'Consegna e Prova di Ricezione', 3, 'Carico mezzi, monitoraggio GPS, firma digitale ricezione', 1);

-- Fasi BP-SF-005 (Vendite)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-005-01', 'Gestione Portafoglio Clienti', 1, 'Classificazione clienti, piani visita, obiettivi sell-in', 10),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-005-02', 'Promozioni e Trade Marketing', 2, 'Pianificazione promo, materiali POP, monitoraggio ROI', 15);

-- Fasi BP-SF-006 (R&D)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-006-01', 'Ideazione e Concept', 1, 'Brainstorming, analisi trend, brief sviluppo', 10),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-006-02', 'Prototipazione e Test', 2, 'Sviluppo ricetta, shelf-life test, panel sensoriale', 30),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-006-03', 'Validazione e Lancio', 3, 'Scale-up industriale, packaging finale, dossier regolatorio', 20);

-- Fasi BP-SF-007 (Compliance)
INSERT INTO process_phases (id, process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-007-01', 'Audit Interni', 1, 'Pianificazione audit, checklist, ispezione reparti', 5),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'PH-SF-007-02', 'Gestione Certificazioni', 2, 'Preparazione audit ente, documentazione, follow-up NC', 15);

-- ── Process Roles ──

-- Ruoli BP-SF-001 (Acquisti)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Responsabile Acquisti', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='purchasing manager' LIMIT 1), 1, 1, 'Gestione strategica acquisti e fornitori'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Buyer Materie Prime', 'executor', NULL, 1, 3, 'Esecuzione ordini e negoziazione operativa'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Addetto Ricevimento Merci', 'executor', NULL, 1, 2, 'Controllo fisico merci in arrivo');

-- Ruoli BP-SF-002 (Produzione)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Responsabile Produzione', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='food production manager' LIMIT 1), 1, 1, 'Supervisione linee produttive e pianificazione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Capo Turno', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='industrial production manager' LIMIT 1), 2, 4, 'Gestione operativa turno produttivo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Operatore di Linea', 'executor', NULL, 5, 15, 'Conduzione macchinari e confezionamento');

-- Ruoli BP-SF-003 (Qualità)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Quality Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='food technologist' LIMIT 1), 1, 1, 'Responsabile sistema qualità e HACCP'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Tecnico di Laboratorio', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='food safety specialist' LIMIT 1), 1, 2, 'Analisi microbiologiche e chimiche'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Auditor Interno', 'reviewer', NULL, 1, 1, 'Esecuzione audit interni qualità');

-- Ruoli BP-SF-004 (Logistica)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Responsabile Logistica', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='supply chain manager' LIMIT 1), 1, 1, 'Coordinamento magazzino e trasporti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Magazziniere', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='warehouse manager' LIMIT 1), 2, 5, 'Movimentazione e stoccaggio refrigerato'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Coordinatore Trasporti', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='distribution manager' LIMIT 1), 1, 2, 'Pianificazione rotte e gestione corrieri');

-- Ruoli BP-SF-005 (Vendite)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Direttore Commerciale', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='sales manager' LIMIT 1), 1, 1, 'Strategia commerciale e budget vendite'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Key Account Manager', 'executor', NULL, 2, 4, 'Gestione relazione clienti GDO'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Trade Marketing Specialist', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='marketing manager' LIMIT 1), 1, 2, 'Promozioni e visibilità punto vendita');

-- Ruoli BP-SF-006 (R&D)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'R&D Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='research and development manager' LIMIT 1), 1, 1, 'Direzione progetti innovazione prodotto'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Tecnologo Alimentare', 'executor', (SELECT id FROM esco_occupations WHERE preferred_label='food technologist' LIMIT 1), 1, 3, 'Sviluppo ricette e test shelf-life');

-- Ruoli BP-SF-007 (Compliance)
INSERT INTO process_roles (id, process_id, role_name, role_type, esco_occupation_id, min_headcount, max_headcount, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Compliance Manager', 'owner', (SELECT id FROM esco_occupations WHERE preferred_label='food safety specialist' LIMIT 1), 1, 1, 'Gestione certificazioni e rapporti con enti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'Specialista Normativo', 'executor', NULL, 1, 1, 'Aggiornamento normativo e documentazione');

-- ── Process Skill Requirements ──

-- Skills BP-SF-001 (Acquisti)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='negotiate with stakeholders' LIMIT 1), 4, true, 'Negoziazione contratti fornitura'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage budgets' LIMIT 1), 4, true, 'Gestione budget acquisti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='comply with food safety and hygiene' LIMIT 1), 3, true, 'Verifica conformità igienico-sanitaria fornitori'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='monitor stock level' LIMIT 1), 3, false, 'Monitoraggio livelli scorta');

-- Skills BP-SF-002 (Produzione)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage production enterprise' LIMIT 1), 5, true, 'Gestione complessiva stabilimento produttivo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage production systems' LIMIT 1), 4, true, 'Conduzione sistemi e linee di produzione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='plan health and safety procedures' LIMIT 1), 4, true, 'Sicurezza alimentare in produzione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='lean manufacturing' LIMIT 1), 3, false, 'Ottimizzazione processi lean');

-- Skills BP-SF-003 (Qualità HACCP)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='apply HACCP' LIMIT 1), 5, true, 'Applicazione sistema HACCP completo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='supervise food quality' LIMIT 1), 5, true, 'Supervisione qualità prodotto'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='audit food safety procedures' LIMIT 1), 4, true, 'Audit procedure sicurezza alimentare'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='control food safety regulations' LIMIT 1), 4, true, 'Controllo normativa sicurezza alimentare');

-- Skills BP-SF-004 (Logistica)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage logistics' LIMIT 1), 5, true, 'Gestione logistica integrata'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage warehouse operations' LIMIT 1), 4, true, 'Operazioni magazzino refrigerato'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage distribution channels' LIMIT 1), 4, true, 'Gestione canali distributivi'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='maintain warehouse database' LIMIT 1), 3, false, 'Sistema gestione magazzino WMS');

-- Skills BP-SF-005 (Vendite)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='plan marketing strategy' LIMIT 1), 4, true, 'Strategia marketing e posizionamento'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='coordinate marketing plan actions' LIMIT 1), 4, true, 'Coordinamento azioni trade marketing'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='customer relationship management' LIMIT 1), 4, true, 'Gestione relazione con GDO e HoReCa'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='negotiate with stakeholders' LIMIT 1), 4, false, 'Negoziazione accordi commerciali');

-- Skills BP-SF-006 (R&D)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='develop product design' LIMIT 1), 5, true, 'Sviluppo concept prodotto'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='plan product management' LIMIT 1), 4, true, 'Gestione ciclo vita prodotto'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='comply with food safety and hygiene' LIMIT 1), 4, true, 'Conformità igienico-sanitaria nuovi prodotti'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='Agile project management' LIMIT 1), 3, false, 'Gestione agile progetti R&D');

-- Skills BP-SF-007 (Compliance)
INSERT INTO process_skill_requirements (id, process_id, esco_skill_id, proficiency_level, is_mandatory, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='ensure compliance with environmental legislation' LIMIT 1), 5, true, 'Conformità normativa ambientale packaging'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='audit food safety procedures' LIMIT 1), 5, true, 'Audit sistema qualità'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage quality' LIMIT 1), 4, true, 'Gestione sistema qualità integrato'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), (SELECT id FROM esco_skills WHERE preferred_label='manage staff' LIMIT 1), 3, false, 'Coordinamento team qualità');

-- ── Process KPIs ──

-- KPIs BP-SF-001 (Acquisti)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-001-KPI-01', 'Lead time approvvigionamento', 'giorni', 'lower_better', 7, 3, 14, 'Tempo medio dall ordine alla consegna'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-001-KPI-02', 'Tasso conformità forniture', 'percentuale', 'higher_better', 97, 95, 100, 'Percentuale forniture conformi a specifica'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-001' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-001-KPI-03', 'Saving negoziazione', 'percentuale', 'higher_better', 5, 2, 10, 'Risparmio medio ottenuto su listino');

-- KPIs BP-SF-002 (Produzione)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-002-KPI-01', 'OEE (Overall Equipment Effectiveness)', 'percentuale', 'higher_better', 75, 65, 90, 'Efficienza complessiva impianto'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-002-KPI-02', 'Scarto produzione', 'percentuale', 'lower_better', 3, 1, 5, 'Percentuale scarto su produzione totale'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-002' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-002-KPI-03', 'Aderenza piano produzione', 'percentuale', 'higher_better', 92, 85, 98, 'Rispetto scheduling settimanale');

-- KPIs BP-SF-003 (Qualità HACCP)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-003-KPI-01', 'Non conformità critiche', 'numero/mese', 'lower_better', 0, 0, 2, 'NC critiche rilevate al mese'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-003-KPI-02', 'Tempo chiusura NC', 'giorni', 'lower_better', 5, 2, 10, 'Tempo medio chiusura non conformità'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-003' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-003-KPI-03', 'Conformità analisi microbiologiche', 'percentuale', 'higher_better', 99, 97, 100, 'Percentuale campioni conformi');

-- KPIs BP-SF-004 (Logistica)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-004-KPI-01', 'OTIF (On Time In Full)', 'percentuale', 'higher_better', 95, 90, 99, 'Consegne puntuali e complete'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-004-KPI-02', 'Rotazione magazzino', 'volte/anno', 'higher_better', 24, 18, 36, 'Frequenza rotazione stock'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-004' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-004-KPI-03', 'Costo logistico su fatturato', 'percentuale', 'lower_better', 8, 5, 12, 'Incidenza costi logistici');

-- KPIs BP-SF-005 (Vendite)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-005-KPI-01', 'Fatturato per cliente', 'euro/anno', 'higher_better', 150000, 80000, 500000, 'Revenue media per cliente attivo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-005-KPI-02', 'ROI promozioni trade', 'percentuale', 'higher_better', 120, 100, 200, 'Ritorno su investimento promo'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-005' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-005-KPI-03', 'Penetrazione distribuzione', 'percentuale', 'higher_better', 65, 40, 85, 'Copertura distribuzione numerica');

-- KPIs BP-SF-006 (R&D)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-006-KPI-01', 'Time to market', 'mesi', 'lower_better', 6, 3, 12, 'Tempo da concept a lancio'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-006-KPI-02', 'Success rate lanci', 'percentuale', 'higher_better', 60, 40, 80, 'Percentuale nuovi prodotti che raggiungono target'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-006' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-006-KPI-03', 'Fatturato da innovazione', 'percentuale', 'higher_better', 15, 8, 25, 'Percentuale fatturato da prodotti < 3 anni');

-- KPIs BP-SF-007 (Compliance)
INSERT INTO process_kpis (id, process_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, description)
VALUES
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-007-KPI-01', 'Score audit BRC/IFS', 'punteggio', 'higher_better', 85, 70, 100, 'Punteggio ultimo audit di certificazione'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-007-KPI-02', 'NC aperte da audit', 'numero', 'lower_better', 3, 0, 8, 'Non conformità residue aperte'),
  (gen_random_uuid(), (SELECT id FROM business_processes WHERE process_code='BP-SF-007' AND profile_id='9317a314-25e8-4ca7-9041-a5b69096d210'), 'BP-SF-007-KPI-03', 'Formazione HACCP completata', 'percentuale', 'higher_better', 100, 90, 100, 'Copertura formazione obbligatoria');

COMMIT;
