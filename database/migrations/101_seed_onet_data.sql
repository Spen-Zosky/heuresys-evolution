-- Migration 101: Seed O*NET Data
-- Populates O*NET tables with representative occupational data
-- Focused on financial services, HR, IT, and management roles
-- Story: S-ONTO-01-04

BEGIN;

-- =============================================================================
-- O*NET SKILLS (35 core skills from O*NET Content Model)
-- =============================================================================
INSERT INTO onet_skills (element_id, element_name, description, category) VALUES
('2.A.1.a', 'Reading Comprehension', 'Understanding written sentences and paragraphs in work-related documents', 'Basic Skills'),
('2.A.1.b', 'Active Listening', 'Giving full attention to what other people are saying', 'Basic Skills'),
('2.A.1.c', 'Writing', 'Communicating effectively in writing as appropriate for the needs of the audience', 'Basic Skills'),
('2.A.1.d', 'Speaking', 'Talking to others to convey information effectively', 'Basic Skills'),
('2.A.1.e', 'Mathematics', 'Using mathematics to solve problems', 'Basic Skills'),
('2.A.1.f', 'Science', 'Using scientific rules and methods to solve problems', 'Basic Skills'),
('2.A.2.a', 'Critical Thinking', 'Using logic and reasoning to identify strengths and weaknesses of alternative solutions', 'Cross-Functional Skills'),
('2.A.2.b', 'Active Learning', 'Understanding the implications of new information for both current and future problem-solving', 'Cross-Functional Skills'),
('2.A.2.c', 'Learning Strategies', 'Selecting and using training/instructional methods appropriate for the situation', 'Cross-Functional Skills'),
('2.A.2.d', 'Monitoring', 'Monitoring/assessing performance of yourself, other individuals, or organizations', 'Cross-Functional Skills'),
('2.B.1.a', 'Social Perceptiveness', 'Being aware of others reactions and understanding why they react as they do', 'Social Skills'),
('2.B.1.b', 'Coordination', 'Adjusting actions in relation to others actions', 'Social Skills'),
('2.B.1.c', 'Persuasion', 'Persuading others to change their minds or behavior', 'Social Skills'),
('2.B.1.d', 'Negotiation', 'Bringing others together and trying to reconcile differences', 'Social Skills'),
('2.B.1.e', 'Instructing', 'Teaching others how to do something', 'Social Skills'),
('2.B.1.f', 'Service Orientation', 'Actively looking for ways to help people', 'Social Skills'),
('2.B.2.i', 'Complex Problem Solving', 'Identifying complex problems and reviewing related information to develop and evaluate options', 'Complex Problem Solving Skills'),
('2.B.3.a', 'Operations Analysis', 'Analyzing needs and product requirements to create a design', 'Technical Skills'),
('2.B.3.b', 'Technology Design', 'Generating or adapting equipment and technology to serve user needs', 'Technical Skills'),
('2.B.3.c', 'Equipment Selection', 'Determining the kind of tools and equipment needed to do a job', 'Technical Skills'),
('2.B.3.d', 'Installation', 'Installing equipment, machines, wiring, or programs to meet specifications', 'Technical Skills'),
('2.B.3.e', 'Programming', 'Writing computer programs for various purposes', 'Technical Skills'),
('2.B.4.e', 'Quality Control Analysis', 'Conducting tests and inspections of products, services, or processes', 'Technical Skills'),
('2.B.4.g', 'Operations Monitoring', 'Watching gauges, dials, or other indicators to make sure a machine is working properly', 'Technical Skills'),
('2.B.5.a', 'Time Management', 'Managing ones own time and the time of others', 'Systems Skills'),
('2.B.5.b', 'Management of Financial Resources', 'Determining how money will be spent to get the work done', 'Systems Skills'),
('2.B.5.c', 'Management of Material Resources', 'Obtaining and seeing to the appropriate use of equipment and materials', 'Systems Skills'),
('2.B.5.d', 'Management of Personnel Resources', 'Motivating, developing, and directing people as they work', 'Systems Skills'),
('2.B.4.a', 'Judgment and Decision Making', 'Considering the relative costs and benefits of potential actions', 'Systems Skills'),
('2.B.4.b', 'Systems Analysis', 'Determining how a system should work and how changes will affect outcomes', 'Systems Skills'),
('2.B.4.c', 'Systems Evaluation', 'Identifying measures or indicators of system performance', 'Systems Skills'),
('2.C.1.a', 'Oral Comprehension', 'The ability to listen to and understand information and ideas presented through spoken words', 'Cognitive Abilities'),
('2.C.1.b', 'Written Comprehension', 'The ability to read and understand information and ideas presented in writing', 'Cognitive Abilities'),
('2.C.4.a', 'Mathematical Reasoning', 'The ability to choose the right mathematical methods to solve a problem', 'Cognitive Abilities'),
('2.C.4.b', 'Number Facility', 'The ability to add, subtract, multiply, or divide quickly and correctly', 'Cognitive Abilities')
ON CONFLICT (element_id) DO NOTHING;

