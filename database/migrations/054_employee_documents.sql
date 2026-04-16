-- Migration: 054_employee_documents.sql
-- Description: Employee personal documents management
-- Date: 2025-12-27

-- Employee Documents table (contracts, pay stubs, certificates, etc.)
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Document info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL, -- contract, payslip, certificate, id_document, policy, other
    category VARCHAR(100), -- employment, payroll, benefits, compliance, personal

    -- File info
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    file_path VARCHAR(500) NOT NULL,

    -- Metadata
    document_date DATE, -- Date the document refers to (e.g., payslip month)
    expiry_date DATE, -- For certificates, IDs that expire
    reference_number VARCHAR(100), -- External reference (e.g., contract number)

    -- Access control
    visibility VARCHAR(20) DEFAULT 'private', -- private (employee only), hr (HR can see), public (all managers)
    requires_signature BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP,
    signed_by UUID REFERENCES employees(id),

    -- Upload info
    uploaded_by UUID REFERENCES employees(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, archived, pending_review
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES employees(id),
    verified_at TIMESTAMP,

    -- Version control
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES employee_documents(id),
    is_latest BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT unique_latest_version UNIQUE (parent_document_id, is_latest)
        DEFERRABLE INITIALLY DEFERRED
);

-- Document requests (employee requests HR for documents)
CREATE TABLE IF NOT EXISTS document_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Request details
    document_type VARCHAR(50) NOT NULL, -- employment_certificate, income_certificate, reference_letter, etc.
    purpose TEXT,
    additional_notes TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, rejected
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent

    -- Processing
    assigned_to UUID REFERENCES employees(id),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    rejection_reason TEXT,

    -- Result
    result_document_id UUID REFERENCES employee_documents(id),

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document acknowledgments (employee confirms reading policy docs)
CREATE TABLE IF NOT EXISTS document_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES employee_documents(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,

    UNIQUE(document_id, employee_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_documents_tenant ON employee_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_category ON employee_documents(category);
CREATE INDEX IF NOT EXISTS idx_employee_documents_status ON employee_documents(status);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_requests_tenant ON document_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_employee ON document_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_assigned ON document_requests(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_acknowledgments_document ON document_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_acknowledgments_employee ON document_acknowledgments(employee_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_employee_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employee_documents_updated ON employee_documents;
CREATE TRIGGER trigger_employee_documents_updated
    BEFORE UPDATE ON employee_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_documents_timestamp();

DROP TRIGGER IF EXISTS trigger_document_requests_updated ON document_requests;
CREATE TRIGGER trigger_document_requests_updated
    BEFORE UPDATE ON document_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_documents_timestamp();

-- Comments
COMMENT ON TABLE employee_documents IS 'Employee personal documents (contracts, payslips, certificates)';
COMMENT ON TABLE document_requests IS 'Employee requests for HR-generated documents';
COMMENT ON TABLE document_acknowledgments IS 'Employee acknowledgment of policy documents';
