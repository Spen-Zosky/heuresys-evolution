/**
 * SAP Migration Service
 * SAP HCM data import, validation, and synchronization
 * Epic 6: SAP HCM Migration - Stories 6.1-6.6
 */
import { pool } from '../config/database.js';
import crypto from 'crypto';
import { validateTableName } from '../utils/sql-safety.js';
// =============================================================================
// SAP EXPORT PARSER
// =============================================================================
export class SAPExportParser {
    constructor() {
        // Stateless parser
    }
    /**
     * Parse SAP HCM export file (supports CSV, JSON, XML formats)
     */
    async parseExportFile(content, format = 'csv') {
        switch (format) {
            case 'csv':
                return this.parseCSV(content);
            case 'json':
                return this.parseJSON(content);
            case 'xml':
                return this.parseXML(content);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2)
            return [];
        const headerLine = lines[0];
        if (!headerLine)
            return [];
        const headers = headerLine.split(';').map(h => h.trim().replace(/"/g, ''));
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (!currentLine)
                continue;
            const values = this.parseCSVLine(currentLine);
            if (values.length !== headers.length)
                continue;
            const data = {};
            headers.forEach((header, idx) => {
                data[header] = values[idx];
            });
            // Extract standard SAP fields
            const pernr = (data['PERNR'] || '');
            if (!pernr)
                continue;
            const record = {
                infotype: (data['INFTY'] || data['INFOTYPE'] || this.detectInfotype(headers)),
                pernr,
                subtype: data['SUBTY'] || undefined,
                begda: this.parseSAPDate(data['BEGDA']),
                endda: this.parseSAPDate(data['ENDDA']),
                seqnr: data['SEQNR'] ? parseInt(data['SEQNR']) : undefined,
                data,
            };
            records.push(record);
        }
        return records;
    }
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ';' && !inQuotes) {
                values.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    }
    parseJSON(content) {
        const data = JSON.parse(content);
        const records = Array.isArray(data) ? data : data.records || data.data || [];
        return records.map((record) => ({
            infotype: (record.INFTY || record.infotype || 'UNKNOWN'),
            pernr: (record.PERNR || record.pernr || ''),
            subtype: record.SUBTY || undefined,
            begda: this.parseSAPDate(record.BEGDA),
            endda: this.parseSAPDate(record.ENDDA),
            seqnr: record.SEQNR ? parseInt(record.SEQNR) : undefined,
            data: record,
        })).filter((r) => r.pernr);
    }
    parseXML(content) {
        // Basic XML parsing for SAP format
        const records = [];
        const recordMatches = content.match(/<record[^>]*>[\s\S]*?<\/record>/gi) || [];
        for (const recordXml of recordMatches) {
            const data = {};
            const fieldMatches = recordXml.matchAll(/<(\w+)>([^<]*)<\/\1>/g);
            for (const match of fieldMatches) {
                if (match[1]) {
                    data[match[1]] = match[2];
                }
            }
            const pernr = data['PERNR'];
            if (pernr) {
                records.push({
                    infotype: (data['INFTY'] || 'UNKNOWN'),
                    pernr,
                    subtype: data['SUBTY'] || undefined,
                    begda: this.parseSAPDate(data['BEGDA']),
                    endda: this.parseSAPDate(data['ENDDA']),
                    data,
                });
            }
        }
        return records;
    }
    parseSAPDate(dateStr) {
        if (!dateStr)
            return undefined;
        // SAP date format: YYYYMMDD or YYYY-MM-DD
        const cleaned = dateStr.replace(/-/g, '');
        if (cleaned.length === 8) {
            return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
        }
        return dateStr;
    }
    detectInfotype(headers) {
        // Try to detect infotype from field names
        if (headers.includes('VORNA') && headers.includes('NACHN'))
            return 'PA0002';
        if (headers.includes('ORGEH') && headers.includes('PLANS'))
            return 'PA0001';
        if (headers.includes('STRAS') && headers.includes('ORT01'))
            return 'PA0006';
        if (headers.includes('MASSN'))
            return 'PA0000';
        return 'UNKNOWN';
    }
}
// =============================================================================
// SAP MIGRATION SERVICE
// =============================================================================
export class SAPMigrationService {
    tenantId;
    parser;
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.parser = new SAPExportParser();
    }
    // ---------------------------------------------------------------------------
    // JOB MANAGEMENT
    // ---------------------------------------------------------------------------
    async createMigrationJob(config, createdBy) {
        const result = await pool.query(`
      INSERT INTO sap_migration_jobs (
        tenant_id, job_name, job_type, source_system, infotype_selection,
        config, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())
      RETURNING id
    `, [
            this.tenantId,
            config.name,
            config.jobType || 'full',
            config.sourceSystem || 'SAP_HCM',
            config.infotypeSelection || null,
            JSON.stringify(config),
            createdBy || null,
        ]);
        return result.rows[0].id;
    }
    async listJobs(options) {
        let query = `
      SELECT * FROM sap_migration_jobs
      WHERE tenant_id = $1
    `;
        const params = [this.tenantId];
        let paramIndex = 2;
        if (options.status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(options.status);
        }
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(options.limit, options.offset);
        const result = await pool.query(query, params);
        return result.rows;
    }
    async getJob(jobId) {
        const result = await pool.query('SELECT * FROM sap_migration_jobs WHERE id = $1 AND tenant_id = $2', [jobId, this.tenantId]);
        return result.rows[0] || null;
    }
    async updateJobStatus(jobId, status, updates) {
        const setClauses = ['status = $3', 'updated_at = NOW()'];
        const values = [jobId, this.tenantId, status];
        let paramIndex = 4;
        if (updates?.progress !== undefined) {
            setClauses.push(`progress_percent = $${paramIndex++}`);
            values.push(updates.progress);
        }
        if (updates?.currentPhase) {
            setClauses.push(`current_phase = $${paramIndex++}`);
            values.push(updates.currentPhase);
        }
        if (updates?.processedRecords !== undefined) {
            setClauses.push(`processed_records = $${paramIndex++}`);
            values.push(updates.processedRecords);
        }
        if (updates?.successCount !== undefined) {
            setClauses.push(`success_count = $${paramIndex++}`);
            values.push(updates.successCount);
        }
        if (updates?.errorCount !== undefined) {
            setClauses.push(`error_count = $${paramIndex++}`);
            values.push(updates.errorCount);
        }
        if (updates?.warningCount !== undefined) {
            setClauses.push(`warning_count = $${paramIndex++}`);
            values.push(updates.warningCount);
        }
        if (updates?.summary) {
            setClauses.push(`summary = $${paramIndex++}`);
            values.push(JSON.stringify(updates.summary));
        }
        if (updates?.errorLog) {
            setClauses.push(`error_log = $${paramIndex++}`);
            values.push(JSON.stringify(updates.errorLog));
        }
        if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
            setClauses.push('completed_at = NOW()');
        }
        if (status === 'parsing') {
            setClauses.push('started_at = NOW()');
        }
        await pool.query(`UPDATE sap_migration_jobs SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2`, values);
    }
    // ---------------------------------------------------------------------------
    // PARSING & STAGING
    // ---------------------------------------------------------------------------
    async parseAndStage(jobId, fileContent, format = 'csv', infotype) {
        await this.updateJobStatus(jobId, 'parsing', { currentPhase: 'Parsing export file' });
        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
        await pool.query('UPDATE sap_migration_jobs SET source_file_hash = $1 WHERE id = $2', [fileHash, jobId]);
        // Parse the file
        let records = await this.parser.parseExportFile(fileContent, format);
        // Filter by infotype if specified
        if (infotype) {
            records = records.map(r => ({ ...r, infotype }));
        }
        // Group by infotype for statistics
        const byInfotype = {};
        for (const record of records) {
            byInfotype[record.infotype] = (byInfotype[record.infotype] || 0) + 1;
        }
        // Stage the records
        for (const record of records) {
            await pool.query(`
        INSERT INTO sap_staged_data (
          tenant_id, job_id, infotype, pernr, subtype, begda, endda, seqnr, raw_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      `, [
                this.tenantId,
                jobId,
                record.infotype,
                record.pernr,
                record.subtype || null,
                record.begda || null,
                record.endda || null,
                record.seqnr || null,
                JSON.stringify(record.data),
            ]);
        }
        await pool.query('UPDATE sap_migration_jobs SET total_records = $1 WHERE id = $2', [records.length, jobId]);
        await this.updateJobStatus(jobId, 'pending', {
            currentPhase: 'Parsing complete',
            progress: 10,
        });
        return { totalRecords: records.length, stagedCount: records.length, byInfotype };
    }
    // ---------------------------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------------------------
    async validateStagedData(jobId) {
        await this.updateJobStatus(jobId, 'validating', { currentPhase: 'Validating data' });
        // Get staged records
        const stagedResult = await pool.query('SELECT * FROM sap_staged_data WHERE job_id = $1 AND tenant_id = $2 AND status = \'pending\'', [jobId, this.tenantId]);
        // Get mapping rules
        const mappings = await this.getInfotypeMappings();
        let validCount = 0;
        let errorCount = 0;
        let warningCount = 0;
        for (let i = 0; i < stagedResult.rows.length; i++) {
            const record = stagedResult.rows[i];
            const rawData = record.raw_data;
            const errors = [];
            const warnings = [];
            // Get mappings for this infotype
            const infotypeMappings = mappings.filter(m => m.infotype === record.infotype);
            // Validate required fields
            for (const mapping of infotypeMappings) {
                const value = rawData[mapping.sapField];
                if (mapping.required && (value === undefined || value === null || value === '')) {
                    errors.push({
                        field: mapping.sapField,
                        message: `Required field ${mapping.sapField} is missing`,
                        code: 'REQUIRED_FIELD_MISSING',
                    });
                }
                // Apply validation rules
                if (mapping.validationRules && value) {
                    const ruleErrors = this.applyValidationRules(mapping, value);
                    errors.push(...ruleErrors);
                }
            }
            // Validate PERNR format
            if (!/^\d{8}$/.test(record.pernr)) {
                warnings.push({
                    field: 'PERNR',
                    message: 'PERNR should be 8 digits',
                    value: record.pernr,
                    suggestion: record.pernr.padStart(8, '0'),
                });
            }
            // Validate date ranges
            if (record.begda && record.endda && new Date(record.begda) > new Date(record.endda)) {
                errors.push({
                    field: 'BEGDA/ENDDA',
                    message: 'Begin date cannot be after end date',
                    code: 'INVALID_DATE_RANGE',
                });
            }
            // Update record status
            const status = errors.length > 0 ? 'error' : 'validated';
            await pool.query(`
        UPDATE sap_staged_data SET
          status = $1,
          validation_errors = $2,
          validation_warnings = $3
        WHERE id = $4
      `, [
                status,
                errors.length > 0 ? JSON.stringify(errors) : null,
                warnings.length > 0 ? JSON.stringify(warnings) : null,
                record.id,
            ]);
            if (errors.length > 0)
                errorCount++;
            else
                validCount++;
            warningCount += warnings.length;
            // Update progress
            if (i % 100 === 0) {
                await this.updateJobStatus(jobId, 'validating', {
                    progress: 10 + Math.floor((i / stagedResult.rows.length) * 20),
                    processedRecords: i + 1,
                });
            }
        }
        await this.updateJobStatus(jobId, 'pending', {
            currentPhase: 'Validation complete',
            progress: 30,
            errorCount,
            warningCount,
        });
        return { validCount, errorCount, warningCount };
    }
    applyValidationRules(mapping, value) {
        const errors = [];
        const rules = mapping.validationRules;
        if (!rules)
            return errors;
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
            errors.push({
                field: mapping.sapField,
                message: `Value exceeds maximum length of ${rules.maxLength}`,
                value,
                code: 'MAX_LENGTH_EXCEEDED',
            });
        }
        if (rules.pattern && typeof value === 'string') {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(value)) {
                errors.push({
                    field: mapping.sapField,
                    message: `Value does not match expected pattern`,
                    value,
                    code: 'PATTERN_MISMATCH',
                });
            }
        }
        return errors;
    }
    // ---------------------------------------------------------------------------
    // MAPPING
    // ---------------------------------------------------------------------------
    async mapStagedData(jobId) {
        await this.updateJobStatus(jobId, 'mapping', { currentPhase: 'Mapping data' });
        const mappings = await this.getInfotypeMappings();
        const stagedResult = await pool.query('SELECT * FROM sap_staged_data WHERE job_id = $1 AND tenant_id = $2 AND status = \'validated\'', [jobId, this.tenantId]);
        let mappedCount = 0;
        let errorCount = 0;
        for (let i = 0; i < stagedResult.rows.length; i++) {
            const record = stagedResult.rows[i];
            const rawData = record.raw_data;
            try {
                const mappedData = await this.mapRecord(record.infotype, rawData, mappings);
                await pool.query(`
          UPDATE sap_staged_data SET
            status = 'mapped',
            mapped_data = $1,
            target_table = $2
          WHERE id = $3
        `, [
                    JSON.stringify(mappedData.data),
                    mappedData.targetTable,
                    record.id,
                ]);
                mappedCount++;
            }
            catch (error) {
                await pool.query(`
          UPDATE sap_staged_data SET
            status = 'error',
            validation_errors = validation_errors || $1
          WHERE id = $2
        `, [
                    JSON.stringify([{ field: 'mapping', message: error.message, code: 'MAPPING_ERROR' }]),
                    record.id,
                ]);
                errorCount++;
            }
            if (i % 100 === 0) {
                await this.updateJobStatus(jobId, 'mapping', {
                    progress: 30 + Math.floor((i / stagedResult.rows.length) * 20),
                    processedRecords: i + 1,
                });
            }
        }
        await this.updateJobStatus(jobId, 'pending', {
            currentPhase: 'Mapping complete',
            progress: 50,
        });
        return { mappedCount, errorCount };
    }
    async mapRecord(infotype, rawData, mappings) {
        const infotypeMappings = mappings.filter(m => m.infotype === infotype);
        if (infotypeMappings.length === 0) {
            throw new Error(`No mappings found for infotype ${infotype}`);
        }
        const firstMapping = infotypeMappings[0];
        if (!firstMapping) {
            throw new Error(`No mappings found for infotype ${infotype}`);
        }
        const targetTable = firstMapping.targetTable;
        const data = {};
        for (const mapping of infotypeMappings) {
            let value = rawData[mapping.sapField];
            // Apply transformation
            value = await this.transformValue(value, mapping);
            if (value !== undefined && value !== null && value !== '') {
                data[mapping.targetField] = value;
            }
            else if (mapping.defaultValue !== undefined) {
                data[mapping.targetField] = mapping.defaultValue;
            }
        }
        return { targetTable, data };
    }
    async transformValue(value, mapping) {
        if (value === undefined || value === null)
            return value;
        switch (mapping.transformType) {
            case 'direct':
                return value;
            case 'date':
                // Convert SAP date to ISO format
                if (typeof value === 'string') {
                    const cleaned = value.replace(/-/g, '');
                    if (cleaned.length === 8) {
                        return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
                    }
                }
                return value;
            case 'lookup':
                // Perform lookup transformation
                if (mapping.transformConfig?.lookupTable) {
                    const lookupTable = validateTableName(mapping.transformConfig.lookupTable, 'SAPMigration.transformValue.lookup');
                    const lookupResult = await pool.query(`SELECT id FROM ${lookupTable} WHERE code = $1 AND tenant_id = $2 LIMIT 1`, [value, this.tenantId]);
                    return lookupResult.rows[0]?.id || null;
                }
                return value;
            case 'expression':
                // Apply expression transformation
                if (mapping.transformConfig?.expression) {
                    const expr = mapping.transformConfig.expression;
                    return expr.replace(/\{value\}/g, String(value));
                }
                return value;
            default:
                return value;
        }
    }
    // ---------------------------------------------------------------------------
    // EXECUTION
    // ---------------------------------------------------------------------------
    async executeMigration(jobId, dryRun = false) {
        const phase = dryRun ? 'Simulating migration' : 'Executing migration';
        await this.updateJobStatus(jobId, 'executing', { currentPhase: phase });
        const stagedResult = await pool.query('SELECT * FROM sap_staged_data WHERE job_id = $1 AND tenant_id = $2 AND status = \'mapped\' ORDER BY pernr, infotype', [jobId, this.tenantId]);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        const byPernr = {};
        for (const record of stagedResult.rows) {
            const pernrKey = record.pernr;
            if (!byPernr[pernrKey])
                byPernr[pernrKey] = [];
            byPernr[pernrKey].push(record);
        }
        let processedPernr = 0;
        const totalPernr = Object.keys(byPernr).length;
        for (const pernr of Object.keys(byPernr)) {
            const records = byPernr[pernr] || [];
            try {
                if (dryRun) {
                    // Just validate that we can execute
                    successCount += records.length;
                }
                else {
                    // Execute in a transaction per employee
                    await pool.query('BEGIN');
                    try {
                        for (const record of records) {
                            const targetId = await this.importRecord(jobId, record);
                            await pool.query(`
                UPDATE sap_staged_data SET status = 'imported', target_id = $1, processed_at = NOW()
                WHERE id = $2
              `, [targetId, record.id]);
                            successCount++;
                        }
                        await pool.query('COMMIT');
                    }
                    catch (recordError) {
                        await pool.query('ROLLBACK');
                        throw recordError;
                    }
                }
            }
            catch (error) {
                errorCount += records.length;
                const firstRecord = records[0];
                errors.push({
                    pernr,
                    infotype: firstRecord?.infotype || 'UNKNOWN',
                    message: error.message,
                });
                // Mark all records for this PERNR as error
                for (const record of records) {
                    await pool.query(`
            UPDATE sap_staged_data SET status = 'error', validation_errors = validation_errors || $1
            WHERE id = $2
          `, [
                        JSON.stringify([{ field: 'import', message: error.message, code: 'IMPORT_ERROR' }]),
                        record.id,
                    ]);
                }
            }
            processedPernr++;
            if (processedPernr % 10 === 0) {
                await this.updateJobStatus(jobId, 'executing', {
                    progress: 50 + Math.floor((processedPernr / totalPernr) * 45),
                    processedRecords: successCount + errorCount,
                    successCount,
                    errorCount,
                });
            }
        }
        const finalStatus = errorCount === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed');
        await this.updateJobStatus(jobId, finalStatus, {
            progress: 100,
            currentPhase: dryRun ? 'Dry run complete' : 'Migration complete',
            successCount,
            errorCount,
            summary: {
                totalEmployees: totalPernr,
                successfulImports: successCount,
                failedImports: errorCount,
                dryRun,
            },
            errorLog: errors,
        });
        return {
            jobId,
            status: finalStatus,
            totalRecords: stagedResult.rows.length,
            successCount,
            errorCount,
            warningCount: 0,
            skippedCount: 0,
            success: errorCount === 0,
            errors: errors.slice(0, 100), // Limit to first 100 errors
        };
    }
    async importRecord(jobId, record) {
        const mappedData = record.mapped_data;
        const targetTable = record.target_table;
        // Check if employee already exists
        let employeeId = null;
        const mappingResult = await pool.query('SELECT employee_id FROM sap_employee_mapping WHERE pernr = $1 AND tenant_id = $2', [record.pernr, this.tenantId]);
        if (mappingResult.rows.length > 0) {
            employeeId = mappingResult.rows[0].employee_id;
        }
        if (targetTable === 'employees') {
            if (employeeId) {
                // Update existing employee
                const oldData = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
                // Log for rollback
                await this.logRollback(jobId, 'update', 'employees', employeeId, oldData.rows[0], mappedData);
                const setClauses = Object.keys(mappedData)
                    .filter(k => k !== 'id')
                    .map((k, i) => `${k} = $${i + 3}`);
                const values = Object.keys(mappedData)
                    .filter(k => k !== 'id')
                    .map(k => mappedData[k]);
                if (setClauses.length > 0) {
                    await pool.query(`UPDATE employees SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [employeeId, this.tenantId, ...values]);
                }
                return employeeId;
            }
            else {
                // Create new employee
                const fields = Object.keys(mappedData);
                const placeholders = fields.map((_, i) => `$${i + 2}`);
                const values = fields.map(k => mappedData[k]);
                const result = await pool.query(`INSERT INTO employees (tenant_id, ${fields.join(', ')}, created_at, updated_at)
           VALUES ($1, ${placeholders.join(', ')}, NOW(), NOW())
           RETURNING id`, [this.tenantId, ...values]);
                const newEmployeeId = result.rows[0].id;
                // Log for rollback
                await this.logRollback(jobId, 'insert', 'employees', newEmployeeId, null, mappedData);
                // Create PERNR mapping
                await pool.query(`INSERT INTO sap_employee_mapping (tenant_id, pernr, employee_id, last_synced_at)
           VALUES ($1, $2, $3, NOW())`, [this.tenantId, record.pernr, newEmployeeId]);
                return newEmployeeId;
            }
        }
        // Handle other target tables (contracts, etc.)
        throw new Error(`Target table ${targetTable} not yet implemented`);
    }
    async logRollback(jobId, operation, targetTable, targetId, oldData, newData) {
        await pool.query(`
      INSERT INTO sap_migration_rollback_log (tenant_id, job_id, operation, target_table, target_id, old_data, new_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
            this.tenantId,
            jobId,
            operation,
            targetTable,
            targetId,
            oldData ? JSON.stringify(oldData) : null,
            JSON.stringify(newData),
        ]);
    }
    // ---------------------------------------------------------------------------
    // ROLLBACK
    // ---------------------------------------------------------------------------
    async rollbackMigration(jobId) {
        await this.updateJobStatus(jobId, 'executing', { currentPhase: 'Rolling back migration' });
        const rollbackResult = await pool.query('SELECT * FROM sap_migration_rollback_log WHERE job_id = $1 AND tenant_id = $2 AND rolled_back = false ORDER BY created_at DESC', [jobId, this.tenantId]);
        let rolledBackCount = 0;
        let errorCount = 0;
        for (const record of rollbackResult.rows) {
            try {
                await pool.query('BEGIN');
                const validatedTable = validateTableName(record.target_table, 'SAPMigration.rollbackMigration');
                if (record.operation === 'insert') {
                    // Delete the inserted record
                    await pool.query(`DELETE FROM ${validatedTable} WHERE id = $1`, [record.target_id]);
                }
                else if (record.operation === 'update') {
                    // Restore old data
                    const oldData = record.old_data;
                    const setClauses = Object.keys(oldData)
                        .filter(k => k !== 'id' && k !== 'tenant_id')
                        .map((k, i) => `${k} = $${i + 2}`);
                    const values = Object.keys(oldData)
                        .filter(k => k !== 'id' && k !== 'tenant_id')
                        .map(k => oldData[k]);
                    if (setClauses.length > 0) {
                        await pool.query(`UPDATE ${validatedTable} SET ${setClauses.join(', ')} WHERE id = $1`, [record.target_id, ...values]);
                    }
                }
                await pool.query('UPDATE sap_migration_rollback_log SET rolled_back = true, rolled_back_at = NOW() WHERE id = $1', [record.id]);
                await pool.query('COMMIT');
                rolledBackCount++;
            }
            catch {
                await pool.query('ROLLBACK');
                errorCount++;
            }
        }
        // Reset staged data status
        await pool.query('UPDATE sap_staged_data SET status = \'mapped\', target_id = NULL WHERE job_id = $1', [jobId]);
        await this.updateJobStatus(jobId, 'rolled_back', {
            currentPhase: 'Rollback complete',
            summary: { rolledBackCount, errorCount },
        });
        return { rolledBackCount, errorCount };
    }
    // ---------------------------------------------------------------------------
    // DELTA SYNC
    // ---------------------------------------------------------------------------
    async deltaSyncCheck(fileContent, format) {
        if (!fileContent || !format) {
            return { changedRecords: 0, newRecords: 0, deletedRecords: 0 };
        }
        // Parse the file to get current SAP data
        const records = await this.parser.parseExportFile(fileContent, format);
        // Get existing mappings
        const mappingResult = await pool.query('SELECT pernr FROM sap_employee_mapping WHERE tenant_id = $1', [this.tenantId]);
        const existingPernrs = new Set(mappingResult.rows.map(r => r.pernr));
        let newRecords = 0;
        let changedRecords = 0;
        const currentPernrs = new Set();
        for (const record of records) {
            currentPernrs.add(record.pernr);
            if (!existingPernrs.has(record.pernr)) {
                newRecords++;
            }
            else {
                // Would check for changes here by comparing data
                changedRecords++;
            }
        }
        const deletedRecords = [...existingPernrs].filter(p => !currentPernrs.has(p)).length;
        return { changedRecords, newRecords, deletedRecords };
    }
    async executeDeltaSync(fileContent, format) {
        const records = await this.parser.parseExportFile(fileContent, format);
        const mappings = await this.getInfotypeMappings();
        let updatedCount = 0;
        let createdCount = 0;
        const errors = [];
        // Get existing mappings
        const mappingResult = await pool.query('SELECT pernr, employee_id FROM sap_employee_mapping WHERE tenant_id = $1', [this.tenantId]);
        const pernrToEmployee = new Map(mappingResult.rows.map(r => [r.pernr, r.employee_id]));
        for (const record of records) {
            try {
                const employeeId = pernrToEmployee.get(record.pernr);
                const mappedResult = await this.mapRecord(record.infotype, record.data, mappings);
                const validatedTable = validateTableName(mappedResult.targetTable, 'SAPMigration.executeDeltaSync');
                if (employeeId) {
                    // Update existing
                    const setClauses = Object.keys(mappedResult.data)
                        .filter(k => k !== 'id')
                        .map((k, i) => `${k} = $${i + 3}`);
                    const values = Object.keys(mappedResult.data)
                        .filter(k => k !== 'id')
                        .map(k => mappedResult.data[k]);
                    if (setClauses.length > 0) {
                        await pool.query(`UPDATE ${validatedTable} SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [employeeId, this.tenantId, ...values]);
                        updatedCount++;
                    }
                }
                else {
                    // Create new
                    const fields = Object.keys(mappedResult.data);
                    const placeholders = fields.map((_, i) => `$${i + 2}`);
                    const values = fields.map(k => mappedResult.data[k]);
                    const result = await pool.query(`INSERT INTO ${validatedTable} (tenant_id, ${fields.join(', ')}, created_at, updated_at)
             VALUES ($1, ${placeholders.join(', ')}, NOW(), NOW())
             RETURNING id`, [this.tenantId, ...values]);
                    // Create mapping
                    await pool.query(`INSERT INTO sap_employee_mapping (tenant_id, pernr, employee_id, last_synced_at)
             VALUES ($1, $2, $3, NOW())`, [this.tenantId, record.pernr, result.rows[0].id]);
                    createdCount++;
                }
            }
            catch (error) {
                errors.push(`PERNR ${record.pernr}: ${error.message}`);
            }
        }
        // Log the sync
        await this.logDeltaSync({
            recordsChecked: records.length,
            recordsCreated: createdCount,
            recordsUpdated: updatedCount,
            recordsDeleted: 0,
            recordsUnchanged: records.length - createdCount - updatedCount,
            status: errors.length > 0 ? 'completed_with_errors' : 'completed',
            errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        });
        return { updatedCount, createdCount, errors };
    }
    async getDeltaSyncHistory(options) {
        const result = await pool.query(`
      SELECT * FROM sap_delta_sync_log
      WHERE tenant_id = $1
      ORDER BY started_at DESC
      LIMIT $2 OFFSET $3
    `, [this.tenantId, options.limit, options.offset]);
        return result.rows;
    }
    async logDeltaSync(stats) {
        await pool.query(`
      INSERT INTO sap_delta_sync_log (
        tenant_id, sync_type, records_checked, records_created, records_updated,
        records_deleted, records_unchanged, status, error_message
      ) VALUES ($1, 'manual', $2, $3, $4, $5, $6, $7, $8)
    `, [
            this.tenantId,
            stats.recordsChecked,
            stats.recordsCreated,
            stats.recordsUpdated,
            stats.recordsDeleted,
            stats.recordsUnchanged,
            stats.status,
            stats.errorMessage || null,
        ]);
    }
    // ---------------------------------------------------------------------------
    // VALIDATION ERRORS
    // ---------------------------------------------------------------------------
    async getValidationErrors(jobId, options) {
        let query = `
      SELECT id, pernr, infotype, validation_errors, validation_warnings
      FROM sap_staged_data
      WHERE job_id = $1 AND tenant_id = $2
        AND (validation_errors IS NOT NULL OR validation_warnings IS NOT NULL)
    `;
        const params = [jobId, this.tenantId];
        let paramIndex = 3;
        if (options.severity === 'error') {
            query += ` AND validation_errors IS NOT NULL`;
        }
        else if (options.severity === 'warning') {
            query += ` AND validation_warnings IS NOT NULL`;
        }
        query += ` ORDER BY pernr LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(options.limit, options.offset);
        const result = await pool.query(query, params);
        return result.rows;
    }
    // ---------------------------------------------------------------------------
    // MAPPINGS MANAGEMENT
    // ---------------------------------------------------------------------------
    async getMappings(infotype) {
        let query = `
      SELECT * FROM sap_infotype_mappings
      WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true
    `;
        const params = [this.tenantId];
        if (infotype) {
            query += ` AND infotype = $2`;
            params.push(infotype);
        }
        query += ` ORDER BY priority, infotype, sap_field`;
        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            infotype: row.infotype,
            sapField: row.sap_field,
            targetTable: row.target_table,
            targetField: row.target_field,
            transformType: row.transform_type,
            transformConfig: row.transform_config,
            validationRules: row.validation_rules,
            required: row.required,
            defaultValue: row.default_value,
        }));
    }
    async createMapping(mapping) {
        const result = await pool.query(`
      INSERT INTO sap_infotype_mappings (
        tenant_id, infotype, infotype_name, sap_field, target_table, target_field,
        transform_type, transform_config, required, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id
    `, [
            this.tenantId,
            mapping.infotype,
            mapping.infotypeName || null,
            mapping.sapField,
            mapping.targetTable,
            mapping.targetField,
            mapping.transformType,
            mapping.transformConfig ? JSON.stringify(mapping.transformConfig) : null,
            mapping.required,
        ]);
        return result.rows[0].id;
    }
    async updateMapping(mappingId, updates) {
        const setClauses = ['updated_at = NOW()'];
        const values = [mappingId, this.tenantId];
        let paramIndex = 3;
        if (updates.sapField) {
            setClauses.push(`sap_field = $${paramIndex++}`);
            values.push(updates.sapField);
        }
        if (updates.targetField) {
            setClauses.push(`target_field = $${paramIndex++}`);
            values.push(updates.targetField);
        }
        if (updates.transformType) {
            setClauses.push(`transform_type = $${paramIndex++}`);
            values.push(updates.transformType);
        }
        if (updates.transformConfig) {
            setClauses.push(`transform_config = $${paramIndex++}`);
            values.push(JSON.stringify(updates.transformConfig));
        }
        if (updates.required !== undefined) {
            setClauses.push(`required = $${paramIndex++}`);
            values.push(updates.required);
        }
        if (updates.isActive !== undefined) {
            setClauses.push(`is_active = $${paramIndex++}`);
            values.push(updates.isActive);
        }
        await pool.query(`UPDATE sap_infotype_mappings SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2`, values);
    }
    async deleteMapping(mappingId) {
        // Only delete tenant-specific mappings
        await pool.query('DELETE FROM sap_infotype_mappings WHERE id = $1 AND tenant_id = $2', [mappingId, this.tenantId]);
    }
    // ---------------------------------------------------------------------------
    // EMPLOYEE MAPPINGS
    // ---------------------------------------------------------------------------
    async getEmployeeMappings(options) {
        const result = await pool.query(`
      SELECT m.*, e.first_name, e.last_name, e.employee_number
      FROM sap_employee_mapping m
      LEFT JOIN employees e ON m.employee_id = e.id
      WHERE m.tenant_id = $1
      ORDER BY m.pernr
      LIMIT $2 OFFSET $3
    `, [this.tenantId, options.limit, options.offset]);
        return result.rows;
    }
    async createEmployeeMapping(sapPernr, employeeId) {
        await pool.query(`
      INSERT INTO sap_employee_mapping (tenant_id, pernr, employee_id, last_synced_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (tenant_id, pernr) DO UPDATE SET employee_id = $3, last_synced_at = NOW()
    `, [this.tenantId, sapPernr, employeeId]);
    }
    // ---------------------------------------------------------------------------
    // STATISTICS
    // ---------------------------------------------------------------------------
    async getStats() {
        const [jobsResult, stagedResult, mappingsResult, employeeMappingsResult] = await Promise.all([
            pool.query(`
        SELECT
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
          COUNT(*) FILTER (WHERE status IN ('pending', 'parsing', 'validating', 'mapping', 'executing')) as active_jobs
        FROM sap_migration_jobs
        WHERE tenant_id = $1
      `, [this.tenantId]),
            pool.query(`
        SELECT
          COUNT(*) as total_staged,
          COUNT(*) FILTER (WHERE status = 'imported') as imported,
          COUNT(*) FILTER (WHERE status = 'error') as errors
        FROM sap_staged_data
        WHERE tenant_id = $1
      `, [this.tenantId]),
            pool.query(`
        SELECT COUNT(*) as total_mappings
        FROM sap_infotype_mappings
        WHERE tenant_id = $1 OR tenant_id IS NULL
      `, [this.tenantId]),
            pool.query(`
        SELECT COUNT(*) as total_employee_mappings
        FROM sap_employee_mapping
        WHERE tenant_id = $1
      `, [this.tenantId]),
        ]);
        return {
            jobs: jobsResult.rows[0],
            stagedData: stagedResult.rows[0],
            mappings: mappingsResult.rows[0],
            employeeMappings: employeeMappingsResult.rows[0],
        };
    }
    // ---------------------------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------------------------
    async getInfotypeMappings() {
        const result = await pool.query(`
      SELECT * FROM sap_infotype_mappings
      WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true
      ORDER BY priority, infotype, sap_field
    `, [this.tenantId]);
        return result.rows.map(row => ({
            id: row.id,
            infotype: row.infotype,
            sapField: row.sap_field,
            targetTable: row.target_table,
            targetField: row.target_field,
            transformType: row.transform_type,
            transformConfig: row.transform_config,
            validationRules: row.validation_rules,
            required: row.required,
            defaultValue: row.default_value,
        }));
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createSAPMigrationService(tenantId) {
    return new SAPMigrationService(tenantId);
}
export default SAPMigrationService;
//# sourceMappingURL=sap-migration.js.map