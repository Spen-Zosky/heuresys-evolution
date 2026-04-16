-- Seed: prototype_food_mfg_c10.sql
-- Description: Complete seed data for Food Manufacturing (C.10) industry prototype
-- Includes: Business processes, cost centers, tasks, KPIs, distributions, staffing rules
-- Author: Claude AI
-- Date: 2025-12-19

BEGIN;

-- ============================================================================
-- FOOD MANUFACTURING PROTOTYPE CONSTANTS
-- ============================================================================
-- Industry Prototype ID: 04a8ff6a-09ea-40dc-824c-42533a55e975 (FOOD-MFG-M)
-- Org Chart Template ID: 99679018-33ac-4438-af88-df643f0e3c29 (C10.1SM)

-- ============================================================================
-- 1. BUSINESS PROCESSES - Porter's Value Chain for Food Manufacturing
-- ============================================================================

-- PRIMARY ACTIVITIES (value_chain_position 1-5)
INSERT INTO business_processes (prototype_id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs) VALUES
-- 1. Inbound Logistics
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-01', 'Raw Material Procurement', 'primary', 1,
 'Sourcing and purchasing raw materials, ingredients, and packaging',
 ARRAY['Supplier contracts', 'Quality specifications', 'Purchase orders'],
 ARRAY['Raw materials', 'Supplier assessments', 'Incoming goods']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-02', 'Receiving & Inspection', 'primary', 1,
 'Receiving, inspecting, and storing incoming materials per HACCP standards',
 ARRAY['Delivery documents', 'Quality specs', 'Inspection criteria'],
 ARRAY['Approved materials', 'Rejection records', 'Lot tracking data']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-03', 'Warehouse Management', 'primary', 1,
 'Managing storage, inventory rotation (FIFO), and cold chain compliance',
 ARRAY['Inventory data', 'Storage requirements', 'Temperature logs'],
 ARRAY['Material releases', 'Stock reports', 'Expiry tracking']),

-- 2. Operations (Production)
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-04', 'Production Planning', 'primary', 2,
 'Planning production schedules, batch sizes, and resource allocation',
 ARRAY['Sales forecasts', 'Inventory levels', 'Production capacity'],
 ARRAY['Production schedules', 'Work orders', 'Material requirements']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-05', 'Food Processing', 'primary', 2,
 'Core manufacturing processes including mixing, cooking, forming, and packaging',
 ARRAY['Raw materials', 'Recipes/formulations', 'Equipment setup'],
 ARRAY['Semi-finished goods', 'Process records', 'Batch documentation']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-06', 'Quality Control Testing', 'primary', 2,
 'In-process and finished product testing per food safety standards',
 ARRAY['Samples', 'Test protocols', 'Specifications'],
 ARRAY['Test results', 'Release decisions', 'Non-conformance reports']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-07', 'Packaging & Labeling', 'primary', 2,
 'Final packaging, labeling with nutritional info, and date coding',
 ARRAY['Finished products', 'Packaging materials', 'Label templates'],
 ARRAY['Packaged products', 'Lot codes', 'Traceability records']),

-- 3. Outbound Logistics
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-08', 'Finished Goods Storage', 'primary', 3,
 'Storing finished products in appropriate conditions (cold chain)',
 ARRAY['Packaged products', 'Storage requirements', 'Release status'],
 ARRAY['Available inventory', 'Storage reports', 'Temperature logs']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-09', 'Order Fulfillment', 'primary', 3,
 'Picking, packing, and shipping customer orders',
 ARRAY['Customer orders', 'Inventory availability', 'Shipping requirements'],
 ARRAY['Shipped orders', 'Delivery documentation', 'Tracking data']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-10', 'Distribution Management', 'primary', 3,
 'Managing logistics, cold chain transport, and delivery schedules',
 ARRAY['Delivery schedules', 'Carrier contracts', 'Temperature requirements'],
 ARRAY['Deliveries completed', 'POD documents', 'Transport logs']),

