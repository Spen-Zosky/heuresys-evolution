-- Migration 130: Create analysis_sessions table for Company PET
-- BUG-053: Sessions page fetches /api/v1/analysis-sessions but table did not exist

CREATE TABLE IF NOT EXISTS analysis_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  session_type VARCHAR(50) NOT NULL DEFAULT 'performance',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  parameters JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  findings_count INTEGER DEFAULT 0,
  participants_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analysis_sessions_tenant ON analysis_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON analysis_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_deleted ON analysis_sessions(deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY analysis_sessions_tenant_isolation ON analysis_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Updated_at trigger
CREATE TRIGGER trg_analysis_sessions_updated_at
  BEFORE UPDATE ON analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
