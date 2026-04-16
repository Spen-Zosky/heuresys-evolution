-- Seed: prototype_banking_k64.sql
-- Description: Complete seed data for Banking (K.64) industry prototype
-- Includes: Business processes, cost centers, tasks, KPIs, distributions, staffing rules
-- Author: Claude AI
-- Date: 2025-12-19

BEGIN;

-- ============================================================================
-- BANKING PROTOTYPE CONSTANTS
-- ============================================================================
-- Industry Prototype ID: 72770783-1fd9-4058-804f-7d3b9efc6218 (BANKING-M)
-- Org Chart Template ID: d98a254d-341e-42c1-857e-0546ad4a3c7a (K64.1LG)

-- ============================================================================
-- 1. BUSINESS PROCESSES - Porter's Value Chain for Banking
-- ============================================================================

-- PRIMARY ACTIVITIES (value_chain_position 1-5)
INSERT INTO business_processes (prototype_id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs) VALUES
-- 1. Inbound Logistics (Customer Acquisition & Onboarding)
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-01', 'Customer Acquisition', 'primary', 1,
 'Attracting and acquiring new customers through marketing, referrals, and partnerships',
 ARRAY['Market research data', 'Lead lists', 'Marketing campaigns', 'Partner referrals'],
 ARRAY['Qualified leads', 'Customer applications', 'KYC documents']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-02', 'Customer Onboarding', 'primary', 1,
 'Processing new customer applications, KYC/AML verification, and account opening',
 ARRAY['Customer applications', 'Identity documents', 'KYC data'],
 ARRAY['Verified customers', 'Active accounts', 'Customer profiles']),

-- 2. Operations (Core Banking Operations)
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-03', 'Deposit Services', 'primary', 2,
 'Managing customer deposits including savings, current, and term deposits',
 ARRAY['Customer deposits', 'Interest rate policies', 'Deposit agreements'],
 ARRAY['Active deposit accounts', 'Interest calculations', 'Account statements']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-04', 'Lending Operations', 'primary', 2,
 'Processing and managing loans including personal, mortgage, and business loans',
 ARRAY['Loan applications', 'Credit assessments', 'Collateral documents'],
 ARRAY['Approved loans', 'Loan disbursements', 'Repayment schedules']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-05', 'Payment Processing', 'primary', 2,
 'Processing all payment transactions including transfers, cards, and clearing',
 ARRAY['Payment instructions', 'Account balances', 'Clearing files'],
 ARRAY['Completed transactions', 'Payment confirmations', 'Settlement reports']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-06', 'Treasury Operations', 'primary', 2,
 'Managing bank liquidity, investments, and market operations',
 ARRAY['Cash flow forecasts', 'Market data', 'Investment policies'],
 ARRAY['Liquidity reports', 'Investment portfolios', 'FX positions']),

-- 3. Outbound Logistics (Product Delivery)
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-07', 'Branch Operations', 'primary', 3,
 'Managing physical branch network and customer service delivery',
 ARRAY['Customer requests', 'Branch resources', 'Service protocols'],
 ARRAY['Completed transactions', 'Customer interactions', 'Service metrics']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-08', 'Digital Banking', 'primary', 3,
 'Operating digital channels including mobile app, internet banking, and ATM network',
 ARRAY['Digital infrastructure', 'Customer credentials', 'Service requests'],
 ARRAY['Digital transactions', 'Channel usage data', 'Customer feedback']),

-- 4. Marketing & Sales
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-09', 'Product Marketing', 'primary', 4,
 'Marketing banking products and services to target segments',
 ARRAY['Market analysis', 'Product specifications', 'Customer segments'],
 ARRAY['Marketing campaigns', 'Lead generation', 'Brand awareness']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-10', 'Relationship Management', 'primary', 4,
 'Managing customer relationships and cross-selling products',
 ARRAY['Customer data', 'Product portfolio', 'Sales targets'],
 ARRAY['Customer meetings', 'Cross-sell opportunities', 'Revenue growth']),