-- 4. Marketing & Sales
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-11', 'Product Marketing', 'primary', 4,
 'Marketing food products through various channels and campaigns',
 ARRAY['Product portfolio', 'Market research', 'Brand guidelines'],
 ARRAY['Marketing campaigns', 'Brand materials', 'Promotional activities']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-12', 'Sales & Key Accounts', 'primary', 4,
 'Managing sales to retailers, distributors, and food service',
 ARRAY['Customer relationships', 'Pricing policies', 'Sales targets'],
 ARRAY['Sales orders', 'Customer agreements', 'Revenue forecasts']),

-- 5. Service
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-13', 'Customer Service', 'primary', 5,
 'Handling customer inquiries, complaints, and returns',
 ARRAY['Customer contacts', 'Product information', 'Service protocols'],
 ARRAY['Resolved inquiries', 'Complaint records', 'Feedback reports']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-14', 'Product Recall Management', 'primary', 5,
 'Managing product recalls and traceability investigations',
 ARRAY['Recall triggers', 'Traceability data', 'Regulatory requirements'],
 ARRAY['Recall execution', 'Root cause analysis', 'Corrective actions']);

-- SUPPORT ACTIVITIES (value_chain_position 6-9)
INSERT INTO business_processes (prototype_id, process_code, process_name, process_category, value_chain_position, description, typical_inputs, typical_outputs) VALUES
-- 6. Procurement
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-15', 'Supplier Management', 'support', 6,
 'Managing supplier relationships, audits, and certifications',
 ARRAY['Supplier profiles', 'Audit requirements', 'Certification needs'],
 ARRAY['Approved supplier list', 'Audit reports', 'Supplier scorecards']),

-- 7. Technology Development
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-16', 'Product Development', 'support', 7,
 'Developing new products and reformulating existing ones',
 ARRAY['Consumer insights', 'Ingredient options', 'Regulatory requirements'],
 ARRAY['New product specs', 'Prototypes', 'Nutritional data']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-17', 'Process Engineering', 'support', 7,
 'Improving manufacturing processes and equipment efficiency',
 ARRAY['Process data', 'Equipment specs', 'Improvement targets'],
 ARRAY['Process improvements', 'Equipment upgrades', 'Efficiency gains']),

-- 8. Human Resource Management
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-18', 'Workforce Management', 'support', 8,
 'Managing production workforce, training, and certifications',
 ARRAY['Staffing plans', 'Training requirements', 'Shift schedules'],
 ARRAY['Trained workforce', 'Certifications', 'Attendance records']),

-- 9. Firm Infrastructure
('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-19', 'Food Safety Management', 'support', 9,
 'Managing HACCP, FSSC 22000, and food safety systems',
 ARRAY['Hazard analysis', 'Control points', 'Regulatory requirements'],
 ARRAY['HACCP plans', 'Safety audits', 'Certification maintenance']),

('04a8ff6a-09ea-40dc-824c-42533a55e975', 'BP-FOOD-20', 'Regulatory Compliance', 'support', 9,
 'Ensuring compliance with food regulations (FDA, EFSA, local)',
 ARRAY['Regulatory updates', 'Product specifications', 'Label requirements'],
 ARRAY['Compliance reports', 'Regulatory filings', 'Label approvals']);

-- ============================================================================
-- 2. PROCESS COST CENTERS
-- ============================================================================

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-PROC', 'Procurement', 'direct', 'Raw material and ingredient procurement'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-01', 'BP-FOOD-15');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-WH', 'Warehouse', 'direct', 'Raw material and finished goods storage'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-02', 'BP-FOOD-03', 'BP-FOOD-08');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-PROD', 'Production', 'direct', 'Food manufacturing and processing'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-04', 'BP-FOOD-05', 'BP-FOOD-07');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-QA', 'Quality Assurance', 'direct', 'Quality control and testing'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-06', 'BP-FOOD-19');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-LOG', 'Logistics', 'direct', 'Distribution and logistics'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-09', 'BP-FOOD-10');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-SALES', 'Sales & Marketing', 'indirect', 'Sales and marketing operations'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-11', 'BP-FOOD-12');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-CUST', 'Customer Service', 'indirect', 'Customer service and support'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-13', 'BP-FOOD-14');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-RD', 'R&D', 'indirect', 'Product development and innovation'
FROM business_processes bp WHERE bp.process_code IN ('BP-FOOD-16', 'BP-FOOD-17');

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-HR', 'Human Resources', 'overhead', 'HR operations'
FROM business_processes bp WHERE bp.process_code = 'BP-FOOD-18';

