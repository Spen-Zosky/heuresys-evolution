/**
 * Report Builder Engine Service
 * Epic 7 - Story 7.1: Report Builder Engine
 *
 * Features:
 * - Dynamic query builder for multiple data sources
 * - Calculated fields support
 * - Multi-table joins
 * - Parameterized reports
 * - Report execution engine
 * - Caching and performance optimization
 */
import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { escapeILIKE } from '../utils/sql-safety.js';
// ============================================================================
// Allowed Tables & Security
// ============================================================================
// Tables allowed for reporting (Heuresys tables ONLY - NO SAP tables)
const ALLOWED_TABLES = new Set([
    'employees',
    'departments',
    'locations',
    'org_units',
    'cost_centers',
    'goals',
    'performance_reviews',
    'review_cycles',
    'check_ins',
    'okrs',
    'okr_key_results',
    'feedback',
    'courses',
    'learning_paths',
    'certifications',
    'enrollments',
    'requisitions',
    'candidates',
    'interviews',
    'job_postings',
    'offers',
    'salary_bands',
    'bonus_plans',
    'merit_cycles',
    'benefits',
    'employee_benefits',
    'skills',
    'employee_skills',
    'surveys',
    'survey_responses',
    'recognition',
    'wellbeing_assessments',
    'career_paths',
    'succession_plans',
    'contracts',
    'leave_requests',
    'leave_balances',
    'notifications',
    'audit_logs',
    'users',
]);
// Fields that should be excluded from reports (sensitive data)
const SENSITIVE_FIELDS = new Set([
    'password_hash',
    'password',
    'secret',
    'token',
    'api_key',
    'ssn',
    'tax_id',
    'bank_account',
    'credit_card',
]);
// ============================================================================
// Query Builder
// ============================================================================
class QueryBuilder {
    baseTable;
    selectFields = [];
    joinClauses = [];
    whereClauses = [];
    groupByClauses = [];
    orderByClauses = [];
    havingClauses = [];
    parameters = [];
    paramIndex = 1;
    tableAliases = new Map();
    constructor(tenantId, baseTable) {
        this.baseTable = this.sanitizeTableName(baseTable);
        this.tableAliases.set(baseTable, 't0');
        // Always add tenant filter for security
        this.whereClauses.push(`t0.tenant_id = $${this.paramIndex++}`);
        this.parameters.push(tenantId);
    }
    sanitizeTableName(table) {
        // Only allow alphanumeric and underscore
        const sanitized = table.replace(/[^a-zA-Z0-9_]/g, '');
        if (!ALLOWED_TABLES.has(sanitized)) {
            throw new Error(`Table '${table}' is not allowed for reporting`);
        }
        return sanitized;
    }
    sanitizeFieldName(field) {
        // Only allow alphanumeric, underscore, and dot (for table.field)
        const sanitized = field.replace(/[^a-zA-Z0-9_.]/g, '');
        const fieldName = sanitized.split('.').pop() || '';
        if (SENSITIVE_FIELDS.has(fieldName.toLowerCase())) {
            throw new Error(`Field '${field}' contains sensitive data and cannot be included in reports`);
        }
        return sanitized;
    }
    getTableAlias(table) {
        if (!this.tableAliases.has(table)) {
            this.tableAliases.set(table, `t${this.tableAliases.size}`);
        }
        return this.tableAliases.get(table);
    }
    addField(field) {
        const sanitizedField = this.sanitizeFieldName(field.source_field);
        let fieldExpr;
        if (field.aggregate) {
            const aggregateFunc = field.aggregate.toUpperCase();
            if (aggregateFunc === 'COUNT_DISTINCT') {
                fieldExpr = `COUNT(DISTINCT ${sanitizedField})`;
            }
            else {
                fieldExpr = `${aggregateFunc}(${sanitizedField})`;
            }
        }
        else {
            fieldExpr = sanitizedField;
        }
        const alias = field.alias || field.name;
        this.selectFields.push(`${fieldExpr} AS "${alias}"`);
        return this;
    }
    addCalculatedField(field) {
        // Validate expression - only allow safe SQL expressions
        const safeExpression = this.validateCalculatedExpression(field.expression);
        const alias = field.alias || field.name;
        this.selectFields.push(`(${safeExpression}) AS "${alias}"`);
        return this;
    }
    validateCalculatedExpression(expression) {
        // Block dangerous SQL keywords
        const dangerousPatterns = [
            /\b(drop|delete|insert|update|truncate|alter|create|grant|revoke)\b/i,
            /\b(exec|execute|xp_|sp_)\b/i,
            /;/,
            /--/,
            /\/\*/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(expression)) {
                throw new Error('Invalid calculated field expression');
            }
        }
        // Only allow: field names, numbers, arithmetic operators, CASE/WHEN, COALESCE, NULLIF, basic functions
        const allowedPattern = /^[\w\s\.\+\-\*\/\(\)\,\'\"\=\<\>\!\|\&]+$/;
        if (!allowedPattern.test(expression)) {
            throw new Error('Invalid characters in calculated field expression');
        }
        return expression;
    }
    addJoin(join) {
        const table = this.sanitizeTableName(join.table);
        const alias = join.alias || this.getTableAlias(table);
        const joinType = join.type.toUpperCase();
        const leftField = this.sanitizeFieldName(join.on.left_field);
        const rightField = this.sanitizeFieldName(join.on.right_field);
        const operator = join.on.operator || '=';
        // Validate operator
        if (!['=', '!=', '>', '<', '>=', '<='].includes(operator)) {
            throw new Error('Invalid join operator');
        }
        this.joinClauses.push(`${joinType} JOIN ${table} ${alias} ON ${leftField} ${operator} ${rightField} AND ${alias}.tenant_id = $1`);
        this.tableAliases.set(table, alias);
        return this;
    }
    addFilter(filter, paramValue) {
        const field = this.sanitizeFieldName(filter.field);
        let clause;
        switch (filter.operator) {
            case 'is_null':
                clause = `${field} IS NULL`;
                break;
            case 'is_not_null':
                clause = `${field} IS NOT NULL`;
                break;
            case 'in':
            case 'not_in':
                const values = paramValue || filter.value;
                if (!Array.isArray(values)) {
                    throw new Error('IN/NOT IN operator requires an array value');
                }
                const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
                this.parameters.push(...values);
                clause = `${field} ${filter.operator === 'in' ? 'IN' : 'NOT IN'} (${placeholders})`;
                break;
            case 'between':
                const val1 = paramValue?.[0] || filter.value;
                const val2 = paramValue?.[1] || filter.value2;
                clause = `${field} BETWEEN $${this.paramIndex++} AND $${this.paramIndex++}`;
                this.parameters.push(val1, val2);
                break;
            case 'like':
            case 'ilike':
                clause = `${field} ${filter.operator.toUpperCase()} $${this.paramIndex++}`;
                this.parameters.push(paramValue || filter.value);
                break;
            default:
                if (!['=', '!=', '>', '<', '>=', '<='].includes(filter.operator)) {
                    throw new Error(`Invalid filter operator: ${filter.operator}`);
                }
                clause = `${field} ${filter.operator} $${this.paramIndex++}`;
                this.parameters.push(paramValue || filter.value);
        }
        this.whereClauses.push(clause);
        return this;
    }
    addGroupBy(field) {
        this.groupByClauses.push(this.sanitizeFieldName(field));
        return this;
    }
    addOrderBy(sort) {
        const field = this.sanitizeFieldName(sort.field);
        const direction = sort.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        this.orderByClauses.push(`${field} ${direction}`);
        return this;
    }
    build(options) {
        if (this.selectFields.length === 0) {
            throw new Error('No fields selected for report');
        }
        const parts = [];
        // SELECT
        parts.push(`SELECT ${this.selectFields.join(', ')}`);
        // FROM
        parts.push(`FROM ${this.baseTable} t0`);
        // JOINs
        if (this.joinClauses.length > 0) {
            parts.push(this.joinClauses.join(' '));
        }
        // WHERE
        if (this.whereClauses.length > 0) {
            parts.push(`WHERE ${this.whereClauses.join(' AND ')}`);
        }
        // GROUP BY
        if (this.groupByClauses.length > 0) {
            parts.push(`GROUP BY ${this.groupByClauses.join(', ')}`);
        }
        // HAVING
        if (this.havingClauses.length > 0) {
            parts.push(`HAVING ${this.havingClauses.join(' AND ')}`);
        }
        // ORDER BY
        if (this.orderByClauses.length > 0) {
            parts.push(`ORDER BY ${this.orderByClauses.join(', ')}`);
        }
        // LIMIT & OFFSET
        if (options?.limit) {
            parts.push(`LIMIT ${Math.min(options.limit, 10000)}`);
        }
        if (options?.offset) {
            parts.push(`OFFSET ${options.offset}`);
        }
        return {
            query: parts.join(' '),
            params: this.parameters,
        };
    }
    buildCount() {
        const parts = [];
        // Count query
        parts.push('SELECT COUNT(*) as total');
        parts.push(`FROM ${this.baseTable} t0`);
        if (this.joinClauses.length > 0) {
            parts.push(this.joinClauses.join(' '));
        }
        if (this.whereClauses.length > 0) {
            parts.push(`WHERE ${this.whereClauses.join(' AND ')}`);
        }
        return {
            query: parts.join(' '),
            params: this.parameters,
        };
    }
}
// ============================================================================
// Report Builder Service
// ============================================================================
export class ReportBuilderService {
    /**
     * Create a new report definition
     */
    async createReport(input) {
        const id = uuidv4();
        const query = `
      INSERT INTO report_definitions (
        id, tenant_id, name, description, data_source,
        columns, calculated_fields, joins, filters, sorting, grouping,
        parameters, drill_down_config, access_control,
        is_template, is_public, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17
      )
      RETURNING *
    `;
        const values = [
            id,
            input.tenant_id,
            input.name,
            input.description || null,
            input.data_source,
            JSON.stringify(input.fields || []),
            JSON.stringify(input.calculated_fields || []),
            JSON.stringify(input.joins || []),
            JSON.stringify(input.filters || []),
            JSON.stringify(input.sort || []),
            JSON.stringify(input.group_by || []),
            JSON.stringify(input.parameters || []),
            JSON.stringify(input.drill_down_config || {}),
            JSON.stringify(input.access_control || {}),
            input.is_system || false,
            input.is_public || false,
            input.created_by,
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    /**
     * Get report definition by ID
     */
    async getReport(tenantId, reportId) {
        const query = `
      SELECT * FROM report_definitions
      WHERE id = $1 AND tenant_id = $2
    `;
        const result = await pool.query(query, [reportId, tenantId]);
        return result.rows[0] || null;
    }
    /**
     * List reports for a tenant
     */
    async listReports(tenantId, options) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (options?.search) {
            conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
            params.push(`%${escapeILIKE(options.search)}%`);
            paramIndex++;
        }
        if (!options?.include_system) {
            conditions.push('is_template = false');
        }
        const page = options?.page || 1;
        const pageSize = options?.page_size || 20;
        const offset = (page - 1) * pageSize;
        const countQuery = `
      SELECT COUNT(*) FROM report_definitions
      WHERE ${conditions.join(' AND ')}
    `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);
        const query = `
      SELECT id, name, description, data_source, is_template, is_public,
             created_at, updated_at, created_by
      FROM report_definitions
      WHERE ${conditions.join(' AND ')}
      ORDER BY name
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(pageSize, offset);
        const result = await pool.query(query, params);
        return { reports: result.rows, total };
    }
    /**
     * Update a report definition
     */
    async updateReport(tenantId, reportId, updates) {
        const setClauses = [];
        const params = [reportId, tenantId];
        let paramIndex = 3;
        // Map input fields to database columns
        const fieldMapping = {
            name: 'name',
            description: 'description',
            data_source: 'data_source',
            fields: 'columns',
            calculated_fields: 'calculated_fields',
            joins: 'joins',
            filters: 'filters',
            sort: 'sorting',
            group_by: 'grouping',
            parameters: 'parameters',
            drill_down_config: 'drill_down_config',
            access_control: 'access_control',
            is_public: 'is_public',
        };
        for (const [inputField, dbColumn] of Object.entries(fieldMapping)) {
            if (updates[inputField] !== undefined) {
                const value = updates[inputField];
                setClauses.push(`${dbColumn} = $${paramIndex++}`);
                params.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        if (setClauses.length === 0) {
            return this.getReport(tenantId, reportId);
        }
        setClauses.push('updated_at = NOW()');
        const query = `
      UPDATE report_definitions
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2 AND is_template = false
      RETURNING *
    `;
        const result = await pool.query(query, params);
        return result.rows[0] || null;
    }
    /**
     * Delete a report (hard delete - templates cannot be deleted)
     */
    async deleteReport(tenantId, reportId) {
        const query = `
      DELETE FROM report_definitions
      WHERE id = $1 AND tenant_id = $2 AND is_template = false
    `;
        const result = await pool.query(query, [reportId, tenantId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Execute a report and return results
     */
    async executeReport(tenantId, reportId, options = {}) {
        const startTime = Date.now();
        const executionId = uuidv4();
        // Get report definition
        const report = await this.getReport(tenantId, reportId);
        if (!report) {
            throw new Error('Report not found');
        }
        // Build query
        const builder = new QueryBuilder(tenantId, report.data_source);
        // Add fields
        const fields = report.fields;
        for (const field of fields) {
            builder.addField(field);
        }
        // Add calculated fields
        const calculatedFields = report.calculated_fields;
        for (const field of calculatedFields) {
            builder.addCalculatedField(field);
        }
        // Add joins
        const joins = report.joins;
        for (const join of joins) {
            builder.addJoin(join);
        }
        // Add filters (with parameter substitution)
        const filters = report.filters;
        const parameters = options.parameters || {};
        for (const filter of filters) {
            if (filter.parameterized && filter.parameter_name) {
                const paramValue = parameters[filter.parameter_name];
                if (paramValue !== undefined) {
                    builder.addFilter(filter, paramValue);
                }
            }
            else {
                builder.addFilter(filter);
            }
        }
        // Add group by
        const groupBy = report.group_by;
        for (const group of groupBy) {
            builder.addGroupBy(group.field);
        }
        // Add sort
        const sort = report.sort;
        for (const s of sort) {
            builder.addOrderBy(s);
        }
        // Pagination
        const page = options.page || 1;
        const pageSize = Math.min(options.page_size || 100, 10000);
        const offset = (page - 1) * pageSize;
        // Get total count
        const countQuery = builder.buildCount();
        const countResult = await pool.query(countQuery.query, countQuery.params);
        const totalRows = parseInt(countResult.rows[0].total, 10);
        // Execute main query
        const mainQuery = builder.build({ limit: pageSize, offset });
        const result = await pool.query(mainQuery.query, mainQuery.params);
        const executionTime = Date.now() - startTime;
        // Log execution
        await this.logExecution(executionId, reportId, tenantId, {
            parameters: options.parameters || {},
            row_count: result.rows.length,
            execution_time_ms: executionTime,
            status: 'completed',
        });
        // Calculate totals if requested
        let totals;
        if (options.include_totals && groupBy.length === 0) {
            totals = await this.calculateTotals(tenantId, report, filters, parameters);
        }
        const executionResult = {
            execution_id: executionId,
            report_id: reportId,
            data: result.rows,
            metadata: {
                total_rows: totalRows,
                page,
                page_size: pageSize,
                total_pages: Math.ceil(totalRows / pageSize),
                execution_time_ms: executionTime,
                generated_at: new Date().toISOString(),
            },
        };
        if (totals) {
            executionResult.totals = totals;
        }
        return executionResult;
    }
    /**
     * Calculate totals for numeric fields
     */
    async calculateTotals(tenantId, report, filters, parameters) {
        const fields = report.fields;
        const numericFields = fields.filter((f) => f.aggregate && ['sum', 'count', 'avg'].includes(f.aggregate));
        if (numericFields.length === 0) {
            return {};
        }
        const builder = new QueryBuilder(tenantId, report.data_source);
        for (const field of numericFields) {
            builder.addField({ ...field, alias: `total_${field.name}` });
        }
        // Add joins
        const joins = report.joins;
        for (const join of joins) {
            builder.addJoin(join);
        }
        // Add filters
        for (const filter of filters) {
            if (filter.parameterized && filter.parameter_name) {
                const paramValue = parameters[filter.parameter_name];
                if (paramValue !== undefined) {
                    builder.addFilter(filter, paramValue);
                }
            }
            else {
                builder.addFilter(filter);
            }
        }
        const query = builder.build();
        const result = await pool.query(query.query, query.params);
        return result.rows[0] || {};
    }
    /**
     * Log report execution
     */
    async logExecution(executionId, reportId, tenantId, details) {
        const query = `
      INSERT INTO report_executions (
        id, report_id, tenant_id, parameters, row_count,
        execution_time_ms, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
        await pool.query(query, [
            executionId,
            reportId,
            tenantId,
            JSON.stringify(details.parameters || {}),
            details.row_count,
            details.execution_time_ms,
            details.status,
            details.error || null,
        ]);
    }
    /**
     * Preview report (limited results for testing)
     */
    async previewReport(tenantId, definition) {
        if (!definition.data_source || !definition.fields) {
            throw new Error('data_source and fields are required for preview');
        }
        const builder = new QueryBuilder(tenantId, definition.data_source);
        for (const field of definition.fields) {
            builder.addField(field);
        }
        if (definition.calculated_fields) {
            for (const field of definition.calculated_fields) {
                builder.addCalculatedField(field);
            }
        }
        if (definition.joins) {
            for (const join of definition.joins) {
                builder.addJoin(join);
            }
        }
        if (definition.filters) {
            for (const filter of definition.filters) {
                if (!filter.parameterized) {
                    builder.addFilter(filter);
                }
            }
        }
        if (definition.sort) {
            for (const s of definition.sort) {
                builder.addOrderBy(s);
            }
        }
        // Limit preview to 10 rows
        const query = builder.build({ limit: 10 });
        const result = await pool.query(query.query, query.params);
        return result.rows;
    }
    /**
     * Clone an existing report
     */
    async cloneReport(tenantId, reportId, newName, createdBy) {
        const original = await this.getReport(tenantId, reportId);
        if (!original) {
            throw new Error('Original report not found');
        }
        return this.createReport({
            tenant_id: tenantId,
            name: newName,
            description: `Clone of ${original.name}`,
            category: original.category,
            data_source: original.data_source,
            fields: original.fields,
            calculated_fields: original.calculated_fields,
            joins: original.joins,
            filters: original.filters,
            sort: original.sort,
            group_by: original.group_by,
            parameters: original.parameters,
            drill_down_config: original.drill_down_config,
            access_control: {},
            is_system: false,
            is_public: false,
            created_by: createdBy,
        });
    }
    /**
     * Get available data sources for reporting
     */
    getAvailableDataSources() {
        return Array.from(ALLOWED_TABLES).map((table) => ({
            name: table,
            description: this.getTableDescription(table),
        }));
    }
    getTableDescription(table) {
        const descriptions = {
            employees: 'Employee master data',
            departments: 'OrgUnit structure',
            locations: 'Office locations and branches',
            org_units: 'Organizational units hierarchy',
            cost_centers: 'Cost center assignments',
            goals: 'Employee goals and objectives',
            performance_reviews: 'Performance review records',
            review_cycles: 'Review cycle definitions',
            check_ins: 'Regular check-in meetings',
            okrs: 'OKR objectives',
            okr_key_results: 'OKR key results',
            feedback: 'Feedback records',
            courses: 'Training courses',
            learning_paths: 'Learning path definitions',
            certifications: 'Certification records',
            enrollments: 'Course enrollments',
            requisitions: 'Job requisitions',
            candidates: 'Recruitment candidates',
            interviews: 'Interview records',
            job_postings: 'Job posting listings',
            offers: 'Job offers',
            salary_bands: 'Salary band definitions',
            bonus_plans: 'Bonus plan configurations',
            merit_cycles: 'Merit increase cycles',
            benefits: 'Benefit plan definitions',
            employee_benefits: 'Employee benefit enrollments',
            skills: 'Skill taxonomy',
            employee_skills: 'Employee skill assessments',
            surveys: 'Survey definitions',
            survey_responses: 'Survey response data',
            recognition: 'Employee recognition records',
            wellbeing_assessments: 'Wellbeing survey results',
            career_paths: 'Career path definitions',
            succession_plans: 'Succession planning data',
            contracts: 'Employment contracts',
            leave_requests: 'Leave request records',
            leave_balances: 'Leave balance tracking',
            notifications: 'System notifications',
            audit_logs: 'Audit trail records',
            users: 'User accounts',
        };
        return descriptions[table] || table;
    }
    /**
     * Get field metadata for a data source
     */
    async getDataSourceFields(dataSource) {
        if (!ALLOWED_TABLES.has(dataSource)) {
            throw new Error(`Data source '${dataSource}' is not allowed`);
        }
        const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1
        AND table_schema = 'public'
        AND column_name NOT IN ('password_hash', 'password', 'secret', 'token', 'api_key')
      ORDER BY ordinal_position
    `;
        const result = await pool.query(query, [dataSource]);
        return result.rows.map((row) => ({
            name: row.column_name,
            type: this.mapPostgresType(row.data_type),
            nullable: row.is_nullable === 'YES',
            has_default: row.column_default !== null,
        }));
    }
    mapPostgresType(pgType) {
        const typeMap = {
            uuid: 'string',
            'character varying': 'string',
            text: 'string',
            integer: 'number',
            bigint: 'number',
            numeric: 'number',
            decimal: 'number',
            real: 'number',
            'double precision': 'number',
            boolean: 'boolean',
            date: 'date',
            'timestamp without time zone': 'datetime',
            'timestamp with time zone': 'datetime',
            jsonb: 'json',
            json: 'json',
            ARRAY: 'array',
        };
        return typeMap[pgType] || 'string';
    }
    /**
     * Get report execution history
     */
    async getExecutionHistory(tenantId, reportId, limit = 50) {
        const query = `
      SELECT id, executed_at, parameters, row_count,
             execution_time_ms, status, error_message
      FROM report_executions
      WHERE report_id = $1 AND tenant_id = $2
      ORDER BY executed_at DESC
      LIMIT $3
    `;
        const result = await pool.query(query, [reportId, tenantId, limit]);
        return result.rows;
    }
}
// Export singleton instance
export const reportBuilderService = new ReportBuilderService();
//# sourceMappingURL=report-builder.js.map