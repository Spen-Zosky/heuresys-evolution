import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import { validate } from '../middleware/validate.js';
import { createDocumentSchema, createDocumentRequestSchema } from '../schemas/hr-operations.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Helper to get employee ID from user
async function getEmployeeId(
  dbClient: PoolClient,
  userId: string,
  tenantId: string
): Promise<string | null> {
  const result = await dbClient.query(
    `SELECT e.id FROM employees e
     JOIN users u ON u.employee_id = e.id
     WHERE u.id = $1 AND e.tenant_id = $2`,
    [userId, tenantId]
  );
  return result.rows[0]?.id || null;
}

// GET /employee-documents - Get employee's documents
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const userRole = (req as AuthenticatedRequest).user?.role;
    const queryEmployeeId = req.query.employee_id as string | undefined;

    let employeeId: string | null;
    if (queryEmployeeId && ['SUPERUSER', 'TENANT_OWNER', 'HR'].includes(userRole)) {
      employeeId = queryEmployeeId;
    } else {
      employeeId = await getEmployeeId(dbClient, userId, tenantId);
    }
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const {
      category,
      document_type,
      status = 'active',
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
    SELECT d.*,
           e_up.first_name || ' ' || e_up.last_name as uploaded_by_name
    FROM employee_documents d
    LEFT JOIN employees e_up ON e_up.id = d.uploaded_by
    LEFT JOIN users u ON u.employee_id = e_up.id
    WHERE d.employee_id = $1 AND d.tenant_id = $2 AND d.is_latest = TRUE
  `;
    const params: (string | number)[] = [employeeId, tenantId];
    let paramIndex = 3;

    if (status && status !== 'all') {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (category) {
      query += ` AND d.category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (document_type) {
      query += ` AND d.document_type = $${paramIndex}`;
      params.push(document_type as string);
      paramIndex++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await dbClient.query(query, params);

    // Get counts by category
    const statsResult = await dbClient.query(
      `SELECT
       category,
       COUNT(*) as count
     FROM employee_documents
     WHERE employee_id = $1 AND tenant_id = $2 AND status = 'active' AND is_latest = TRUE
     GROUP BY category`,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: {
        documents: result.rows,
        stats: statsResult.rows,
        meta: {
          total: safeParseInt(offset as string, { fallback: 0 }) + result.rows.length,
          limit: safeParseInt(limit as string, { fallback: 50 }),
          offset: safeParseInt(offset as string, { fallback: 0 }),
          hasMore: result.rows.length === safeParseInt(limit as string, { fallback: 50 }),
        },
      },
    });
  })
);

// GET /employee-documents/categories - Get document categories with counts
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const result = await dbClient.query(
      `SELECT
       category,
       COUNT(*) as count,
       MAX(created_at) as latest_upload
     FROM employee_documents
     WHERE employee_id = $1 AND tenant_id = $2 AND status = 'active' AND is_latest = TRUE
     GROUP BY category
     ORDER BY category`,
      [employeeId, tenantId]
    );

    const categories = [
      {
        id: 'employment',
        name: 'Employment',
        icon: 'briefcase',
        description: 'Contracts, offer letters',
      },
      { id: 'payroll', name: 'Payroll', icon: 'banknote', description: 'Pay stubs, tax documents' },
      { id: 'benefits', name: 'Benefits', icon: 'heart', description: 'Insurance, retirement' },
      {
        id: 'compliance',
        name: 'Compliance',
        icon: 'shield',
        description: 'Training certificates, policies',
      },
      { id: 'personal', name: 'Personal', icon: 'user', description: 'ID documents, photos' },
    ];

    const categoriesWithCounts = categories.map((cat) => {
      const dbCat = result.rows.find((r: any) => r.category === cat.id);
      return {
        ...cat,
        count: dbCat ? parseInt(dbCat.count) : 0,
        latest_upload: dbCat?.latest_upload || null,
      };
    });

    res.json({ success: true, data: categoriesWithCounts });
  })
);

// GET /employee-documents/:id - Get document details
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const result = await dbClient.query(
      `SELECT d.*,
            e_up.first_name || ' ' || e_up.last_name as uploaded_by_name,
            v.first_name || ' ' || v.last_name as verified_by_name
     FROM employee_documents d
     LEFT JOIN employees e_up ON e_up.id = d.uploaded_by
     LEFT JOIN users u ON u.employee_id = e_up.id
     LEFT JOIN employees e_v ON e_v.id = d.verified_by
     LEFT JOIN users v ON v.employee_id = e_v.id
     WHERE d.id = $1 AND d.employee_id = $2 AND d.tenant_id = $3`,
      [id, employeeId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Document', id);
    }

    // Get version history
    const versionsResult = await dbClient.query(
      `SELECT id, version, filename, file_size, created_at
     FROM employee_documents
     WHERE (parent_document_id = $1 OR id = $1)
     ORDER BY version DESC`,
      [result.rows[0]?.parent_document_id || id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        versions: versionsResult.rows,
      },
    });
  })
);