-- 5. Service (Customer Service & Support)
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-11', 'Customer Support', 'primary', 5,
 'Providing customer service through call center, chat, and email',
 ARRAY['Customer inquiries', 'Service protocols', 'Knowledge base'],
 ARRAY['Resolved issues', 'Customer satisfaction scores', 'Feedback data']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-12', 'Complaint Management', 'primary', 5,
 'Handling customer complaints and dispute resolution',
 ARRAY['Customer complaints', 'Investigation data', 'Resolution protocols'],
 ARRAY['Resolved complaints', 'Compensation decisions', 'Process improvements']);

-- SUPPORT ACTIVITIES (value_chain_position 6-9)
INSERT INTO business_processes (prototype_id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs) VALUES
-- 6. Procurement
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-13', 'Vendor Management', 'support', 6,
 'Managing relationships with vendors and service providers',
 ARRAY['Vendor proposals', 'Service requirements', 'Contract terms'],
 ARRAY['Vendor contracts', 'SLA monitoring', 'Vendor assessments']),

-- 7. Technology Development
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-14', 'Core Banking Systems', 'support', 7,
 'Maintaining and developing core banking technology infrastructure',
 ARRAY['Business requirements', 'Technical specifications', 'Change requests'],
 ARRAY['System updates', 'New features', 'Technical documentation']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-15', 'Cybersecurity', 'support', 7,
 'Protecting bank systems and data from cyber threats',
 ARRAY['Threat intelligence', 'Security policies', 'Audit findings'],
 ARRAY['Security controls', 'Incident responses', 'Compliance reports']),

-- 8. Human Resource Management
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-16', 'Talent Management', 'support', 8,
 'Recruiting, developing, and retaining banking talent',
 ARRAY['Workforce plans', 'Job requirements', 'Training needs'],
 ARRAY['Hired employees', 'Training completion', 'Performance reviews']),

-- 9. Firm Infrastructure
('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-17', 'Risk Management', 'support', 9,
 'Identifying, assessing, and mitigating operational and financial risks',
 ARRAY['Risk data', 'Market conditions', 'Regulatory requirements'],
 ARRAY['Risk assessments', 'Mitigation strategies', 'Risk reports']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-18', 'Regulatory Compliance', 'support', 9,
 'Ensuring compliance with banking regulations and reporting requirements',
 ARRAY['Regulatory updates', 'Compliance policies', 'Audit findings'],
 ARRAY['Compliance reports', 'Regulatory filings', 'Policy updates']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-19', 'Financial Control', 'support', 9,
 'Managing financial reporting, budgeting, and internal controls',
 ARRAY['Financial data', 'Budget plans', 'Control requirements'],
 ARRAY['Financial statements', 'Budget reports', 'Audit trails']),

('72770783-1fd9-4058-804f-7d3b9efc6218', 'BP-BANK-20', 'Internal Audit', 'support', 9,
 'Conducting independent audits of bank processes and controls',
 ARRAY['Audit plans', 'Process documentation', 'Control frameworks'],
 ARRAY['Audit reports', 'Findings', 'Remediation tracking']);

-- ============================================================================
-- 2. PROCESS COST CENTERS
-- ============================================================================

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-RB', 'Retail Banking', 'direct', 'Customer-facing retail banking operations'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-01', 'BP-BANK-02', 'BP-BANK-03', 'BP-BANK-07');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-CB', 'Corporate Banking', 'direct', 'Corporate and business banking services'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-04', 'BP-BANK-10');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-TRS', 'Treasury', 'direct', 'Treasury and market operations'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-06';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-OPS', 'Operations Center', 'direct', 'Payment processing and back-office operations'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-05', 'BP-BANK-08');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-MKT', 'Marketing', 'indirect', 'Marketing and communications'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-09');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-CSS', 'Customer Service', 'indirect', 'Customer support and complaint handling'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-11', 'BP-BANK-12');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-IT', 'Information Technology', 'overhead', 'IT infrastructure and development'
FROM business_processes bp WHERE bp.process_code IN ('BP-BANK-14', 'BP-BANK-15');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-HR', 'Human Resources', 'overhead', 'HR operations and talent management'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-16';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-RISK', 'Risk Management', 'overhead', 'Enterprise risk management'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-17';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-COMP', 'Compliance', 'overhead', 'Regulatory compliance'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-18';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-FIN', 'Finance', 'overhead', 'Financial control and reporting'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-19';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-AUD', 'Internal Audit', 'overhead', 'Internal audit function'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-20';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-PROC', 'Procurement', 'overhead', 'Procurement and vendor management'
FROM business_processes bp WHERE bp.process_code = 'BP-BANK-13';