-- =============================================================================
-- O*NET ABILITIES (15 key abilities)
-- =============================================================================
INSERT INTO onet_abilities (element_id, element_name, description, category) VALUES
('1.A.1.a.1', 'Oral Comprehension', 'The ability to listen to and understand information and ideas presented through spoken words and sentences', 'Cognitive'),
('1.A.1.a.2', 'Written Comprehension', 'The ability to read and understand information and ideas presented in writing', 'Cognitive'),
('1.A.1.a.3', 'Oral Expression', 'The ability to communicate information and ideas in speaking so others will understand', 'Cognitive'),
('1.A.1.a.4', 'Written Expression', 'The ability to communicate information and ideas in writing so others will understand', 'Cognitive'),
('1.A.1.b.2', 'Deductive Reasoning', 'The ability to apply general rules to specific problems to produce answers that make sense', 'Cognitive'),
('1.A.1.b.3', 'Inductive Reasoning', 'The ability to combine pieces of information to form general rules or conclusions', 'Cognitive'),
('1.A.1.b.4', 'Information Ordering', 'The ability to arrange things or actions in a certain order according to specific rules', 'Cognitive'),
('1.A.1.b.7', 'Problem Sensitivity', 'The ability to tell when something is wrong or is likely to go wrong', 'Cognitive'),
('1.A.1.c.1', 'Mathematical Reasoning', 'The ability to choose the right mathematical methods or formulas to solve a problem', 'Quantitative'),
('1.A.1.c.2', 'Number Facility', 'The ability to add, subtract, multiply, or divide quickly and correctly', 'Quantitative'),
('1.A.2.a.2', 'Near Vision', 'The ability to see details at close range', 'Sensory'),
('1.A.2.b.1', 'Speech Clarity', 'The ability to speak clearly so others can understand you', 'Sensory'),
('1.A.2.b.2', 'Speech Recognition', 'The ability to identify and understand the speech of another person', 'Sensory'),
('1.A.4.a.4', 'Stamina', 'The ability to exert yourself physically over long periods of time without getting winded or out of breath', 'Physical'),
('1.A.3.a.1', 'Finger Dexterity', 'The ability to make precisely coordinated movements of the fingers', 'Psychomotor')
ON CONFLICT (element_id) DO NOTHING;