INSERT INTO process_cost_centers (process_id, cost_center_code, cost_center_name, cost_type, description)
SELECT bp.id, 'CC-REG', 'Regulatory Affairs', 'overhead', 'Regulatory compliance'
FROM business_processes bp WHERE bp.process_code = 'BP-FOOD-20';

-- ============================================================================
-- 3. ORG UNIT TASKS
-- ============================================================================

-- DIR-OPS (Operations) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-01', 'Daily Production Planning', 'Review and finalize daily production schedule based on orders and inventory', 'daily', 3, 2.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-02', 'Production Line Monitoring', 'Monitor production line efficiency and address bottlenecks', 'daily', 3, 4.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-03', 'Equipment Maintenance Coordination', 'Coordinate preventive and corrective maintenance activities', 'weekly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-OPS-04', 'Capacity Planning', 'Analyze capacity requirements and plan for seasonal demand', 'monthly', 4, 16.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

-- DIR-QSE (Quality Safety Environment) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-01', 'HACCP Monitoring', 'Monitor Critical Control Points and verify HACCP compliance', 'daily', 4, 4.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-02', 'Quality Testing', 'Conduct microbiological, chemical, and sensory testing', 'daily', 4, 6.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-03', 'Supplier Audits', 'Conduct supplier food safety audits and assessments', 'quarterly', 5, 40.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-04', 'FSSC 22000 Certification Maintenance', 'Maintain food safety management system certification', 'yearly', 5, 120.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-QSE-05', 'Environmental Compliance', 'Monitor and report environmental KPIs (waste, water, energy)', 'monthly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

-- DIR-RD (R&D) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-RD-01', 'New Product Development', 'Develop new food products from concept to launch', 'on_demand', 5, 160.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-RD-02', 'Product Reformulation', 'Reformulate products for cost reduction or health improvements', 'on_demand', 4, 80.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-RD-03', 'Shelf Life Studies', 'Conduct shelf life testing and stability studies', 'monthly', 4, 24.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

-- DIR-COMM (Sales & Marketing) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-01', 'Sales Forecasting', 'Prepare and update sales forecasts by product and channel', 'weekly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-02', 'Key Account Management', 'Manage relationships with major retail and food service accounts', 'weekly', 3, 16.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-COMM-03', 'Trade Promotion Planning', 'Plan and execute trade promotions with retailers', 'monthly', 4, 24.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

-- DIR-AFC (Admin Finance Control) Tasks
INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-01', 'Production Cost Analysis', 'Analyze production costs and variances by product line', 'monthly', 4, 16.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-02', 'Inventory Valuation', 'Calculate and verify inventory valuation (FIFO)', 'monthly', 3, 8.00, false
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

INSERT INTO org_unit_tasks (org_unit_template_id, task_code, task_name, task_description, frequency, complexity_level, estimated_hours, requires_approval)
SELECT id, 'TSK-AFC-03', 'Financial Close', 'Execute month-end financial close and reporting', 'monthly', 4, 40.00, true
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

-- ============================================================================
-- 4. ORG UNIT KPIS
-- ============================================================================