-- ============================================================================
-- 3. ORG UNIT TASKS
-- ============================================================================

-- DIR-AFC (Admin Finance Control) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-01', 'Monthly Financial Close', 'Execute month-end closing procedures and prepare financial statements', 'monthly', 4, 40.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-02', 'Budget Variance Analysis', 'Analyze budget vs actual variances and prepare management reports', 'monthly', 3, 16.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-03', 'Regulatory Financial Reporting', 'Prepare and submit regulatory financial reports (FINREP, COREP)', 'quarterly', 5, 80.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

-- DIR-OPS (Operations) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-01', 'Daily Payment Processing', 'Process and reconcile daily payment transactions', 'daily', 3, 8.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-02', 'Branch Operations Review', 'Review branch performance and operational metrics', 'weekly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-03', 'ATM/Digital Channel Monitoring', 'Monitor digital channel availability and performance', 'daily', 2, 4.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

-- DIR-QSE (Quality/Risk/Compliance) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-01', 'Risk Assessment Review', 'Conduct risk assessment reviews and update risk registers', 'monthly', 4, 24.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-02', 'AML Transaction Monitoring', 'Monitor and review suspicious transaction alerts', 'daily', 4, 8.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-03', 'Regulatory Change Assessment', 'Assess impact of new regulatory requirements', 'on_demand', 5, 40.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-04', 'Internal Audit Execution', 'Execute planned internal audits per annual audit plan', 'quarterly', 5, 160.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

-- DIR-COMM (Sales & Marketing) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-01', 'Customer Relationship Reviews', 'Conduct portfolio reviews with key customers', 'quarterly', 3, 40.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-02', 'Marketing Campaign Execution', 'Plan and execute marketing campaigns', 'monthly', 4, 60.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-03', 'Sales Pipeline Management', 'Manage and review sales pipeline and opportunities', 'weekly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

-- DIR-IT Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-IT-01', 'System Availability Monitoring', 'Monitor critical system availability and performance', 'daily', 3, 8.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-IT-02', 'Security Incident Response', 'Respond to and manage security incidents', 'on_demand', 5, 16.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-IT-03', 'Change Management', 'Review and approve system changes', 'weekly', 4, 8.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

-- DIR-HR Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-HR-01', 'Recruitment Process Management', 'Manage end-to-end recruitment process', 'on_demand', 3, 20.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-HR-02', 'Performance Review Cycle', 'Coordinate annual performance review process', 'yearly', 4, 160.00, true
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-HR-03', 'Training Program Delivery', 'Deliver mandatory compliance and skills training', 'quarterly', 3, 40.00, false
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

-- ============================================================================
-- 4. ORG UNIT KPIS
-- ============================================================================

-- DIR-AFC KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-01', 'Cost-to-Income Ratio', 'Operating expenses as percentage of operating income', '%', 'decrease', 55.00, 'Financial Statements', 'Operating Expenses / Operating Income * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-02', 'Financial Close Timeliness', 'Days to complete monthly financial close', 'days', 'decrease', 5.00, 'ERP System', 'Days from month end to books closed'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-03', 'Return on Equity', 'Net income as percentage of shareholders equity', '%', 'increase', 12.00, 'Financial Statements', 'Net Income / Average Shareholders Equity * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC';

