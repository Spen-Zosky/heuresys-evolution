-- Migration: 005_ai_hr_assistant
-- Epic: 5 - AI HR Assistant
-- Stories: 5.1-5.6
-- Description: AI service foundation, RAG pipeline, confidence scoring, escalation

-- =============================================================================
-- PGVECTOR EXTENSION (if available)
-- =============================================================================

-- Try to create the vector extension (may not be available in all PostgreSQL installations)
-- If not available, we'll use a JSONB fallback for embeddings
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RAISE NOTICE 'pgvector extension enabled';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector not available, using JSONB fallback for embeddings';
END $$;

-- =============================================================================
-- DOCUMENT CHUNKS TABLE (for RAG retrieval)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rag_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,

  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64), -- SHA-256 for deduplication

  -- Metadata
  start_char INTEGER,
  end_char INTEGER,
  page_number INTEGER,
  section_title VARCHAR(255),

  -- Embeddings (using JSONB as fallback if pgvector not available)
  embedding_model VARCHAR(100),
  embedding_dimensions INTEGER,
  embedding JSONB, -- Array of floats as JSONB fallback
  -- embedding_vector vector(1536), -- Uncomment if pgvector available

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant ON rag_document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_hash ON rag_document_chunks(content_hash);

ALTER TABLE rag_document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_rag_chunks ON rag_document_chunks;
CREATE POLICY tenant_isolation_rag_chunks ON rag_document_chunks
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- KNOWLEDGE BASE TYPES (for categorizing documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rag_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system-wide

  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  kb_type VARCHAR(50) NOT NULL, -- 'ccnl', 'company_policy', 'faq', 'procedure', 'legal', 'custom'

  -- Access control
  is_public BOOLEAN DEFAULT false,
  allowed_roles TEXT[], -- Array of role names that can access

  -- Configuration
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  chunk_size INTEGER DEFAULT 1000,
  chunk_overlap INTEGER DEFAULT 200,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_kb_tenant ON rag_knowledge_bases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_kb_type ON rag_knowledge_bases(kb_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_kb_code ON rag_knowledge_bases(tenant_id, code) WHERE is_active = true;

-- =============================================================================
-- LINK DOCUMENTS TO KNOWLEDGE BASES
-- =============================================================================

ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES rag_knowledge_bases(id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_kb ON rag_documents(knowledge_base_id);

-- =============================================================================
-- CCNL (Contratti Collettivi Nazionali di Lavoro) REFERENCE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ccnl_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),

  sector VARCHAR(100), -- 'commercio', 'industria', 'terziario', etc.
  effective_date DATE,
  expiry_date DATE,

  -- Key provisions metadata
  min_notice_days JSONB, -- By level/role
  probation_period_days JSONB,
  annual_leave_days INTEGER DEFAULT 26,
  sick_leave_rules JSONB,
  overtime_rates JSONB,

  -- Full text storage
  full_text TEXT,
  full_text_version VARCHAR(50),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccnl_sector ON ccnl_contracts(sector);
CREATE INDEX IF NOT EXISTS idx_ccnl_active ON ccnl_contracts(is_active);

-- =============================================================================
-- AI QUERY CONFIDENCE & ESCALATION
-- =============================================================================

-- Add confidence fields to rag_messages
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,4);
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS confidence_factors JSONB;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS requires_escalation BOOLEAN DEFAULT false;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS escalation_reason VARCHAR(255);
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS escalated_to UUID;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS human_response TEXT;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS human_responded_at TIMESTAMP;
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS feedback_rating INTEGER; -- 1-5
ALTER TABLE rag_messages ADD COLUMN IF NOT EXISTS feedback_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_rag_messages_escalation ON rag_messages(requires_escalation) WHERE requires_escalation = true;

-- =============================================================================
-- ESCALATION QUEUE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_escalation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  message_id UUID NOT NULL REFERENCES rag_messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES rag_sessions(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id), -- The user who asked

  -- Query details
  original_query TEXT NOT NULL,
  ai_response TEXT,
  confidence_score DECIMAL(5,4),

  -- Escalation metadata
  escalation_reason VARCHAR(255) NOT NULL,
  category VARCHAR(50), -- 'legal', 'sensitive', 'low_confidence', 'complex', 'custom'
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

  -- Assignment
  assigned_to UUID REFERENCES employees(id),
  assigned_at TIMESTAMP,

  -- Resolution
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'dismissed'
  human_response TEXT,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES employees(id),
  resolution_notes TEXT,

  -- Learning
  should_train BOOLEAN DEFAULT false, -- Flag to use for model improvement

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_tenant ON ai_escalation_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON ai_escalation_queue(status);
CREATE INDEX IF NOT EXISTS idx_escalation_assigned ON ai_escalation_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalation_priority ON ai_escalation_queue(priority, created_at);

ALTER TABLE ai_escalation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_escalation ON ai_escalation_queue;
CREATE POLICY tenant_isolation_escalation ON ai_escalation_queue
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- AI QUERY AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_query_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  session_id UUID REFERENCES rag_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES rag_messages(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,

  -- Query details
  query_text TEXT NOT NULL,
  query_type VARCHAR(50), -- 'chat', 'search', 'sql', 'document_qa'

  -- Response details
  response_text TEXT,
  response_time_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,

  -- AI provider details
  provider VARCHAR(50),
  model VARCHAR(100),

  -- RAG context
  sources_used JSONB, -- Array of source references
  chunks_retrieved INTEGER,
  retrieval_score DECIMAL(5,4),

  -- Confidence
  confidence_score DECIMAL(5,4),
  was_escalated BOOLEAN DEFAULT false,

  -- Error tracking
  had_error BOOLEAN DEFAULT false,
  error_type VARCHAR(100),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant ON ai_query_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_employee ON ai_query_audit(employee_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_date ON ai_query_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_type ON ai_query_audit(query_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_provider ON ai_query_audit(provider);

ALTER TABLE ai_query_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_audit ON ai_query_audit;
CREATE POLICY tenant_isolation_ai_audit ON ai_query_audit
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- AI ANALYTICS AGGREGATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  -- Volume metrics
  total_queries INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,

  -- Query types
  chat_queries INTEGER DEFAULT 0,
  search_queries INTEGER DEFAULT 0,
  sql_queries INTEGER DEFAULT 0,
  document_qa_queries INTEGER DEFAULT 0,

  -- Performance
  avg_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,

  -- Token usage
  total_tokens_input INTEGER DEFAULT 0,
  total_tokens_output INTEGER DEFAULT 0,

  -- Confidence & escalation
  avg_confidence_score DECIMAL(5,4),
  escalation_count INTEGER DEFAULT 0,
  escalation_resolved_count INTEGER DEFAULT 0,

  -- Feedback
  feedback_count INTEGER DEFAULT 0,
  avg_feedback_rating DECIMAL(3,2),

  -- Top queries (anonymized)
  top_query_categories JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_tenant ON ai_analytics_daily(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analytics_unique ON ai_analytics_daily(tenant_id, date);

ALTER TABLE ai_analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_analytics ON ai_analytics_daily;
CREATE POLICY tenant_isolation_ai_analytics ON ai_analytics_daily
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- AI CONFIGURATION PER TENANT
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  -- Default provider settings
  default_provider VARCHAR(50) DEFAULT 'openai',
  default_chat_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  default_embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',

  -- Feature flags
  enable_sql_generation BOOLEAN DEFAULT false,
  enable_document_qa BOOLEAN DEFAULT true,
  enable_escalation BOOLEAN DEFAULT true,

  -- Confidence thresholds
  confidence_threshold_low DECIMAL(5,4) DEFAULT 0.5000,
  confidence_threshold_escalation DECIMAL(5,4) DEFAULT 0.3000,

  -- Rate limits
  max_queries_per_user_day INTEGER DEFAULT 100,
  max_tokens_per_user_day INTEGER DEFAULT 50000,

  -- System prompts
  system_prompt_base TEXT,
  system_prompt_hr_context TEXT,

  -- Escalation settings
  escalation_email VARCHAR(255),
  escalation_notify_slack BOOLEAN DEFAULT false,
  escalation_slack_webhook TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INSERT DEFAULT KNOWLEDGE BASES
-- =============================================================================

INSERT INTO rag_knowledge_bases (tenant_id, code, name, description, kb_type, is_public)
VALUES
  (NULL, 'ccnl_commercio', 'CCNL Commercio', 'Contratto Collettivo Nazionale Commercio e Terziario', 'ccnl', true),
  (NULL, 'ccnl_industria', 'CCNL Metalmeccanico', 'Contratto Collettivo Nazionale Industria Metalmeccanica', 'ccnl', true),
  (NULL, 'ccnl_turismo', 'CCNL Turismo', 'Contratto Collettivo Nazionale Turismo e Pubblici Esercizi', 'ccnl', true),
  (NULL, 'labor_law_ita', 'Normativa Lavoro Italia', 'Leggi e normative sul lavoro in Italia', 'legal', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- INSERT COMMON CCNL REFERENCES
-- =============================================================================

INSERT INTO ccnl_contracts (code, name, sector, effective_date, annual_leave_days)
VALUES
  ('CCNL_COMM_2024', 'CCNL Commercio e Terziario 2024', 'commercio', '2024-01-01', 26),
  ('CCNL_METMEC_2024', 'CCNL Metalmeccanico Industria 2024', 'industria', '2024-01-01', 26),
  ('CCNL_TUR_2024', 'CCNL Turismo e Pubblici Esercizi 2024', 'turismo', '2024-01-01', 26),
  ('CCNL_CRED_2024', 'CCNL Credito 2024', 'credito', '2024-01-01', 28),
  ('CCNL_TLC_2024', 'CCNL Telecomunicazioni 2024', 'telecomunicazioni', '2024-01-01', 26)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTION: Calculate business days
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_confidence_score(
  p_sources_count INTEGER,
  p_retrieval_score DECIMAL,
  p_response_length INTEGER,
  p_has_citations BOOLEAN
) RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL;
BEGIN
  -- Base score from retrieval
  v_score := COALESCE(p_retrieval_score, 0.5) * 0.4;

  -- Sources boost (more sources = higher confidence)
  v_score := v_score + LEAST(p_sources_count * 0.1, 0.3);

  -- Citation boost
  IF p_has_citations THEN
    v_score := v_score + 0.15;
  END IF;

  -- Response length penalty (too short might be incomplete)
  IF p_response_length < 50 THEN
    v_score := v_score - 0.1;
  END IF;

  RETURN GREATEST(LEAST(v_score, 1.0), 0.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE rag_document_chunks IS 'Document chunks for RAG retrieval with embeddings';
COMMENT ON TABLE rag_knowledge_bases IS 'Knowledge base categories for organizing documents';
COMMENT ON TABLE ccnl_contracts IS 'Italian CCNL reference data for labor law queries';
COMMENT ON TABLE ai_escalation_queue IS 'Queue for AI queries requiring human review';
COMMENT ON TABLE ai_query_audit IS 'Audit log of all AI interactions for analytics';
COMMENT ON TABLE ai_analytics_daily IS 'Daily aggregated AI usage metrics per tenant';
COMMENT ON TABLE ai_tenant_config IS 'Per-tenant AI configuration and thresholds';