-- DIR-OPS KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-01', 'Overall Equipment Effectiveness (OEE)', 'Production line efficiency combining availability, performance, and quality', '%', 'increase', 85.00, 'MES System', 'Availability * Performance * Quality'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-02', 'Production Yield', 'Percentage of good product from raw materials input', '%', 'increase', 95.00, 'Production System', 'Good Output / Total Input * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-03', 'Schedule Adherence', 'Percentage of production orders completed on time', '%', 'increase', 95.00, 'ERP System', 'On-Time Orders / Total Orders * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-OPS-04', 'Unplanned Downtime', 'Hours of unplanned equipment downtime per month', 'hours', 'decrease', 20.00, 'CMMS', 'Sum of unplanned downtime hours'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS';

-- DIR-QSE KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-01', 'First Pass Yield', 'Percentage of production passing quality on first inspection', '%', 'increase', 98.00, 'QMS', 'Passed Units / Total Inspected * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-02', 'Customer Complaints per Million Units', 'Rate of customer complaints per million units sold', 'ppm', 'decrease', 10.00, 'CRM System', 'Complaints / Units Sold * 1,000,000'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-03', 'Food Safety Audit Score', 'Average score from food safety audits (internal and external)', 'score', 'increase', 95.00, 'QMS', 'Audit Score'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-04', 'CCP Deviations', 'Number of Critical Control Point deviations per month', 'count', 'decrease', 0.00, 'HACCP Monitoring', 'Count of CCP deviations'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-QSE-05', 'Waste Reduction', 'Food waste as percentage of total production', '%', 'decrease', 2.00, 'Production System', 'Food Waste / Total Production * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE';

-- DIR-RD KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-RD-01', 'New Product Launch Rate', 'Number of new products launched per year', 'count', 'increase', 12.00, 'R&D System', 'Count of new product launches'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-RD-02', 'Time to Market', 'Average months from concept to launch', 'months', 'decrease', 8.00, 'R&D System', 'Average development time'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-RD-03', 'Revenue from New Products', 'Percentage of revenue from products launched in last 3 years', '%', 'increase', 25.00, 'Finance System', 'New Product Revenue / Total Revenue * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD';

-- DIR-COMM KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-01', 'Revenue Growth', 'Year-over-year revenue growth', '%', 'increase', 8.00, 'Finance System', '(Current Revenue - Previous Revenue) / Previous Revenue * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-02', 'Market Share', 'Company market share in target segments', '%', 'increase', 15.00, 'Market Research', 'Company Sales / Total Market Sales * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-COMM-03', 'Distribution Coverage', 'Percentage of target outlets carrying products', '%', 'increase', 85.00, 'Sales System', 'Active Outlets / Target Outlets * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM';

-- DIR-AFC KPIs
INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-01', 'Gross Margin', 'Gross profit as percentage of revenue', '%', 'increase', 35.00, 'Finance System', '(Revenue - COGS) / Revenue * 100'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-02', 'Inventory Turnover', 'Number of times inventory is sold and replaced', 'turns', 'increase', 12.00, 'ERP System', 'COGS / Average Inventory'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

INSERT INTO org_unit_kpis (org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit, target_direction, benchmark_value, data_source, calculation_formula)
SELECT id, 'KPI-AFC-03', 'Days Sales Outstanding', 'Average days to collect receivables', 'days', 'decrease', 45.00, 'Finance System', 'Accounts Receivable / (Revenue / 365)'
FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC';

-- ============================================================================
-- 5. PROTOTYPE STAFFING RULES (Medium Food Manufacturing)
-- ============================================================================

-- CEO Level
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'One CEO required for executive leadership'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'CEO' AND jt.job_code = 'CEO-EXEC';

-- Director Level - OPS (Operations/Production)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'Operations Director required for production management'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-OPS' AND jt.job_code = 'DIR-OPS-DIR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 0, 1, 1, false, 'Deputy Operations Director recommended for medium plants'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-OPS' AND jt.job_code = 'DIR-OPS-VDIR';

-- Director Level - QSE (Quality/Food Safety)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'Quality Director required for food safety compliance'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-QSE' AND jt.job_code = 'DIR-QSE-DIR';