-- DIR-OPS KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-01', 'Transaction Processing SLA', 'Percentage of transactions processed within SLA', '%', 'increase', 99.50, 'Core Banking System', 'Transactions within SLA / Total Transactions * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-02', 'Digital Channel Availability', 'System uptime for digital banking channels', '%', 'increase', 99.90, 'IT Monitoring', 'Total Uptime Hours / Total Hours * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-03', 'Branch Efficiency Ratio', 'Revenue per branch employee', 'EUR', 'increase', 150000.00, 'Branch Management System', 'Branch Revenue / Branch FTE'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS';

-- DIR-QSE KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-01', 'Non-Performing Loan Ratio', 'NPL as percentage of total loans', '%', 'decrease', 3.00, 'Core Banking System', 'Non-Performing Loans / Total Loans * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-02', 'Regulatory Finding Resolution', 'Days to resolve regulatory audit findings', 'days', 'decrease', 30.00, 'Compliance System', 'Average days from finding to resolution'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-03', 'Capital Adequacy Ratio', 'Total capital as percentage of risk-weighted assets', '%', 'maintain', 15.00, 'Risk Management System', 'Total Capital / Risk-Weighted Assets * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, benchmark_min, benchmark_max, data_source, calculation_formula)
SELECT id, 'KPI-QSE-04', 'Liquidity Coverage Ratio', 'High-quality liquid assets as percentage of net cash outflows', '%', 'range', 120.00, 100.00, 150.00, 'Treasury System', 'HQLA / Net Cash Outflows * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE';

-- DIR-COMM KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-01', 'Customer Acquisition Cost', 'Average cost to acquire new customer', 'EUR', 'decrease', 150.00, 'CRM System', 'Total Acquisition Costs / New Customers'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-02', 'Net Promoter Score', 'Customer willingness to recommend bank', 'score', 'increase', 45.00, 'Survey System', 'Promoters % - Detractors %'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-03', 'Products per Customer', 'Average number of products per customer', 'count', 'increase', 3.50, 'CRM System', 'Total Active Products / Active Customers'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM';

-- DIR-IT KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-IT-01', 'System Availability', 'Core banking system uptime', '%', 'increase', 99.95, 'IT Monitoring', 'Total Uptime / Total Time * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-IT-02', 'Mean Time to Recovery', 'Average time to recover from incidents', 'minutes', 'decrease', 30.00, 'ITSM System', 'Sum(Recovery Times) / Number of Incidents'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-IT-03', 'Security Incidents', 'Number of security incidents per month', 'count', 'decrease', 2.00, 'SIEM System', 'Count of security incidents'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT';

-- DIR-HR KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-HR-01', 'Employee Turnover Rate', 'Annual voluntary turnover rate', '%', 'decrease', 8.00, 'HRIS', 'Voluntary Leavers / Average Headcount * 100'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-HR-02', 'Training Hours per Employee', 'Average training hours per employee per year', 'hours', 'increase', 40.00, 'LMS', 'Total Training Hours / Total Employees'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-HR-03', 'Time to Fill', 'Average days to fill open positions', 'days', 'decrease', 45.00, 'ATS System', 'Sum(Days to Fill) / Positions Filled'
FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR';

-- ============================================================================
-- 5. PROTOTYPE STAFFING RULES (Medium Bank)
-- ============================================================================

-- CEO Level
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'One CEO required for executive leadership'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'CEO' AND jt.job_code = 'CEO-EXEC';

-- Director Level - AFC
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'CFO/Finance Director required for financial oversight'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-AFC' AND jt.job_code = 'DIR-AFC-DIR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 0, 1, 1, false, 'Deputy CFO recommended for medium banks'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-AFC' AND jt.job_code = 'DIR-AFC-VDIR';

-- Director Level - OPS
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'COO required for operations management'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-OPS' AND jt.job_code = 'DIR-OPS-DIR';

-- Director Level - QSE (Risk/Compliance)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'CRO required for regulatory compliance'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-QSE' AND jt.job_code = 'DIR-QSE-DIR';