// GET /employee-documents/expiring - Get documents expiring soon
router.get(
  '/expiring/list',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { days = '30' } = req.query as Record<string, string>;

    const result = await dbClient.query(
      `SELECT id, title, document_type, category, expiry_date,
            EXTRACT(DAY FROM expiry_date - CURRENT_DATE) as days_until_expiry
     FROM employee_documents
     WHERE employee_id = $1 AND tenant_id = $2
       AND status = 'active' AND is_latest = TRUE
       AND expiry_date IS NOT NULL
       AND expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $3
     ORDER BY expiry_date ASC`,
      [employeeId, tenantId, parseInt(days as string)]
    );

    res.json({ success: true, data: result.rows });
  })
);

// POST /employee-documents - Upload document (metadata only, file upload handled separately)
router.post(
  '/',
  validate(createDocumentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const {
      title,
      description,
      document_type,
      category,
      filename,
      original_name,
      mime_type,
      file_size,
      file_path,
      document_date,
      expiry_date,
      reference_number,
    } = req.body;

    if (!title || !document_type || !filename || !original_name || !mime_type || !file_path) {
      throw Errors.badRequest(
        'title, document_type, filename, original_name, mime_type, and file_path are required'
      );
    }

    // Path traversal protection
    if (file_path.includes('..') || file_path.startsWith('/')) {
      throw Errors.badRequest('Invalid file path');
    }

    const result = await dbClient.query(
      `INSERT INTO employee_documents (
      tenant_id, employee_id, title, description, document_type, category,
      filename, original_name, mime_type, file_size, file_path,
      document_date, expiry_date, reference_number, uploaded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
      [
        tenantId,
        employeeId,
        title,
        description,
        document_type,
        category || 'personal',
        filename,
        original_name,
        mime_type,
        file_size,
        file_path,
        document_date,
        expiry_date,
        reference_number,
        employeeId,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

// DELETE /employee-documents/:id - Archive document
router.delete(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    await dbClient.query(
      `UPDATE employee_documents SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND employee_id = $2 AND tenant_id = $3`,
      [id, employeeId, tenantId]
    );

    res.json({ success: true });
  })
);

// === Document Requests ===

// GET /employee-documents/requests - Get my document requests
router.get(
  '/requests/list',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { status } = req.query as Record<string, string>;

    let query = `
    SELECT dr.*,
           u.first_name || ' ' || u.last_name as assigned_to_name
    FROM document_requests dr
    LEFT JOIN employees e ON e.id = dr.assigned_to
    LEFT JOIN users u ON u.employee_id = e.id
    WHERE dr.employee_id = $1 AND dr.tenant_id = $2
  `;
    const params: (string | number)[] = [employeeId, tenantId];

    if (status) {
      query += ` AND dr.status = $3`;
      params.push(status as string);
    }

    query += ` ORDER BY dr.created_at DESC LIMIT 200`;

    const result = await dbClient.query(query, params);

    res.json({ success: true, data: result.rows });
  })
);

// POST /employee-documents/requests - Create document request
router.post(
  '/requests',
  validate(createDocumentRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const tenantId = getTenantIdOrThrow(req);

    if (!userId || !tenantId) {
      throw Errors.unauthorized('Unauthorized');
    }

    const employeeId = await getEmployeeId(dbClient, userId, tenantId);
    if (!employeeId) {
      throw Errors.notFound('Employee');
    }

    const { document_type, purpose, additional_notes, priority = 'normal' } = req.body;

    if (!document_type) {
      throw Errors.badRequest('document_type is required');
    }

    const result = await dbClient.query(
      `INSERT INTO document_requests (
        tenant_id, employee_id, document_type, purpose, additional_notes, priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, employeeId, document_type, purpose, additional_notes, priority]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

// GET /employee-documents/request-types - Get available request types
router.get('/request-types/list', async (_req: Request, res: Response) => {
  const requestTypes = [
    {
      id: 'employment_certificate',
      name: 'Employment Certificate',
      description: 'Proof of employment',
      processing_days: 3,
    },
    {
      id: 'income_certificate',
      name: 'Income Certificate',
      description: 'Salary/income verification',
      processing_days: 5,
    },
    {
      id: 'reference_letter',
      name: 'Reference Letter',
      description: 'Professional reference',
      processing_days: 7,
    },
    {
      id: 'tax_document',
      name: 'Tax Document',
      description: 'Tax-related documentation',
      processing_days: 5,
    },
    {
      id: 'benefits_statement',
      name: 'Benefits Statement',
      description: 'Summary of benefits',
      processing_days: 3,
    },
    {
      id: 'service_letter',
      name: 'Service Letter',
      description: 'Years of service confirmation',
      processing_days: 3,
    },
  ];

  return res.json({ success: true, data: requestTypes });
});

export default router;