-- Director Level - RD (R&D/Product Development)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'R&D Director required for product innovation'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-RD' AND jt.job_code = 'DIR-RD-DIR';

-- Director Level - COMM (Sales/Marketing)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'Commercial Director required for sales and marketing'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-COMM' AND jt.job_code = 'DIR-COMM-DIR';

-- Director Level - AFC (Finance)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'Finance Director required for financial control'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-AFC' AND jt.job_code = 'DIR-AFC-DIR';

-- Director Level - HR
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'HR Director required for workforce management'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DIR-HR' AND jt.job_code = 'DIR-HR-DIR';

-- Department Level - OPS (Production Managers)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Production department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-OPS-1' AND jt.job_code = 'DEPT-OPS-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 4, 10, 6, true, 'Production supervisors/shift leaders for 3-shift operations'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-OPS-1' AND jt.job_code = 'DEPT-OPS-1-SMGR';

-- Department Level - QSE (Quality Managers)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Quality department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-QSE-1' AND jt.job_code = 'DEPT-QSE-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 3, 8, 5, true, 'Quality supervisors and food safety specialists'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-QSE-1' AND jt.job_code = 'DEPT-QSE-1-SMGR';

-- Department Level - RD (R&D Managers)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 1, 1, true, 'R&D department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-RD-1' AND jt.job_code = 'DEPT-RD-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 2, 6, 4, true, 'Food technologists and product developers'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-RD-1' AND jt.job_code = 'DEPT-RD-1-SMGR';

-- Department Level - COMM (Sales Managers)
INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 1, 2, 1, true, 'Sales department manager required'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-COMM-1' AND jt.job_code = 'DEPT-COMM-1-MGR';

INSERT INTO prototype_staffing_rules (prototype_id, org_unit_template_id, job_template_id, company_size, min_headcount, max_headcount, recommended_headcount, is_mandatory, rationale)
SELECT '04a8ff6a-09ea-40dc-824c-42533a55e975',
       out.id, jt.id, 'medium', 5, 12, 8, true, 'Key account managers and sales representatives'
FROM org_unit_templates out
JOIN job_templates jt ON jt.org_unit_template_id = out.id
WHERE out.template_id = '99679018-33ac-4438-af88-df643f0e3c29'
  AND out.code = 'DEPT-COMM-1' AND jt.job_code = 'DEPT-COMM-1-SMGR';

-- ============================================================================
-- 6. JOB TASK DISTRIBUTION
-- ============================================================================

-- OPS Director - Daily Production Planning
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 30, true, 'Approves daily production schedules'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS')
  AND t.task_code = 'TSK-OPS-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS');

-- OPS Senior Manager - Daily Production Planning
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 70, false, 'Executes daily production planning'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-OPS-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DEPT-OPS-1')
  AND t.task_code = 'TSK-OPS-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS');

-- QSE Director - HACCP Monitoring
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 20, true, 'Oversees HACCP compliance'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE')
  AND t.task_code = 'TSK-QSE-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE');

-- QSE Senior Manager - HACCP Monitoring
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 80, false, 'Executes daily HACCP monitoring'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-QSE-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DEPT-QSE-1')
  AND t.task_code = 'TSK-QSE-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE');

-- RD Director - New Product Development
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 40, true, 'Leads product development strategy'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DIR-RD-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD')
  AND t.task_code = 'TSK-RD-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD');

-- RD Senior Manager - New Product Development
INSERT INTO job_task_distribution (job_template_id, org_unit_task_id, responsibility_percentage, is_primary_owner, notes)
SELECT jt.id, t.id, 60, false, 'Executes product development projects'
FROM job_templates jt
CROSS JOIN org_unit_tasks t
WHERE jt.job_code = 'DEPT-RD-1-SMGR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DEPT-RD-1')
  AND t.task_code = 'TSK-RD-01'
  AND t.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD');