-- Director Level - COMM (Sales/Marketing)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'Commercial Director required for business development'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-COMM' AND jt.job_code = 'DIR-COMM-DIR';

-- Director Level - IT
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'CTO/IT Director required for technology management'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-IT' AND jt.job_code = 'DIR-IT-DIR';

-- Director Level - HR
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'CHRO/HR Director required for people management'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DIR-HR' AND jt.job_code = 'DIR-HR-DIR';

-- Department Level - Managers and Senior Managers
-- AFC Departments
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Finance department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-AFC-1' AND jt.job_code = 'DEPT-AFC-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 2, 5, 3, true, 'Senior finance managers for accounting and treasury'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-AFC-1' AND jt.job_code = 'DEPT-AFC-1-SMGR';

-- OPS Departments
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Operations department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-OPS-1' AND jt.job_code = 'DEPT-OPS-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 3, 8, 5, true, 'Senior operations managers for branch and digital channels'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-OPS-1' AND jt.job_code = 'DEPT-OPS-1-SMGR';

-- QSE Departments (Risk/Compliance)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Risk/Compliance department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-QSE-1' AND jt.job_code = 'DEPT-QSE-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 5, 12, 8, true, 'Senior risk/compliance managers for credit risk, market risk, AML, and audit'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-QSE-1' AND jt.job_code = 'DEPT-QSE-1-SMGR';

-- COMM Departments (Sales/Marketing)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Sales/Marketing department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-COMM-1' AND jt.job_code = 'DEPT-COMM-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 10, 25, 15, true, 'Relationship managers for retail and corporate segments'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-COMM-1' AND jt.job_code = 'DEPT-COMM-1-SMGR';

-- IT Departments
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'IT department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-IT-1' AND jt.job_code = 'DEPT-IT-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 8, 20, 12, true, 'Senior IT managers/architects for development, infrastructure, and security'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-IT-1' AND jt.job_code = 'DEPT-IT-1-SMGR';

-- HR Departments
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'HR department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-HR-1' AND jt.job_code = 'DEPT-HR-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '72770783-1fd9-4058-804f-7d3b9efc6218',
       out.id, jt.id, 'medium', 3, 8, 5, true, 'Senior HR managers for recruitment, L&D, and compensation'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'
  AND out.code = 'DEPT-HR-1' AND jt.job_code = 'DEPT-HR-1-SMGR';

-- ============================================================================
-- 6. JOB TASK DISTRIBUTION
-- ============================================================================

-- AFC Director - Financial Close
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 30, true, 'Oversees and approves monthly financial close'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-AFC-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC')
  AND t.task_code = 'TSK-AFC-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC');

-- AFC Senior Manager - Financial Close
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 70, false, 'Executes monthly financial close procedures'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-AFC-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DEPT-AFC-1')
  AND t.task_code = 'TSK-AFC-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC');

-- OPS Director - Daily Payments
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 20, true, 'Oversees payment processing operations'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS')
  AND t.task_code = 'TSK-OPS-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS');

-- OPS Senior Manager - Daily Payments
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 80, false, 'Manages daily payment processing and reconciliation'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-OPS-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DEPT-OPS-1')
  AND t.task_code = 'TSK-OPS-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS');

-- QSE Director - Risk Assessment
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 40, true, 'Leads risk assessment reviews and approves risk mitigation strategies'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE')
  AND t.task_code = 'TSK-QSE-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE');

-- QSE Senior Manager - Risk Assessment
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 60, false, 'Conducts risk assessments and updates risk registers'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-QSE-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DEPT-QSE-1')
  AND t.task_code = 'TSK-QSE-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE');

-- IT Director - Security Incident Response
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 50, true, 'Leads critical security incident response'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-IT-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT')
  AND t.task_code = 'TSK-IT-02'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT');

-- IT Senior Manager - Security Incident Response
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 50, false, 'Executes security incident response procedures'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-IT-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DEPT-IT-1')
  AND t.task_code = 'TSK-IT-02'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT');

-- ============================================================================
-- 7. JOB KPI DISTRIBUTION
-- ============================================================================