-- =============================================================================
-- O*NET KNOWLEDGE (20 knowledge domains)
-- =============================================================================
INSERT INTO onet_knowledge (element_id, element_name, description, domain) VALUES
('2.C.1.a', 'Administration and Management', 'Knowledge of business and management principles involved in strategic planning, resource allocation, HR modeling, leadership, production methods, and coordination of people and resources', 'Business'),
('2.C.1.b', 'Clerical', 'Knowledge of administrative and clerical procedures and systems such as word processing, managing files and records, designing forms, and other office procedures', 'Business'),
('2.C.1.c', 'Economics and Accounting', 'Knowledge of economic and accounting principles and practices, financial markets, banking and the analysis and reporting of financial data', 'Business'),
('2.C.1.d', 'Sales and Marketing', 'Knowledge of principles and methods for showing, promoting, and selling products or services', 'Business'),
('2.C.1.e', 'Customer and Personal Service', 'Knowledge of principles and processes for providing customer and personal services, including customer needs assessment and evaluation of customer satisfaction', 'Business'),
('2.C.1.f', 'Personnel and Human Resources', 'Knowledge of principles and procedures for personnel recruitment, selection, training, compensation and benefits, labor relations and negotiation, and personnel information systems', 'Business'),
('2.C.3.a', 'Computers and Electronics', 'Knowledge of circuit boards, processors, chips, electronic equipment, and computer hardware and software, including applications and programming', 'Technology'),
('2.C.3.b', 'Engineering and Technology', 'Knowledge of the practical application of engineering science and technology', 'Technology'),
('2.C.4.a', 'Mathematics', 'Knowledge of arithmetic, algebra, geometry, calculus, statistics, and their applications', 'Mathematics'),
('2.C.4.d', 'Psychology', 'Knowledge of human behavior and performance; individual differences in ability, personality, and interests; learning and motivation', 'Social Science'),
('2.C.4.e', 'Sociology and Anthropology', 'Knowledge of group behavior and dynamics, societal trends, ethnicity, cultures, and their history and origins', 'Social Science'),
('2.C.5.a', 'Education and Training', 'Knowledge of principles and methods for curriculum and training design, teaching and instruction for individuals and groups', 'Education'),
('2.C.6.a', 'English Language', 'Knowledge of the structure and content of the English language including the meaning and spelling of words, rules of composition, and grammar', 'Language'),
('2.C.7.a', 'Law and Government', 'Knowledge of laws, legal codes, court procedures, precedents, government regulations, executive orders, agency rules, and the democratic political process', 'Legal'),
('2.C.9.a', 'Communications and Media', 'Knowledge of media production, communication, and dissemination techniques and methods', 'Communications'),
('2.C.10', 'Telecommunications', 'Knowledge of transmission, broadcasting, switching, control, and operation of telecommunications systems', 'Technology'),
('2.C.4.b', 'Biology', 'Knowledge of plant and animal organisms, their tissues, cells, functions, interdependencies, and interactions', 'Science'),
('2.C.7.b', 'Public Safety and Security', 'Knowledge of relevant equipment, policies, procedures, and strategies to promote effective local, state, or national security operations', 'Security'),
('2.C.8.a', 'Medicine and Dentistry', 'Knowledge of the information and techniques needed to diagnose and treat human injuries, diseases, and deformities', 'Health'),
('2.C.8.b', 'Therapy and Counseling', 'Knowledge of principles, methods, and procedures for diagnosis, treatment, and rehabilitation of physical and mental dysfunctions', 'Health')
ON CONFLICT (element_id) DO NOTHING;

-- =============================================================================
-- O*NET WORK ACTIVITIES (15 generalized work activities)
-- =============================================================================
INSERT INTO onet_work_activities (element_id, element_name, description, activity_type) VALUES
('4.A.1.a.1', 'Getting Information', 'Observing, receiving, and otherwise obtaining information from all relevant sources', 'Information Input'),
('4.A.1.a.2', 'Monitor Processes, Materials, or Surroundings', 'Monitoring and reviewing information from materials, events, or the environment', 'Information Input'),
('4.A.1.b.2', 'Identifying Objects, Actions, and Events', 'Identifying information by categorizing, estimating, recognizing differences or similarities', 'Information Input'),
('4.A.2.a.1', 'Making Decisions and Solving Problems', 'Analyzing information and evaluating results to choose the best solution', 'Mental Processes'),
('4.A.2.a.2', 'Thinking Creatively', 'Developing, designing, or creating new applications, ideas, relationships, systems', 'Mental Processes'),
('4.A.2.a.4', 'Analyzing Data or Information', 'Identifying the underlying principles, reasons, or facts of information', 'Mental Processes'),
('4.A.2.b.1', 'Processing Information', 'Compiling, coding, categorizing, calculating, tabulating, auditing, or verifying information', 'Mental Processes'),
('4.A.2.b.2', 'Evaluating Information to Determine Compliance with Standards', 'Using relevant information and individual judgment to determine compliance', 'Mental Processes'),
('4.A.3.a.2', 'Updating and Using Relevant Knowledge', 'Keeping up-to-date technically and applying new knowledge to your job', 'Work Output'),
('4.A.3.b.4', 'Documenting/Recording Information', 'Entering, transcribing, recording, storing, or maintaining information', 'Work Output'),
('4.A.4.a.1', 'Communicating with Supervisors, Peers, or Subordinates', 'Providing information by telephone, in written form, e-mail, or in person', 'Interacting with Others'),
('4.A.4.a.4', 'Establishing and Maintaining Interpersonal Relationships', 'Developing constructive and cooperative working relationships', 'Interacting with Others'),
('4.A.4.b.4', 'Guiding, Directing, and Motivating Subordinates', 'Providing guidance and direction to subordinates, including setting performance standards', 'Interacting with Others'),
('4.A.4.b.5', 'Coaching and Developing Others', 'Identifying the developmental needs of others and coaching, mentoring', 'Interacting with Others'),
('4.A.4.c.1', 'Performing Administrative Activities', 'Performing day-to-day administrative tasks such as maintaining information files', 'Interacting with Others')
ON CONFLICT (element_id) DO NOTHING;