-- ============================================================================
-- 7. JOB KPI DISTRIBUTION
-- ============================================================================

-- OPS Director - OEE
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for production efficiency'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS')
  AND k.kpi_code = 'KPI-OPS-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS');

-- OPS Director - Production Yield
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 30, 'Primary accountability for production yield'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-OPS-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS')
  AND k.kpi_code = 'KPI-OPS-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-OPS');

-- QSE Director - First Pass Yield
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for quality'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE')
  AND k.kpi_code = 'KPI-QSE-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE');

-- QSE Director - Food Safety Audit Score
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for food safety'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-QSE-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE')
  AND k.kpi_code = 'KPI-QSE-03'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-QSE');

-- RD Director - New Product Launch Rate
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for innovation'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-RD-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD')
  AND k.kpi_code = 'KPI-RD-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD');

-- RD Director - Revenue from New Products
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'contributor', 30, 'Contributes to new product revenue'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-RD-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD')
  AND k.kpi_code = 'KPI-RD-03'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-RD');

-- COMM Director - Revenue Growth
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 40, 'Primary accountability for revenue growth'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-COMM-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM')
  AND k.kpi_code = 'KPI-COMM-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM');

-- COMM Director - Market Share
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 30, 'Primary accountability for market share'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-COMM-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM')
  AND k.kpi_code = 'KPI-COMM-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-COMM');

-- AFC Director - Gross Margin
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'owner', 35, 'Primary accountability for profitability'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-AFC-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC')
  AND k.kpi_code = 'KPI-AFC-01'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC');

-- AFC Director - Inventory Turnover
INSERT INTO job_kpi_distribution (job_template_id, org_unit_kpi_id, accountability_level, weight_percentage, notes)
SELECT jt.id, k.id, 'contributor', 25, 'Contributes to inventory management'
FROM job_templates jt
CROSS JOIN org_unit_kpis k
WHERE jt.job_code = 'DIR-AFC-DIR'
  AND jt.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC')
  AND k.kpi_code = 'KPI-AFC-02'
  AND k.org_unit_template_id = (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29' AND code = 'DIR-AFC');

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
    SELECT COUNT(*) INTO bp_count FROM business_processes WHERE prototype_id = '04a8ff6a-09ea-40dc-824c-42533a55e975';
    SELECT COUNT(*) INTO cc_count FROM process_cost_centers WHERE process_id IN (SELECT id FROM business_processes WHERE prototype_id = '04a8ff6a-09ea-40dc-824c-42533a55e975');
    SELECT COUNT(*) INTO task_count FROM org_unit_tasks WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29');
    SELECT COUNT(*) INTO kpi_count FROM org_unit_kpis WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29');
    SELECT COUNT(*) INTO staffing_count FROM prototype_staffing_rules WHERE prototype_id = '04a8ff6a-09ea-40dc-824c-42533a55e975';
    SELECT COUNT(*) INTO task_dist_count FROM job_task_distribution WHERE job_template_id IN (SELECT id FROM job_templates WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29'));
    SELECT COUNT(*) INTO kpi_dist_count FROM job_kpi_distribution WHERE job_template_id IN (SELECT id FROM job_templates WHERE org_unit_template_id IN (SELECT id FROM org_unit_templates WHERE template_id = '99679018-33ac-4438-af88-df643f0e3c29'));

    RAISE NOTICE '=== FOOD MANUFACTURING PROTOTYPE SEED REPORT ===';
    RAISE NOTICE 'Business Processes: %', bp_count;
    RAISE NOTICE 'Process Cost Centers: %', cc_count;
    RAISE NOTICE 'Org Unit Tasks: %', task_count;
    RAISE NOTICE 'Org Unit KPIs: %', kpi_count;
    RAISE NOTICE 'Staffing Rules: %', staffing_count;
    RAISE NOTICE 'Task Distributions: %', task_dist_count;
    RAISE NOTICE 'KPI Distributions: %', kpi_dist_count;
END $$;

COMMIT;