-- AFC Director - Cost-to-Income Ratio
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for cost management'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-AFC-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC')
  AND k.kpi_code = 'KPI-AFC-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC');

-- AFC Director - ROE
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'contributor', 30, 'Contributes to profitability through cost management'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-AFC-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC')
  AND k.kpi_code = 'KPI-AFC-03'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-AFC');

-- OPS Director - Transaction Processing SLA
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for operational SLAs'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS')
  AND k.kpi_code = 'KPI-OPS-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS');

-- OPS Director - Digital Channel Availability
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'contributor', 25, 'Shared accountability with IT for channel availability'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS')
  AND k.kpi_code = 'KPI-OPS-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-OPS');

-- QSE Director - NPL Ratio
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for credit risk management'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE')
  AND k.kpi_code = 'KPI-QSE-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE');

-- QSE Director - Capital Adequacy
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 30, 'Ensures regulatory capital compliance'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE')
  AND k.kpi_code = 'KPI-QSE-03'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-QSE');

-- COMM Director - Customer Acquisition Cost
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 30, 'Primary accountability for efficient customer acquisition'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-COMM-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM')
  AND k.kpi_code = 'KPI-COMM-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM');

-- COMM Director - NPS
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for customer satisfaction'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-COMM-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM')
  AND k.kpi_code = 'KPI-COMM-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-COMM');

-- IT Director - System Availability
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for system uptime'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-IT-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT')
  AND k.kpi_code = 'KPI-IT-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT');

-- IT Director - Security Incidents
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for cybersecurity'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-IT-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT')
  AND k.kpi_code = 'KPI-IT-03'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-IT');

-- HR Director - Turnover
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for employee retention'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-HR-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR')
  AND k.kpi_code = 'KPI-HR-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR');

-- HR Director - Training Hours
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 30, 'Primary accountability for employee development'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-HR-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR')
  AND k.kpi_code = 'KPI-HR-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a' AND code = 'DIR-HR');

-- ============================================================================
-- VERIFICATION REPORT
-- ============================================================================

DO $$
DECLARE
    bp_count INTEGER;
    cc_count INTEGER;
    task_count INTEGER;
    kpi_count INTEGER;
    staffing_count INTEGER;
    task_dist_count INTEGER;
    kpi_dist_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bp_count FROM business_processes WHERE prototype_id = '72770783-1fd9-4058-804f-7d3b9efc6218';
    SELECT COUNT(*) INTO cc_count FROM process_cost_centers WHERE process_id IN (SELECT id FROM business_processes WHERE prototype_id = '72770783-1fd9-4058-804f-7d3b9efc6218');
    SELECT COUNT(*) INTO task_count FROM org_unit_tasks WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a');
    SELECT COUNT(*) INTO kpi_count FROM org_unit_kpis WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a');
    SELECT COUNT(*) INTO staffing_count FROM prototype_staffing_rules WHERE prototype_id = '72770783-1fd9-4058-804f-7d3b9efc6218';
    SELECT COUNT(*) INTO task_dist_count FROM job_task_distribution WHERE job_template_id IN (SELECT id FROM job_templates WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'));
    SELECT COUNT(*) INTO kpi_dist_count FROM job_kpi_distribution WHERE job_template_id IN (SELECT id FROM job_templates WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = 'd98a254d-341e-42c1-857e-0546ad4a3c7a'));

    RAISE NOTICE '=== BANKING PROTOTYPE SEED REPORT ===';
    RAISE NOTICE 'Business Processes: %', bp_count;
    RAISE NOTICE 'Process Cost Centers: %', cc_count;
    RAISE NOTICE 'Org Unit Tasks: %', task_count;
    RAISE NOTICE 'Org Unit KPIs: %', kpi_count;
    RAISE NOTICE 'Staffing Rules: %', staffing_count;
    RAISE NOTICE 'Task Distributions: %', task_dist_count;
    RAISE NOTICE 'KPI Distributions: %', kpi_dist_count;
END $$;

COMMIT;
