/**
 * Import Engine Service
 * CSV/Excel parsing, validation, mapping, and upsert for bulk data import.
 * Supports: employees, org_units, roles (rbp), skills (tenant_custom), process_roles.
 */
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { logger } from '../config/logger.js';
// === COLUMN MAPPING REGISTRY ===
const COLUMN_MAPS = {
    employees: {
        employee_code: 'pernr',
        codice: 'pernr',
        matricola: 'pernr',
        pernr: 'pernr',
        first_name: 'first_name',
        nome: 'first_name',
        last_name: 'last_name',
        cognome: 'last_name',
        email: 'email',
        org_unit_code: '_lookup_org_unit',
        reparto: '_lookup_org_unit',
        department: '_lookup_org_unit',
        job_title: 'job_title',
        qualifica: 'job_title',
        hire_date: 'hire_date',
        data_assunzione: 'hire_date',
        birth_date: 'birth_date',
        data_nascita: 'birth_date',
        gender: 'gender',
        sesso: 'gender',
        phone_mobile: 'phone_mobile',
        cellulare: 'phone_mobile',
        nationality: 'nationality',
        nazionalita: 'nationality',
        tax_id: 'tax_id',
        codice_fiscale: 'tax_id',
    },
    org_units: {
        code: 'code',
        codice: 'code',
        name: 'name',
        nome: 'name',
        name_en: 'name_en',
        parent_code: '_lookup_parent',
        codice_padre: '_lookup_parent',
        org_type: 'org_type',
        tipo: 'org_type',
        org_level: 'org_level',
        livello: 'org_level',
        is_active: 'is_active',
        description: 'description',
        descrizione: 'description',
    },
    roles: {
        code: 'code',
        codice: 'code',
        name: 'name',
        nome: 'name',
        description: 'description',
        descrizione: 'description',
        hierarchy_level: 'hierarchy_level',
        livello: 'hierarchy_level',
    },
    skills: {
        code: 'code',
        codice: 'code',
        name_en: 'name_en',
        name_it: 'name_it',
        nome: 'name_it',
        name: 'name_en',
        skill_type: 'skill_type',
        tipo: 'skill_type',
        description_en: 'description_en',
        description_it: 'description_it',
        descrizione: 'description_it',
    },
    process_roles: {
        role_name: 'role_name',
        nome_ruolo: 'role_name',
        role_type: 'role_type',
        tipo_ruolo: 'role_type',
        description: 'description',
        descrizione: 'description',
        min_headcount: 'min_headcount',
        max_headcount: 'max_headcount',
    },
};
// === MATCH KEYS (for upsert ON CONFLICT) ===
const MATCH_KEYS = {
    employees: ['tenant_id', 'pernr'],
    org_units: ['tenant_id', 'code'],
    skills: ['tenant_id', 'code'],
    roles: ['code'],
    process_roles: ['process_id', 'role_name'],
};
// === REQUIRED FIELDS ===
const REQUIRED_FIELDS = {
    employees: ['pernr', 'first_name', 'last_name', 'email'],
    org_units: ['code', 'name'],
    roles: ['code', 'name'],
    skills: ['code', 'name_en'],
    process_roles: ['role_name', 'role_type'],
};
// === TARGET TABLES ===
const TARGET_TABLES = {
    employees: 'employees',
    org_units: 'org_units',
    roles: 'rbp_roles',
    skills: 'tenant_custom_skills',
    process_roles: 'process_roles',
};
// Fields that should NOT be part of SET clause on upsert (match keys + auto-generated)
const EXCLUDED_FROM_UPDATE = ['id', 'tenant_id', 'created_at', 'created_by'];
// === DATE PARSING ===
function parseDate(value) {
    if (!value || typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    // ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime()))
            return trimmed;
        return null;
    }
    // Italian format: DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        const iso = `${year}-${month}-${day}`;
        const d = new Date(iso);
        if (!isNaN(d.getTime()))
            return iso;
        return null;
    }
    return null;
}
// === EMAIL VALIDATION ===
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// === BOOLEAN PARSING ===
function parseBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return ['true', '1', 'yes', 'si', 'sì', 'attivo', 'active'].includes(lower);
    }
    return !!value;
}
// === CLASS ===
export class ImportEngineService {
    dbClient;
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    // --- parseFile ---
    async parseFile(buffer, mimeType, fileName) {
        const ext = fileName.toLowerCase();
        if (ext.endsWith('.csv') || mimeType === 'text/csv') {
            return this.parseCsv(buffer);
        }
        if (ext.endsWith('.xlsx') ||
            ext.endsWith('.xls') ||
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel') {
            return this.parseExcel(buffer);
        }
        throw new Error('Unsupported file format. Use .csv, .xlsx, or .xls');
    }
    parseCsv(buffer) {
        const content = buffer.toString('utf-8');
        const result = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        });
        if (result.errors.length > 0) {
            const criticalErrors = result.errors.filter((e) => e.type === 'Delimiter' || e.type === 'Quotes');
            if (criticalErrors.length > 0) {
                throw new Error(`CSV parsing failed: ${criticalErrors[0]?.message ?? 'Unknown error'}`);
            }
        }
        const headers = result.meta.fields || [];
        const rows = result.data.map((row) => {
            const parsed = {};
            for (const key of headers) {
                const val = row[key];
                parsed[key] = val === '' || val === undefined ? null : val;
            }
            return parsed;
        });
        return { headers, rows, totalRows: rows.length };
    }
    async parseExcel(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet || worksheet.rowCount === 0) {
            throw new Error('Excel file is empty or has no worksheets');
        }
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            const val = cell.value?.toString().trim().toLowerCase().replace(/\s+/g, '_') || `col_${colNumber}`;
            headers.push(val);
        });
        const rows = [];
        for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const parsed = {};
            let hasData = false;
            headers.forEach((header, idx) => {
                const cell = row.getCell(idx + 1);
                let value = null;
                if (cell.value !== null && cell.value !== undefined) {
                    if (cell.value instanceof Date) {
                        value = cell.value.toISOString().split('T')[0] ?? null;
                    }
                    else if (typeof cell.value === 'object' && 'result' in cell.value) {
                        value = cell.value.result?.toString() ?? null;
                    }
                    else {
                        value = cell.value.toString();
                    }
                    if (value !== null && value !== '')
                        hasData = true;
                }
                parsed[header] = value;
            });
            if (hasData)
                rows.push(parsed);
        }
        return { headers, rows, totalRows: rows.length };
    }
    // --- validateData ---
    async validateData(parsed, importType, tenantId) {
        const columnMap = COLUMN_MAPS[importType];
        const requiredFields = REQUIRED_FIELDS[importType];
        const errors = [];
        const warnings = [];
        const validRows = [];
        // Map headers to DB columns
        const headerMapping = {};
        for (const header of parsed.headers) {
            const dbCol = columnMap[header];
            if (dbCol) {
                headerMapping[header] = dbCol;
            }
        }
        // Check that all required fields can be mapped
        const mappedDbCols = new Set(Object.values(headerMapping));
        for (const req of requiredFields) {
            if (!mappedDbCols.has(req)) {
                errors.push({
                    row: 0,
                    field: req,
                    value: null,
                    message: `Required column '${req}' not found in file headers. Available: [${parsed.headers.join(', ')}]`,
                    severity: 'error',
                });
            }
        }
        if (errors.length > 0) {
            return {
                validRows: [],
                errors,
                warnings,
                totalRows: parsed.totalRows,
                validCount: 0,
                errorCount: errors.length,
            };
        }
        // Pre-load lookup caches for FK resolution
        const orgUnitCache = new Map();
        if (mappedDbCols.has('_lookup_org_unit')) {
            const result = await this.dbClient.query('SELECT id, code FROM org_units WHERE tenant_id = $1 AND code IS NOT NULL', [tenantId]);
            for (const row of result.rows) {
                orgUnitCache.set(row.code.toLowerCase(), row.id);
            }
        }
        const parentCache = new Map();
        if (mappedDbCols.has('_lookup_parent')) {
            const result = await this.dbClient.query('SELECT id, code FROM org_units WHERE tenant_id = $1 AND code IS NOT NULL', [tenantId]);
            for (const row of result.rows) {
                parentCache.set(row.code.toLowerCase(), row.id);
            }
        }
        // Validate each row
        for (let i = 0; i < parsed.rows.length; i++) {
            const row = parsed.rows[i];
            const rowNum = i + 2; // +2 for 1-based + header row
            let rowValid = true;
            const mappedRow = {};
            for (const [header, dbCol] of Object.entries(headerMapping)) {
                const rawValue = row[header] ?? null;
                // Handle lookup fields
                if (dbCol === '_lookup_org_unit') {
                    if (rawValue && typeof rawValue === 'string') {
                        const orgUnitId = orgUnitCache.get(rawValue.toString().toLowerCase().trim());
                        if (orgUnitId) {
                            mappedRow['org_unit_id'] = orgUnitId;
                        }
                        else {
                            warnings.push({
                                row: rowNum,
                                field: header,
                                value: rawValue,
                                message: `Org unit code '${rawValue}' not found — field will be null`,
                                severity: 'warning',
                            });
                        }
                    }
                    continue;
                }
                if (dbCol === '_lookup_parent') {
                    if (rawValue && typeof rawValue === 'string') {
                        const parentId = parentCache.get(rawValue.toString().toLowerCase().trim());
                        if (parentId) {
                            mappedRow['parent_id'] = parentId;
                        }
                        else {
                            warnings.push({
                                row: rowNum,
                                field: header,
                                value: rawValue,
                                message: `Parent org unit code '${rawValue}' not found — field will be null`,
                                severity: 'warning',
                            });
                        }
                    }
                    continue;
                }
                mappedRow[dbCol] = rawValue;
            }
            // Check required fields
            for (const req of requiredFields) {
                const val = mappedRow[req];
                if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
                    errors.push({
                        row: rowNum,
                        field: req,
                        value: val,
                        message: `Required field '${req}' is empty`,
                        severity: 'error',
                    });
                    rowValid = false;
                }
            }
            // Type-specific validations
            if (importType === 'employees') {
                // pernr max length 8
                const pernr = mappedRow['pernr'];
                if (pernr && typeof pernr === 'string' && pernr.length > 8) {
                    errors.push({
                        row: rowNum,
                        field: 'pernr',
                        value: pernr,
                        message: `pernr '${pernr}' exceeds max length of 8 characters`,
                        severity: 'error',
                    });
                    rowValid = false;
                }
                // Email validation
                const email = mappedRow['email'];
                if (email && typeof email === 'string' && !isValidEmail(email)) {
                    errors.push({
                        row: rowNum,
                        field: 'email',
                        value: email,
                        message: `Invalid email format: '${email}'`,
                        severity: 'error',
                    });
                    rowValid = false;
                }
                // Date validations
                for (const dateField of ['hire_date', 'birth_date']) {
                    const dateVal = mappedRow[dateField];
                    if (dateVal && typeof dateVal === 'string') {
                        const parsed = parseDate(dateVal);
                        if (parsed) {
                            mappedRow[dateField] = parsed;
                        }
                        else {
                            errors.push({
                                row: rowNum,
                                field: dateField,
                                value: dateVal,
                                message: `Invalid date format '${dateVal}' — use YYYY-MM-DD or DD/MM/YYYY`,
                                severity: 'error',
                            });
                            rowValid = false;
                        }
                    }
                }
                // Gender normalization
                const gender = mappedRow['gender'];
                if (gender && typeof gender === 'string') {
                    const g = gender.toLowerCase().trim();
                    if (['m', 'male', 'maschio', 'maschile'].includes(g)) {
                        mappedRow['gender'] = 'M';
                    }
                    else if (['f', 'female', 'femmina', 'femminile'].includes(g)) {
                        mappedRow['gender'] = 'F';
                    }
                    else if (['x', 'other', 'altro', 'non-binary'].includes(g)) {
                        mappedRow['gender'] = 'X';
                    }
                    else {
                        warnings.push({
                            row: rowNum,
                            field: 'gender',
                            value: gender,
                            message: `Unrecognized gender value '${gender}' — kept as-is`,
                            severity: 'warning',
                        });
                    }
                }
            }
            if (importType === 'org_units') {
                // org_level should be numeric
                const orgLevel = mappedRow['org_level'];
                if (orgLevel !== null && orgLevel !== undefined) {
                    const num = parseInt(String(orgLevel), 10);
                    if (isNaN(num)) {
                        warnings.push({
                            row: rowNum,
                            field: 'org_level',
                            value: orgLevel,
                            message: `Non-numeric org_level '${orgLevel}' — will be null`,
                            severity: 'warning',
                        });
                        mappedRow['org_level'] = null;
                    }
                    else {
                        mappedRow['org_level'] = num;
                    }
                }
                // is_active boolean parsing
                if ('is_active' in mappedRow) {
                    mappedRow['is_active'] = parseBoolean(mappedRow['is_active']);
                }
            }
            if (importType === 'skills') {
                const skillType = mappedRow['skill_type'];
                if (skillType && typeof skillType === 'string') {
                    const validTypes = [
                        'knowledge',
                        'skill',
                        'ability',
                        'behavior',
                        'attitude',
                        'competence',
                    ];
                    if (!validTypes.includes(skillType.toLowerCase().trim())) {
                        warnings.push({
                            row: rowNum,
                            field: 'skill_type',
                            value: skillType,
                            message: `Unrecognized skill_type '${skillType}' — defaulting to 'skill'`,
                            severity: 'warning',
                        });
                        mappedRow['skill_type'] = 'skill';
                    }
                    else {
                        mappedRow['skill_type'] = skillType.toLowerCase().trim();
                    }
                }
            }
            if (importType === 'process_roles') {
                const roleType = mappedRow['role_type'];
                if (roleType && typeof roleType === 'string') {
                    const validTypes = ['owner', 'executor', 'approver', 'reviewer', 'informed'];
                    if (!validTypes.includes(roleType.toLowerCase().trim())) {
                        errors.push({
                            row: rowNum,
                            field: 'role_type',
                            value: roleType,
                            message: `Invalid role_type '${roleType}' — must be one of: ${validTypes.join(', ')}`,
                            severity: 'error',
                        });
                        rowValid = false;
                    }
                    else {
                        mappedRow['role_type'] = roleType.toLowerCase().trim();
                    }
                }
                // headcount should be numeric
                for (const hcField of ['min_headcount', 'max_headcount']) {
                    const val = mappedRow[hcField];
                    if (val !== null && val !== undefined) {
                        const num = parseInt(String(val), 10);
                        mappedRow[hcField] = isNaN(num) ? null : num;
                    }
                }
            }
            if (importType === 'roles') {
                const hl = mappedRow['hierarchy_level'];
                if (hl !== null && hl !== undefined) {
                    const num = parseInt(String(hl), 10);
                    mappedRow['hierarchy_level'] = isNaN(num) ? null : num;
                }
            }
            if (rowValid) {
                validRows.push(mappedRow);
            }
        }
        return {
            validRows,
            errors,
            warnings,
            totalRows: parsed.totalRows,
            validCount: validRows.length,
            errorCount: errors.filter((e) => e.severity === 'error').length,
        };
    }
    // --- mapToEntities ---
    mapToEntities(validated, importType, tenantId) {
        const matchKeyFields = MATCH_KEYS[importType];
        const entities = [];
        for (let i = 0; i < validated.validRows.length; i++) {
            const row = validated.validRows[i];
            const data = {};
            const matchKey = {};
            // Add tenant_id for tenant-scoped tables
            if (['employees', 'org_units', 'skills'].includes(importType)) {
                data['tenant_id'] = tenantId;
            }
            // Copy all mapped fields
            for (const [field, value] of Object.entries(row)) {
                if (value !== undefined) {
                    data[field] = value;
                }
            }
            // Build match key
            for (const keyField of matchKeyFields) {
                matchKey[keyField] = data[keyField] ?? tenantId;
            }
            entities.push({
                data,
                sourceRow: i + 2,
                matchKey,
            });
        }
        return { importType, entities, tenantId };
    }
    // --- executeImport ---
    async executeImport(mapped, _tenantId, _userId) {
        const table = TARGET_TABLES[mapped.importType];
        const matchKeyFields = MATCH_KEYS[mapped.importType];
        let createdRows = 0;
        let updatedRows = 0;
        let skippedRows = 0;
        const errors = [];
        if (mapped.entities.length === 0) {
            return { createdRows: 0, updatedRows: 0, skippedRows: 0, errors: [] };
        }
        await this.dbClient.query('BEGIN');
        try {
            for (const entity of mapped.entities) {
                try {
                    // Build column list (exclude auto-generated fields)
                    const columns = [];
                    const values = [];
                    let paramIdx = 1;
                    for (const [col, val] of Object.entries(entity.data)) {
                        if (col === 'id' || col === 'created_at')
                            continue;
                        columns.push(col);
                        values.push(val);
                        paramIdx++;
                    }
                    // Add updated_at
                    columns.push('updated_at');
                    values.push(new Date());
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    const conflictCols = matchKeyFields.join(', ');
                    // Build SET clause for ON CONFLICT (exclude match keys and auto-generated)
                    const updateCols = columns.filter((col) => !matchKeyFields.includes(col) && !EXCLUDED_FROM_UPDATE.includes(col));
                    const setClause = updateCols.map((col) => `${col} = EXCLUDED.${col}`).join(', ');
                    let query;
                    if (setClause) {
                        query = `
              INSERT INTO ${table} (${columns.join(', ')})
              VALUES (${placeholders})
              ON CONFLICT (${conflictCols}) DO UPDATE SET ${setClause}
              RETURNING (xmax = 0) AS inserted
            `;
                    }
                    else {
                        query = `
              INSERT INTO ${table} (${columns.join(', ')})
              VALUES (${placeholders})
              ON CONFLICT (${conflictCols}) DO NOTHING
              RETURNING (xmax = 0) AS inserted
            `;
                    }
                    const result = await this.dbClient.query(query, values);
                    if (result.rowCount === 0) {
                        skippedRows++;
                    }
                    else if (result.rows[0].inserted) {
                        createdRows++;
                    }
                    else {
                        updatedRows++;
                    }
                }
                catch (err) {
                    const error = err;
                    logger.warn({ err: error.message, row: entity.sourceRow, table }, 'Import row failed');
                    errors.push({
                        row: entity.sourceRow,
                        field: '_db',
                        value: null,
                        message: error.message,
                        severity: 'error',
                    });
                }
            }
            // Commit if no critical errors
            if (errors.length === 0 || createdRows + updatedRows > 0) {
                await this.dbClient.query('COMMIT');
                logger.info({
                    table,
                    created: createdRows,
                    updated: updatedRows,
                    skipped: skippedRows,
                    errors: errors.length,
                }, 'Import completed');
            }
            else {
                await this.dbClient.query('ROLLBACK');
                logger.warn({ table, errors: errors.length }, 'Import rolled back — all rows failed');
            }
        }
        catch (err) {
            await this.dbClient.query('ROLLBACK');
            const error = err;
            logger.error({ err: error.message, table }, 'Import transaction failed');
            throw error;
        }
        return { createdRows, updatedRows, skippedRows, errors };
    }
}
//# sourceMappingURL=import-engine.js.map