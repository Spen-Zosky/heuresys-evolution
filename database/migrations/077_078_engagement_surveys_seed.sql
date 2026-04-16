-- Migration: 077_078_engagement_surveys_seed.sql
-- Description: Seed engagement surveys and responses
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- 077: ENGAGEMENT SURVEYS
-- ============================================================================

-- Create surveys for each tenant (Q1-Q4 2024, Q1 2025, Wellbeing)
INSERT INTO engagement_surveys (tenant_id, title, description, questions, is_anonymous, status, audience_type, start_date, end_date, total_invitations, created_by)
SELECT
    t.id,
    survey.title,
    survey.description,
    survey.questions::jsonb,
    true,
    survey.status,
    'all',
    survey.start_date,
    survey.end_date,
    (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = t.id AND e.is_active = true),
    (SELECT u.id FROM users u WHERE u.username LIKE t.code || '.%' LIMIT 1)
FROM tenants t
CROSS JOIN (VALUES
    -- Q1 2024 Survey (Closed)
    ('Engagement Survey Q1 2024',
     'Sondaggio trimestrale sul clima aziendale e engagement dei dipendenti',
     '[
       {"id": "q1", "type": "rating", "text": "Quanto ti senti coinvolto nel tuo lavoro quotidiano?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Come valuti la comunicazione con il tuo manager?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Quanto sei soddisfatto delle opportunità di crescita?", "scale": 5},
       {"id": "q4", "type": "nps", "text": "Quanto consiglieresti la nostra azienda come posto di lavoro?", "scale": 10},
       {"id": "q5", "type": "text", "text": "Cosa potremmo migliorare per rendere il tuo ambiente di lavoro migliore?"}
     ]',
     'closed',
     '2024-01-15'::timestamp,
     '2024-01-31'::timestamp),
    -- Q2 2024 Survey (Closed)
    ('Engagement Survey Q2 2024',
     'Sondaggio trimestrale sul clima aziendale - secondo trimestre',
     '[
       {"id": "q1", "type": "rating", "text": "Come valuti il work-life balance nella tua posizione?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Ti senti adeguatamente riconosciuto per il tuo contributo?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Quanto chiari sono gli obiettivi del tuo team?", "scale": 5},
       {"id": "q4", "type": "nps", "text": "Quanto consiglieresti la nostra azienda come posto di lavoro?", "scale": 10},
       {"id": "q5", "type": "text", "text": "Quali iniziative vorresti vedere implementate?"}
     ]',
     'closed',
     '2024-04-15'::timestamp,
     '2024-04-30'::timestamp),
    -- Q3 2024 Survey (Closed)
    ('Engagement Survey Q3 2024',
     'Sondaggio trimestrale sul clima aziendale - terzo trimestre',
     '[
       {"id": "q1", "type": "rating", "text": "Quanto ti senti supportato dal team nella crescita professionale?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Come valuti gli strumenti e le risorse a tua disposizione?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Ti senti parte di una cultura aziendale positiva?", "scale": 5},
       {"id": "q4", "type": "nps", "text": "Quanto consiglieresti la nostra azienda come posto di lavoro?", "scale": 10},
       {"id": "q5", "type": "text", "text": "Come possiamo migliorare la collaborazione tra team?"}
     ]',
     'closed',
     '2024-07-15'::timestamp,
     '2024-07-31'::timestamp),
    -- Q4 2024 Survey (Closed)
    ('Engagement Survey Q4 2024',
     'Sondaggio annuale di fine anno sul clima aziendale',
     '[
       {"id": "q1", "type": "rating", "text": "Come valuti complessivamente il 2024 dal punto di vista lavorativo?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Quanto ti senti allineato con la visione aziendale?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Come valuti i benefit e il welfare aziendale?", "scale": 5},
       {"id": "q4", "type": "nps", "text": "Quanto consiglieresti la nostra azienda come posto di lavoro?", "scale": 10},
       {"id": "q5", "type": "text", "text": "Quali sono le tue aspettative per il 2025?"}
     ]',
     'closed',
     '2024-10-15'::timestamp,
     '2024-10-31'::timestamp),
    -- Wellbeing Survey (Closed)
    ('Wellbeing & Work-Life Balance Survey',
     'Sondaggio dedicato al benessere e work-life balance dei dipendenti',
     '[
       {"id": "q1", "type": "rating", "text": "Come valuti il tuo livello di stress lavorativo?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Riesci a mantenere un buon equilibrio vita-lavoro?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Ti senti supportato in caso di difficoltà personali?", "scale": 5},
       {"id": "q4", "type": "rating", "text": "Come valuti le iniziative di welfare aziendale?", "scale": 5},
       {"id": "q5", "type": "text", "text": "Quali iniziative di wellbeing vorresti vedere?"}
     ]',
     'closed',
     '2024-09-01'::timestamp,
     '2024-09-15'::timestamp),
    -- Q1 2025 Survey (Active)
    ('Engagement Survey Q1 2025',
     'Sondaggio trimestrale sul clima aziendale - primo trimestre 2025',
     '[
       {"id": "q1", "type": "rating", "text": "Quanto ti senti motivato nel nuovo anno?", "scale": 5},
       {"id": "q2", "type": "rating", "text": "Come valuti le opportunità di formazione disponibili?", "scale": 5},
       {"id": "q3", "type": "rating", "text": "Ti senti coinvolto nelle decisioni del tuo team?", "scale": 5},
       {"id": "q4", "type": "nps", "text": "Quanto consiglieresti la nostra azienda come posto di lavoro?", "scale": 10},
       {"id": "q5", "type": "text", "text": "Cosa vorresti migliorare nel primo trimestre?"}
     ]',
     'active',
     '2025-01-10'::timestamp,
     '2025-01-31'::timestamp)
) AS survey(title, description, questions, status, start_date, end_date)
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 078: ENGAGEMENT SURVEY RESPONSES
-- ============================================================================

