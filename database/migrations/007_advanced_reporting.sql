-- =============================================================================
-- Epic 7: Advanced Reporting & Analytics
-- Database Migration
-- =============================================================================

-- =============================================================================
-- DASHBOARD WIDGETS
-- =============================================================================

-- Dashboard configurations per user/tenant
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  owner_id UUID REFERENCES employees(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  layout JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  shared_with_roles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id);
CREATE INDEX idx_dashboards_owner ON dashboards(owner_id);

-- Dashboard widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL, -- kpi, chart, table, metric, list
  title VARCHAR(200),
  data_source VARCHAR(100) NOT NULL, -- employees, goals, performance, etc.
  query_config JSONB NOT NULL DEFAULT '{}', -- filters, grouping, aggregations
  display_config JSONB NOT NULL DEFAULT '{}', -- chart type, colors, labels
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 3,
  refresh_interval INTEGER, -- seconds, NULL = no auto refresh
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_widgets_tenant ON dashboard_widgets(tenant_id);

-- Widget templates (reusable widget configurations)
CREATE TABLE IF NOT EXISTS widget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  widget_type VARCHAR(50) NOT NULL,
  data_source VARCHAR(100) NOT NULL,
  query_config JSONB NOT NULL DEFAULT '{}',
  display_config JSONB NOT NULL DEFAULT '{}',
  default_width INTEGER DEFAULT 4,
  default_height INTEGER DEFAULT 3,
  category VARCHAR(50), -- hr, performance, recruitment, etc.
  is_system BOOLEAN DEFAULT false, -- true = global template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_widget_templates_code ON widget_templates(tenant_id, code) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_widget_templates_category ON widget_templates(category);

-- =============================================================================
-- REPORT SUBSCRIPTIONS
-- =============================================================================