-- =============================================================================
-- O*NET OCCUPATIONS (25 occupations relevant to HRMS/Banking domain)
-- =============================================================================
INSERT INTO onet_occupations (onet_soc_code, title, description, job_zone, source_version) VALUES
('11-1011.00', 'Chief Executives', 'Determine and formulate policies and provide overall direction of companies or private and public sector organizations', 5, '28.1'),
('11-1021.00', 'General and Operations Managers', 'Plan, direct, or coordinate the operations of public or private sector organizations', 4, '28.1'),
('11-3011.00', 'Administrative Services Managers', 'Plan, direct, or coordinate one or more administrative services of an organization', 4, '28.1'),
('11-3021.00', 'Computer and Information Systems Managers', 'Plan, direct, or coordinate activities in electronic data processing, information systems, systems analysis, and computer programming', 5, '28.1'),
('11-3031.00', 'Financial Managers', 'Plan, direct, or coordinate accounting, investing, banking, insurance, securities, and other financial activities', 5, '28.1'),
('11-3111.00', 'Compensation and Benefits Managers', 'Plan, direct, or coordinate compensation and benefits activities of an organization', 4, '28.1'),
('11-3121.00', 'Human Resources Managers', 'Plan, direct, or coordinate human resources activities and staff of an organization', 4, '28.1'),
('11-3131.00', 'Training and Development Managers', 'Plan, direct, or coordinate the training and development activities and staff of an organization', 4, '28.1'),
('13-1071.00', 'Human Resources Specialists', 'Recruit, screen, interview, or place individuals within an organization', 4, '28.1'),
('13-1075.00', 'Labor Relations Specialists', 'Resolve disputes between workers and managers, negotiate collective bargaining agreements', 4, '28.1'),
('13-1151.00', 'Training and Development Specialists', 'Design or conduct work-related training and development programs', 4, '28.1'),
('13-2011.00', 'Accountants and Auditors', 'Examine, analyze, and interpret accounting records to prepare financial statements', 4, '28.1'),
('13-2051.00', 'Financial and Investment Analysts', 'Conduct quantitative analyses of information involving investment programs or financial data', 5, '28.1'),
('13-2072.00', 'Loan Officers', 'Evaluate, authorize, or recommend approval of commercial, real estate, or credit loans', 4, '28.1'),
('15-1211.00', 'Computer Systems Analysts', 'Analyze science, engineering, business, and other data processing problems to develop and implement solutions', 4, '28.1'),
('15-1232.00', 'Computer User Support Specialists', 'Provide technical assistance to computer users', 3, '28.1'),
('15-1252.00', 'Software Developers', 'Research, design, and develop computer and network software or specialized utility programs', 5, '28.1'),
('15-1299.08', 'Computer Systems Engineers/Architects', 'Design and develop solutions to complex applications problems, system administration issues', 5, '28.1'),
('15-2051.00', 'Data Scientists', 'Develop and implement a set of techniques or analytics applications to transform raw data', 5, '28.1'),
('17-2199.07', 'Information Security Engineers', 'Design, develop, or test software, firmware, or hardware used in protecting information systems', 5, '28.1'),
('41-3031.00', 'Securities, Commodities, and Financial Services Sales Agents', 'Buy and sell securities or commodities in investment and trading firms', 4, '28.1'),
('43-3011.00', 'Bill and Account Collectors', 'Locate and notify customers of delinquent accounts by mail, telephone, or personal visit', 3, '28.1'),
('43-3031.00', 'Bookkeeping, Accounting, and Auditing Clerks', 'Compute, classify, and record numerical data to keep financial records complete', 3, '28.1'),
('43-4161.00', 'Human Resources Assistants', 'Compile and keep personnel records', 3, '28.1'),
('43-6011.00', 'Executive Secretaries and Executive Administrative Assistants', 'Provide high-level administrative support', 3, '28.1')
ON CONFLICT (onet_soc_code) DO NOTHING;

-- =============================================================================
-- O*NET OCCUPATION-SKILL LINKS (sample links for key occupations)
-- =============================================================================
DO $$
DECLARE
    v_occ_id UUID;
    v_skill_id UUID;
