-- =============================================================================
-- Migration 015: Skill Taxonomy Seed Data
-- =============================================================================
-- Seeds skill_clusters with 10 families and ~30 subfamilies
-- =============================================================================

-- =============================================================================
-- PART 1: LEVEL 1 - SKILL FAMILIES (10 families)
-- =============================================================================

INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, industry_codes, sort_order)
VALUES
-- 1. Technology & Development
('TECH-DEV', 'Technology & Development', 'Tecnologia e Sviluppo',
 'Technical skills related to software development, infrastructure, and IT systems',
 1, ARRAY['J'], 1),

-- 2. Business & Management
('BUS-MGT', 'Business & Management', 'Business e Management',
 'Skills for business operations, strategy, and organizational management',
 1, ARRAY['M', 'N'], 2),

-- 3. Communication & Interpersonal
('COMM-INT', 'Communication & Interpersonal', 'Comunicazione e Interpersonale',
 'Skills for effective communication, collaboration, and relationship building',
 1, NULL, 3),

-- 4. Data & Analytics
('DATA-ANA', 'Data & Analytics', 'Dati e Analytics',
 'Skills for data analysis, business intelligence, and data-driven decision making',
 1, ARRAY['J', 'K'], 4),

-- 5. Finance & Accounting
('FIN-ACC', 'Finance & Accounting', 'Finanza e Contabilità',
 'Skills for financial management, accounting, and fiscal operations',
 1, ARRAY['K'], 5),

-- 6. Human Resources & People
('HR-PPL', 'Human Resources & People', 'Risorse Umane e Persone',
 'Skills for people management, talent development, and organizational culture',
 1, ARRAY['N'], 6),

-- 7. Operations & Logistics
('OPS-LOG', 'Operations & Logistics', 'Operazioni e Logistica',
 'Skills for process optimization, supply chain, and operational excellence',
 1, ARRAY['C', 'H'], 7),

-- 8. Sales & Marketing
('SALES-MKT', 'Sales & Marketing', 'Vendite e Marketing',
 'Skills for sales, marketing, and customer engagement',
 1, ARRAY['G', 'M'], 8),

-- 9. Legal & Compliance
('LEGAL-COMP', 'Legal & Compliance', 'Legale e Compliance',
 'Skills for legal affairs, regulatory compliance, and risk management',
 1, ARRAY['K', 'M'], 9),

-- 10. Creative & Design
('CREATIVE', 'Creative & Design', 'Creativo e Design',
 'Skills for creative work, design, and visual communication',
 1, ARRAY['J', 'M', 'R'], 10)

ON CONFLICT (code) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_it = EXCLUDED.name_it,
    description = EXCLUDED.description,
    industry_codes = EXCLUDED.industry_codes,
    updated_at = NOW();

-- =============================================================================
-- PART 2: LEVEL 2 - SKILL SUBFAMILIES (~30 subfamilies)
-- =============================================================================

-- 2.1 Technology & Development Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('TECH-PROG', 'Programming & Software Development', 'Programmazione e Sviluppo Software',
 'Coding, software engineering, and application development',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 1),

('TECH-WEB', 'Web Development', 'Sviluppo Web',
 'Frontend, backend, and full-stack web development',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 2),

('TECH-MOBILE', 'Mobile Development', 'Sviluppo Mobile',
 'iOS, Android, and cross-platform mobile app development',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 3),

('TECH-INFRA', 'Infrastructure & DevOps', 'Infrastruttura e DevOps',
 'Cloud, containerization, CI/CD, and infrastructure management',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 4),

('TECH-SEC', 'Cybersecurity', 'Sicurezza Informatica',
 'Information security, network security, and security operations',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 5),