-- Report subscriptions (extends report_schedules)
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  report_id UUID REFERENCES report_definitions(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  delivery_method VARCHAR(20) DEFAULT 'email', -- email, download, notification
  format VARCHAR(20) DEFAULT 'excel', -- excel, pdf, csv, json
  filters JSONB DEFAULT '{}', -- subscriber-specific filters
  schedule_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, on_demand
  schedule_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_delivered_at TIMESTAMPTZ,
  delivery_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON report_subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_subscriber ON report_subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_report ON report_subscriptions(report_id);

-- Delivery log for subscriptions
CREATE TABLE IF NOT EXISTS report_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  subscription_id UUID REFERENCES report_subscriptions(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES report_executions(id),
  delivery_method VARCHAR(20),
  recipient VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, bounced
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_log_subscription ON report_delivery_log(subscription_id);
CREATE INDEX idx_delivery_log_status ON report_delivery_log(status);

-- =============================================================================
-- DATA EXPORT CONFIGURATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS export_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  data_source VARCHAR(100) NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]', -- column selection and mapping
  filters JSONB DEFAULT '{}',
  format VARCHAR(20) DEFAULT 'csv', -- csv, excel, json, xml
  delimiter VARCHAR(5) DEFAULT ',',
  include_headers BOOLEAN DEFAULT true,
  date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
  encoding VARCHAR(20) DEFAULT 'UTF-8',
  compression VARCHAR(10), -- gzip, zip, none
  is_template BOOLEAN DEFAULT false,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_export_configs_tenant ON export_configurations(tenant_id);

-- Export jobs (tracking export operations)
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  config_id UUID REFERENCES export_configurations(id),
  triggered_by UUID REFERENCES employees(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  row_count INTEGER,
  file_size BIGINT,
  file_path TEXT,
  file_url TEXT,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_export_jobs_tenant ON export_jobs(tenant_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);

-- =============================================================================
-- REAL-TIME ANALYTICS
-- =============================================================================

-- Analytics events (for real-time dashboards)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50), -- employee, goal, review, etc.
  entity_id UUID,
  actor_id UUID REFERENCES employees(id),
  event_data JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_tenant ON analytics_events(tenant_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_entity ON analytics_events(entity_type, entity_id);
CREATE INDEX idx_analytics_events_occurred ON analytics_events(occurred_at);

-- Analytics aggregations (pre-computed metrics)
CREATE TABLE IF NOT EXISTS analytics_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  metric_name VARCHAR(100) NOT NULL,
  dimension VARCHAR(100), -- department, location, time, etc.
  dimension_value VARCHAR(255),
  period_type VARCHAR(20) NOT NULL, -- hourly, daily, weekly, monthly, yearly
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  value_sum DECIMAL(20,4),
  value_count INTEGER,
  value_avg DECIMAL(20,4),
  value_min DECIMAL(20,4),
  value_max DECIMAL(20,4),
  metadata JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aggregations_tenant_metric ON analytics_aggregations(tenant_id, metric_name);
CREATE INDEX idx_aggregations_period ON analytics_aggregations(period_type, period_start);
CREATE UNIQUE INDEX idx_aggregations_unique ON analytics_aggregations(
  tenant_id, metric_name, dimension, dimension_value, period_type, period_start
);

-- =============================================================================
-- PREDICTIVE ANALYTICS
-- =============================================================================

-- ML Model registry
CREATE TABLE IF NOT EXISTS predictive_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(200) NOT NULL,
  model_type VARCHAR(100) NOT NULL, -- turnover_risk, performance_prediction, salary_optimization
  description TEXT,
  algorithm VARCHAR(100), -- linear_regression, random_forest, xgboost, etc.
  features JSONB NOT NULL DEFAULT '[]', -- input features
  target_variable VARCHAR(100),
  hyperparameters JSONB DEFAULT '{}',
  training_config JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft', -- draft, training, trained, deployed, archived
  accuracy_metrics JSONB DEFAULT '{}', -- accuracy, precision, recall, f1, etc.
  last_trained_at TIMESTAMPTZ,
  last_predicted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictive_models_tenant ON predictive_models(tenant_id);
CREATE INDEX idx_predictive_models_type ON predictive_models(model_type);

-- Model predictions
CREATE TABLE IF NOT EXISTS model_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  model_id UUID REFERENCES predictive_models(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- employee, department, goal
  entity_id UUID NOT NULL,
  prediction_value DECIMAL(20,4),
  prediction_label VARCHAR(100),
  confidence_score DECIMAL(5,4),
  prediction_details JSONB DEFAULT '{}',
  feature_importance JSONB DEFAULT '{}',
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_model ON model_predictions(model_id);
CREATE INDEX idx_predictions_entity ON model_predictions(tenant_id, entity_type, entity_id);
CREATE INDEX idx_predictions_created ON model_predictions(created_at);

-- Turnover risk scores (specialized predictions)
CREATE TABLE IF NOT EXISTS turnover_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  risk_score DECIMAL(5,4) NOT NULL, -- 0.0 to 1.0
  risk_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
  risk_factors JSONB DEFAULT '[]', -- contributing factors
  recommended_actions JSONB DEFAULT '[]',
  model_version INTEGER,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_turnover_risk_tenant ON turnover_risk_scores(tenant_id);
CREATE INDEX idx_turnover_risk_employee ON turnover_risk_scores(employee_id);
CREATE INDEX idx_turnover_risk_level ON turnover_risk_scores(risk_level) WHERE is_current = true;

-- Performance predictions
CREATE TABLE IF NOT EXISTS performance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  prediction_period VARCHAR(20) NOT NULL, -- Q1_2025, H1_2025, 2025
  predicted_rating DECIMAL(3,2),
  confidence_interval_low DECIMAL(3,2),
  confidence_interval_high DECIMAL(3,2),
  influencing_factors JSONB DEFAULT '[]',
  improvement_suggestions JSONB DEFAULT '[]',
  model_version INTEGER,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perf_predictions_tenant ON performance_predictions(tenant_id);
CREATE INDEX idx_perf_predictions_employee ON performance_predictions(employee_id);

-- =============================================================================
-- REPORT BUILDER ENHANCEMENTS
-- =============================================================================

-- Add new columns to report_definitions if not exist
DO $$
BEGIN
  -- Add calculated_fields column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'calculated_fields'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN calculated_fields JSONB DEFAULT '[]';
  END IF;

  -- Add joins column for multi-table reports
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'joins'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN joins JSONB DEFAULT '[]';
  END IF;

  -- Add parameters column for parameterized reports
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'parameters'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN parameters JSONB DEFAULT '[]';
  END IF;

  -- Add drill_down_config for drill-down reports
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'drill_down_config'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN drill_down_config JSONB;
  END IF;

  -- Add access_control for fine-grained permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'access_control'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN access_control JSONB DEFAULT '{"roles": [], "users": []}';
  END IF;
END $$;

-- =============================================================================
-- INSERT DEFAULT WIDGET TEMPLATES
-- =============================================================================

INSERT INTO widget_templates (tenant_id, code, name, description, widget_type, data_source, query_config, display_config, default_width, default_height, category, is_system)
VALUES
  -- HR Overview Widgets
  (NULL, 'headcount_total', 'Total Headcount', 'Current total employee count', 'kpi', 'employees',
   '{"aggregation": "count", "filters": {"status": "active"}}',
   '{"format": "number", "icon": "users", "trend": true}',
   2, 2, 'hr', true),

  (NULL, 'headcount_by_department', 'Headcount by Department', 'Employee distribution by department', 'chart', 'employees',
   '{"aggregation": "count", "groupBy": "department_id", "filters": {"status": "active"}}',
   '{"chartType": "pie", "showLegend": true}',
   4, 4, 'hr', true),

  (NULL, 'headcount_by_location', 'Headcount by Location', 'Employee distribution by location', 'chart', 'employees',
   '{"aggregation": "count", "groupBy": "location_id", "filters": {"status": "active"}}',
   '{"chartType": "bar", "horizontal": true}',
   4, 4, 'hr', true),

  (NULL, 'turnover_rate', 'Turnover Rate', 'Monthly turnover percentage', 'kpi', 'employees',
   '{"metric": "turnover_rate", "period": "monthly"}',
   '{"format": "percentage", "icon": "trending-down", "trend": true, "invertTrend": true}',
   2, 2, 'hr', true),

  (NULL, 'new_hires_trend', 'New Hires Trend', 'New hires over time', 'chart', 'employees',
   '{"aggregation": "count", "groupBy": "month", "filters": {"is_new_hire": true}}',
   '{"chartType": "line", "showArea": true}',
   4, 3, 'hr', true),

  -- Performance Widgets
  (NULL, 'avg_performance_rating', 'Average Performance Rating', 'Company-wide performance average', 'kpi', 'performance_reviews',
   '{"aggregation": "avg", "field": "overall_rating"}',
   '{"format": "decimal", "icon": "star", "decimals": 2}',
   2, 2, 'performance', true),

  (NULL, 'performance_distribution', 'Performance Distribution', 'Rating distribution across employees', 'chart', 'performance_reviews',
   '{"aggregation": "count", "groupBy": "rating_category"}',
   '{"chartType": "bar", "colors": ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"]}',
   4, 4, 'performance', true),

  (NULL, 'goal_completion_rate', 'Goal Completion Rate', 'Percentage of completed goals', 'kpi', 'goals',
   '{"metric": "completion_rate"}',
   '{"format": "percentage", "icon": "target", "trend": true}',
   2, 2, 'performance', true),

  (NULL, 'goals_by_status', 'Goals by Status', 'Goal status breakdown', 'chart', 'goals',
   '{"aggregation": "count", "groupBy": "status"}',
   '{"chartType": "donut", "colors": ["#10b981", "#3b82f6", "#f59e0b", "#6b7280"]}',
   3, 3, 'performance', true),

  -- Recruitment Widgets
  (NULL, 'open_positions', 'Open Positions', 'Current open requisitions', 'kpi', 'requisitions',
   '{"aggregation": "count", "filters": {"status": "open"}}',
   '{"format": "number", "icon": "briefcase"}',
   2, 2, 'recruitment', true),

  (NULL, 'candidates_pipeline', 'Candidates Pipeline', 'Candidates by stage', 'chart', 'candidates',
   '{"aggregation": "count", "groupBy": "stage"}',
   '{"chartType": "funnel"}',
   4, 4, 'recruitment', true),

  (NULL, 'time_to_hire', 'Average Time to Hire', 'Days from posting to hire', 'kpi', 'requisitions',
   '{"aggregation": "avg", "field": "days_to_fill", "filters": {"status": "filled"}}',
   '{"format": "number", "suffix": " days", "icon": "clock"}',
   2, 2, 'recruitment', true),

  -- Learning Widgets
  (NULL, 'training_completion', 'Training Completion Rate', 'Course completion percentage', 'kpi', 'enrollments',
   '{"metric": "completion_rate"}',
   '{"format": "percentage", "icon": "graduation-cap"}',
   2, 2, 'learning', true),

  (NULL, 'popular_courses', 'Most Popular Courses', 'Top courses by enrollment', 'table', 'courses',
   '{"aggregation": "count", "groupBy": "course_id", "orderBy": "count", "limit": 5}',
   '{"columns": ["name", "enrollments"]}',
   4, 3, 'learning', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnover_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_predictions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (tenant isolation)
CREATE POLICY tenant_isolation_dashboards ON dashboards
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_widgets ON dashboard_widgets
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_widget_templates ON widget_templates
  FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_subscriptions ON report_subscriptions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_delivery_log ON report_delivery_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_export_configs ON export_configurations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_export_jobs ON export_jobs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_analytics_events ON analytics_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_aggregations ON analytics_aggregations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_predictive_models ON predictive_models
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_predictions ON model_predictions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_turnover_risk ON turnover_risk_scores
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_perf_predictions ON performance_predictions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE dashboards IS 'User/tenant dashboard configurations';
COMMENT ON TABLE dashboard_widgets IS 'Individual widgets within dashboards';
COMMENT ON TABLE widget_templates IS 'Reusable widget templates (system and tenant-specific)';
COMMENT ON TABLE report_subscriptions IS 'User subscriptions to scheduled reports';
COMMENT ON TABLE report_delivery_log IS 'Log of report deliveries';
COMMENT ON TABLE export_configurations IS 'Data export configurations';
COMMENT ON TABLE export_jobs IS 'Data export job tracking';
COMMENT ON TABLE analytics_events IS 'Real-time analytics events';
COMMENT ON TABLE analytics_aggregations IS 'Pre-computed analytics aggregations';
COMMENT ON TABLE predictive_models IS 'ML model registry for predictive analytics';
COMMENT ON TABLE model_predictions IS 'Model predictions storage';
COMMENT ON TABLE turnover_risk_scores IS 'Employee turnover risk assessments';
COMMENT ON TABLE performance_predictions IS 'Performance prediction scores';