BEGIN
    -- HR Manager skills
    SELECT id INTO v_occ_id FROM onet_occupations WHERE onet_soc_code = '11-3121.00';
    IF v_occ_id IS NOT NULL THEN
        FOR v_skill_id IN
            SELECT id FROM onet_skills WHERE element_id IN (
                '2.A.1.a', '2.A.1.b', '2.A.1.c', '2.A.1.d',
                '2.A.2.a', '2.A.2.d', '2.B.1.a', '2.B.1.b',
                '2.B.1.c', '2.B.1.d', '2.B.1.e', '2.B.1.f',
                '2.B.2.i', '2.B.4.a', '2.B.5.a', '2.B.5.d'
            )
        LOOP
            INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
            VALUES (v_occ_id, v_skill_id, 70 + random() * 30, 50 + random() * 40)
            ON CONFLICT (occupation_id, skill_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Financial Manager skills
    SELECT id INTO v_occ_id FROM onet_occupations WHERE onet_soc_code = '11-3031.00';
    IF v_occ_id IS NOT NULL THEN
        FOR v_skill_id IN
            SELECT id FROM onet_skills WHERE element_id IN (
                '2.A.1.a', '2.A.1.b', '2.A.1.c', '2.A.1.e',
                '2.A.2.a', '2.A.2.d', '2.B.1.b', '2.B.1.c',
                '2.B.2.i', '2.B.4.a', '2.B.5.a', '2.B.5.b',
                '2.C.4.a', '2.C.4.b'
            )
        LOOP
            INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
            VALUES (v_occ_id, v_skill_id, 65 + random() * 35, 55 + random() * 40)
            ON CONFLICT (occupation_id, skill_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Software Developer skills
    SELECT id INTO v_occ_id FROM onet_occupations WHERE onet_soc_code = '15-1252.00';
    IF v_occ_id IS NOT NULL THEN
        FOR v_skill_id IN
            SELECT id FROM onet_skills WHERE element_id IN (
                '2.A.1.a', '2.A.1.b', '2.A.2.a', '2.A.2.b',
                '2.A.2.c', '2.B.2.i', '2.B.3.a', '2.B.3.b',
                '2.B.3.e', '2.B.4.a', '2.B.4.b', '2.B.4.c',
                '2.B.4.e', '2.B.5.a'
            )
        LOOP
            INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
            VALUES (v_occ_id, v_skill_id, 60 + random() * 40, 60 + random() * 35)
            ON CONFLICT (occupation_id, skill_id) DO NOTHING;
        END LOOP;
    END IF;

    -- Data Scientist skills
    SELECT id INTO v_occ_id FROM onet_occupations WHERE onet_soc_code = '15-2051.00';
    IF v_occ_id IS NOT NULL THEN
        FOR v_skill_id IN
            SELECT id FROM onet_skills WHERE element_id IN (
                '2.A.1.a', '2.A.1.e', '2.A.2.a', '2.A.2.b',
                '2.B.2.i', '2.B.3.a', '2.B.3.e', '2.B.4.a',
                '2.B.4.b', '2.B.4.c', '2.B.4.e', '2.C.4.a',
                '2.C.4.b'
            )
        LOOP
            INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
            VALUES (v_occ_id, v_skill_id, 65 + random() * 35, 60 + random() * 35)
            ON CONFLICT (occupation_id, skill_id) DO NOTHING;
        END LOOP;
    END IF;

    -- HR Specialist skills
    SELECT id INTO v_occ_id FROM onet_occupations WHERE onet_soc_code = '13-1071.00';
    IF v_occ_id IS NOT NULL THEN
        FOR v_skill_id IN
            SELECT id FROM onet_skills WHERE element_id IN (
                '2.A.1.a', '2.A.1.b', '2.A.1.c', '2.A.1.d',
                '2.A.2.a', '2.A.2.d', '2.B.1.a', '2.B.1.b',
                '2.B.1.d', '2.B.1.f', '2.B.2.i', '2.B.4.a',
                '2.B.5.a', '2.B.5.d'
            )
        LOOP
            INSERT INTO onet_occupation_skills (occupation_id, skill_id, importance, level)
            VALUES (v_occ_id, v_skill_id, 60 + random() * 35, 45 + random() * 40)
            ON CONFLICT (occupation_id, skill_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('101') ON CONFLICT DO NOTHING;

COMMIT;