('TECH-DB', 'Database & Data Engineering', 'Database e Data Engineering',
 'Database design, administration, and data pipelines',
 2, (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV'), 6)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.2 Business & Management Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('BUS-STRAT', 'Strategy & Planning', 'Strategia e Pianificazione',
 'Strategic thinking, business planning, and corporate strategy',
 2, (SELECT id FROM skill_clusters WHERE code = 'BUS-MGT'), 1),

('BUS-LEAD', 'Leadership & Management', 'Leadership e Management',
 'People leadership, team management, and executive skills',
 2, (SELECT id FROM skill_clusters WHERE code = 'BUS-MGT'), 2),

('BUS-PM', 'Project Management', 'Project Management',
 'Project planning, execution, and delivery methodologies',
 2, (SELECT id FROM skill_clusters WHERE code = 'BUS-MGT'), 3),

('BUS-ENT', 'Entrepreneurship & Innovation', 'Imprenditorialità e Innovazione',
 'Startup skills, innovation management, and business development',
 2, (SELECT id FROM skill_clusters WHERE code = 'BUS-MGT'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.3 Communication & Interpersonal Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('COMM-VERBAL', 'Verbal Communication', 'Comunicazione Verbale',
 'Presentation, public speaking, and verbal expression',
 2, (SELECT id FROM skill_clusters WHERE code = 'COMM-INT'), 1),

('COMM-WRITTEN', 'Written Communication', 'Comunicazione Scritta',
 'Business writing, technical writing, and documentation',
 2, (SELECT id FROM skill_clusters WHERE code = 'COMM-INT'), 2),

('COMM-NEGOT', 'Negotiation & Persuasion', 'Negoziazione e Persuasione',
 'Negotiation, influence, and conflict resolution',
 2, (SELECT id FROM skill_clusters WHERE code = 'COMM-INT'), 3),

('COMM-TEAM', 'Teamwork & Collaboration', 'Lavoro di Squadra e Collaborazione',
 'Team dynamics, cross-functional collaboration, and remote work',
 2, (SELECT id FROM skill_clusters WHERE code = 'COMM-INT'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.4 Data & Analytics Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('DATA-BI', 'Business Intelligence', 'Business Intelligence',
 'BI tools, dashboards, and reporting',
 2, (SELECT id FROM skill_clusters WHERE code = 'DATA-ANA'), 1),

('DATA-ML', 'Machine Learning & AI', 'Machine Learning e AI',
 'ML algorithms, deep learning, and AI applications',
 2, (SELECT id FROM skill_clusters WHERE code = 'DATA-ANA'), 2),

('DATA-STAT', 'Statistics & Analytics', 'Statistica e Analytics',
 'Statistical analysis, data science, and quantitative methods',
 2, (SELECT id FROM skill_clusters WHERE code = 'DATA-ANA'), 3),

('DATA-VIZ', 'Data Visualization', 'Visualizzazione Dati',
 'Charts, graphs, and visual storytelling with data',
 2, (SELECT id FROM skill_clusters WHERE code = 'DATA-ANA'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.5 Finance & Accounting Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('FIN-ACC-MGMT', 'Accounting & Financial Management', 'Contabilità e Gestione Finanziaria',
 'General ledger, financial statements, and accounting operations',
 2, (SELECT id FROM skill_clusters WHERE code = 'FIN-ACC'), 1),

('FIN-BUDG', 'Budgeting & Forecasting', 'Budget e Previsioni',
 'Financial planning, budgeting, and forecasting',
 2, (SELECT id FROM skill_clusters WHERE code = 'FIN-ACC'), 2),

('FIN-INV', 'Investment & Treasury', 'Investimenti e Tesoreria',
 'Investment analysis, treasury operations, and capital management',
 2, (SELECT id FROM skill_clusters WHERE code = 'FIN-ACC'), 3),

('FIN-AUDIT', 'Audit & Control', 'Audit e Controllo',
 'Internal audit, financial controls, and compliance',
 2, (SELECT id FROM skill_clusters WHERE code = 'FIN-ACC'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.6 Human Resources & People Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('HR-RECRUIT', 'Recruitment & Talent Acquisition', 'Recruiting e Acquisizione Talenti',
 'Sourcing, interviewing, and hiring processes',
 2, (SELECT id FROM skill_clusters WHERE code = 'HR-PPL'), 1),

('HR-L&D', 'Learning & Development', 'Formazione e Sviluppo',
 'Training, coaching, and employee development programs',
 2, (SELECT id FROM skill_clusters WHERE code = 'HR-PPL'), 2),

('HR-COMP', 'Compensation & Benefits', 'Compensation e Benefits',
 'Salary structures, benefits administration, and total rewards',
 2, (SELECT id FROM skill_clusters WHERE code = 'HR-PPL'), 3),

('HR-PERF', 'Performance Management', 'Performance Management',
 'Performance reviews, goal setting, and feedback systems',
 2, (SELECT id FROM skill_clusters WHERE code = 'HR-PPL'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.7 Operations & Logistics Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('OPS-PROC', 'Process Improvement', 'Miglioramento Processi',
 'Lean, Six Sigma, and continuous improvement',
 2, (SELECT id FROM skill_clusters WHERE code = 'OPS-LOG'), 1),

('OPS-SCM', 'Supply Chain Management', 'Supply Chain Management',
 'Procurement, logistics, and supply chain optimization',
 2, (SELECT id FROM skill_clusters WHERE code = 'OPS-LOG'), 2),

('OPS-QUAL', 'Quality Management', 'Quality Management',
 'QA, QC, and quality assurance methodologies',
 2, (SELECT id FROM skill_clusters WHERE code = 'OPS-LOG'), 3)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.8 Sales & Marketing Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('SALES-B2B', 'B2B Sales', 'Vendite B2B',
 'Enterprise sales, account management, and business development',
 2, (SELECT id FROM skill_clusters WHERE code = 'SALES-MKT'), 1),

('MKT-DIGITAL', 'Digital Marketing', 'Marketing Digitale',
 'SEO, SEM, social media, and digital campaigns',
 2, (SELECT id FROM skill_clusters WHERE code = 'SALES-MKT'), 2),

('MKT-BRAND', 'Brand & Content Marketing', 'Brand e Content Marketing',
 'Brand strategy, content creation, and storytelling',
 2, (SELECT id FROM skill_clusters WHERE code = 'SALES-MKT'), 3),

('CX-SERVICE', 'Customer Experience', 'Customer Experience',
 'Customer success, support, and experience management',
 2, (SELECT id FROM skill_clusters WHERE code = 'SALES-MKT'), 4)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.9 Legal & Compliance Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('LEGAL-CORP', 'Corporate Legal', 'Legale Societario',
 'Contract law, corporate governance, and legal advisory',
 2, (SELECT id FROM skill_clusters WHERE code = 'LEGAL-COMP'), 1),

('COMP-REG', 'Regulatory Compliance', 'Compliance Regolamentare',
 'Industry regulations, compliance frameworks, and reporting',
 2, (SELECT id FROM skill_clusters WHERE code = 'LEGAL-COMP'), 2),

('RISK-MGT', 'Risk Management', 'Risk Management',
 'Risk assessment, mitigation, and enterprise risk management',
 2, (SELECT id FROM skill_clusters WHERE code = 'LEGAL-COMP'), 3)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2.10 Creative & Design Subfamilies
INSERT INTO skill_clusters (code, name_en, name_it, description, cluster_level, parent_cluster_id, sort_order)
VALUES
('DES-UX', 'UX/UI Design', 'Design UX/UI',
 'User experience, interface design, and usability',
 2, (SELECT id FROM skill_clusters WHERE code = 'CREATIVE'), 1),

('DES-GRAPH', 'Graphic Design', 'Design Grafico',
 'Visual design, branding, and graphic communication',
 2, (SELECT id FROM skill_clusters WHERE code = 'CREATIVE'), 2),

('DES-PROD', 'Product Design', 'Product Design',
 'Product strategy, design thinking, and innovation',
 2, (SELECT id FROM skill_clusters WHERE code = 'CREATIVE'), 3)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- =============================================================================
-- PART 3: VERIFICATION
-- =============================================================================

-- Show cluster summary
DO $$
DECLARE
    v_family_count INTEGER;
    v_subfamily_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_family_count FROM skill_clusters WHERE cluster_level = 1;
    SELECT COUNT(*) INTO v_subfamily_count FROM skill_clusters WHERE cluster_level = 2;

    RAISE NOTICE 'Skill Clusters seeded successfully:';
    RAISE NOTICE '  - Level 1 (Families): % clusters', v_family_count;
    RAISE NOTICE '  - Level 2 (Subfamilies): % clusters', v_subfamily_count;
    RAISE NOTICE '  - Total: % clusters', v_family_count + v_subfamily_count;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