-- Generate responses for closed surveys (70-88% response rate)
INSERT INTO engagement_survey_responses (tenant_id, survey_id, employee_id, answers, started_at, completed_at, is_complete)
SELECT
    es.tenant_id,
    es.id,
    e.id,
    jsonb_build_array(
        jsonb_build_object('question_id', 'q1', 'rating', 2 + floor(random() * 4)::int),
        jsonb_build_object('question_id', 'q2', 'rating', 2 + floor(random() * 4)::int),
        jsonb_build_object('question_id', 'q3', 'rating', 2 + floor(random() * 4)::int),
        jsonb_build_object('question_id', 'q4', 'nps', 5 + floor(random() * 6)::int),
        jsonb_build_object('question_id', 'q5', 'text',
            CASE floor(random() * 10)::int
                WHEN 0 THEN 'Migliorare la comunicazione interna tra i diversi dipartimenti.'
                WHEN 1 THEN 'Aumentare le opportunità di formazione e sviluppo professionale.'
                WHEN 2 THEN 'Maggiore flessibilità negli orari di lavoro e smart working.'
                WHEN 3 THEN 'Rafforzare il riconoscimento dei risultati individuali e di team.'
                WHEN 4 THEN 'Migliorare gli spazi di lavoro e le attrezzature disponibili.'
                WHEN 5 THEN 'Potenziare i benefit legati al welfare aziendale.'
                WHEN 6 THEN 'Creare più momenti di team building e socializzazione.'
                WHEN 7 THEN 'Snellire i processi burocratici interni.'
                WHEN 8 THEN 'Maggiore trasparenza nelle decisioni strategiche.'
                ELSE 'Nel complesso sono soddisfatto, continuare così.'
            END
        )
    ),
    es.start_date + (random() * (es.end_date - es.start_date)),
    es.start_date + (random() * (es.end_date - es.start_date)) + (random() * INTERVAL '30 minutes'),
    true
FROM engagement_surveys es
JOIN employees e ON e.tenant_id = es.tenant_id AND e.is_active = true
WHERE es.status = 'closed'
AND random() < 0.78  -- ~78% response rate
ON CONFLICT DO NOTHING;

-- Generate partial responses for active surveys (~35% partial completion)
INSERT INTO engagement_survey_responses (tenant_id, survey_id, employee_id, answers, started_at, is_complete)
SELECT
    es.tenant_id,
    es.id,
    e.id,
    jsonb_build_array(
        jsonb_build_object('question_id', 'q1', 'rating', 2 + floor(random() * 4)::int),
        jsonb_build_object('question_id', 'q2', 'rating', 2 + floor(random() * 4)::int)
    ),
    es.start_date + (random() * (NOW() - es.start_date)),
    false
FROM engagement_surveys es
JOIN employees e ON e.tenant_id = es.tenant_id AND e.is_active = true
WHERE es.status = 'active'
AND random() < 0.35
AND NOT EXISTS (
    SELECT 1 FROM engagement_survey_responses esr
    WHERE esr.survey_id = es.id AND esr.employee_id = e.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- UPDATE RESPONSE COUNTS
-- ============================================================================

UPDATE engagement_surveys es
SET total_responses = (
    SELECT COUNT(*) FROM engagement_survey_responses esr
    WHERE esr.survey_id = es.id AND esr.is_complete = true
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_surveys INTEGER;
    v_responses INTEGER;
    v_complete_responses INTEGER;
    v_avg_response_rate NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_surveys FROM engagement_surveys;
    SELECT COUNT(*) INTO v_responses FROM engagement_survey_responses;
    SELECT COUNT(*) INTO v_complete_responses FROM engagement_survey_responses WHERE is_complete = true;
    SELECT ROUND(AVG(total_responses::numeric / NULLIF(total_invitations, 0) * 100), 1) INTO v_avg_response_rate
    FROM engagement_surveys WHERE status = 'closed';

    RAISE NOTICE '=== Migration 077-078 Verification ===';
    RAISE NOTICE 'Total surveys: %', v_surveys;
    RAISE NOTICE 'Total responses: %', v_responses;
    RAISE NOTICE 'Complete responses: %', v_complete_responses;
    RAISE NOTICE 'Avg response rate (closed surveys): % %%', v_avg_response_rate;
END $$;
