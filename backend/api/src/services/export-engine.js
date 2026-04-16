/**
 * Export Engine Service
 * Generates Excel (.xlsx) and PDF reports for blueprint results,
 * skill gap analysis, org chart, and skill inventory.
 * Horizon O2.3
 */
import ExcelJS from 'exceljs';
import PDFGenerator from './pdf-generator.js';
// =============================================================================
// Excel Styling Constants
// =============================================================================
const HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
};
const HEADER_FONT = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
};
const SEVERITY_COLORS = {
    critical: 'FFDC2626',
    action_required: 'FFD97706',
    warning: 'FFF59E0B',
    info: 'FF3B82F6',
};
function styleHeaderRow(sheet) {
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 28;
}
// =============================================================================
// ExportEngineService
// =============================================================================
export class ExportEngineService {
    dbClient;
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    // ---------------------------------------------------------------------------
    // Blueprint Report
    // ---------------------------------------------------------------------------
    async exportBlueprintReport(runId, format) {
        const runResult = await this.dbClient.query(`SELECT br.*, bt.template_name
       FROM blueprint_runs br
       LEFT JOIN blueprint_templates bt ON bt.id = br.template_id
       WHERE br.id = $1`, [runId]);
        if (runResult.rows.length === 0) {
            throw new Error('Blueprint run not found');
        }
        const run = runResult.rows[0];
        const resultsResult = await this.dbClient.query(`SELECT id, result_type, entity_type, severity, title, description,
              is_applied, applied_at, created_at
       FROM blueprint_results
       WHERE run_id = $1
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'action_required' THEN 2
           WHEN 'warning' THEN 3
           WHEN 'info' THEN 4
           ELSE 5
         END,
         created_at`, [runId]);
        const results = resultsResult.rows;
        const summaryResult = await this.dbClient.query(`SELECT severity, COUNT(*)::int AS count
       FROM blueprint_results WHERE run_id = $1
       GROUP BY severity`, [runId]);
        const summary = {};
        for (const row of summaryResult.rows) {
            summary[row.severity ?? 'unknown'] = row.count;
        }
        if (format === 'pdf') {
            return this.blueprintToPdf(run, results, summary);
        }
        return this.blueprintToXlsx(run, results, summary);
    }
    async blueprintToXlsx(run, results, summary) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heuresys Platform';
        wb.created = new Date();
        // Summary sheet
        const summarySheet = wb.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Campo', key: 'field', width: 25 },
            { header: 'Valore', key: 'value', width: 40 },
        ];
        summarySheet.addRows([
            { field: 'Run ID', value: run.id },
            { field: 'Template', value: run.template_name ?? run.template_id },
            { field: 'Modalità', value: run.run_mode },
            { field: 'Stato', value: run.status },
            {
                field: 'Creato il',
                value: run.created_at ? new Date(run.created_at).toLocaleString('it-IT') : '-',
            },
            {
                field: 'Completato il',
                value: run.completed_at ? new Date(run.completed_at).toLocaleString('it-IT') : '-',
            },
            { field: 'Totale risultati', value: results.length },
            ...Object.entries(summary).map(([sev, count]) => ({
                field: `Severità: ${sev}`,
                value: count,
            })),
        ]);
        styleHeaderRow(summarySheet);
        // Results sheet
        const resSheet = wb.addWorksheet('Results');
        resSheet.columns = [
            { header: 'Tipo', key: 'result_type', width: 20 },
            { header: 'Severità', key: 'severity', width: 15 },
            { header: 'Titolo', key: 'title', width: 40 },
            { header: 'Descrizione', key: 'description', width: 50 },
            { header: 'Entità', key: 'entity_type', width: 20 },
            { header: 'Applicato', key: 'is_applied', width: 12 },
            { header: 'Data', key: 'created_at', width: 20 },
        ];
        for (const r of results) {
            const row = resSheet.addRow({
                result_type: r.result_type,
                severity: r.severity,
                title: r.title,
                description: r.description,
                entity_type: r.entity_type ?? '-',
                is_applied: r.is_applied ? 'Sì' : 'No',
                created_at: r.created_at ? new Date(r.created_at).toLocaleString('it-IT') : '-',
            });
            const severityColor = SEVERITY_COLORS[r.severity];
            if (severityColor) {
                row.getCell('severity').fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: severityColor },
                };
                row.getCell('severity').font = { color: { argb: 'FFFFFFFF' }, bold: true };
            }
        }
        styleHeaderRow(resSheet);
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    blueprintToPdf(run, results, summary) {
        const pdf = new PDFGenerator({
            title: 'Blueprint Report',
            subtitle: `Run: ${run.template_name ?? run.template_id} (${run.run_mode})`,
            orientation: 'landscape',
        });
        pdf.addHeader();
        pdf.addSectionTitle('Riepilogo Run');
        pdf.addSummary([
            { label: 'Stato', value: run.status },
            { label: 'Modalità', value: run.run_mode },
            { label: 'Totale risultati', value: results.length },
            ...Object.entries(summary).map(([sev, count]) => ({
                label: `Severità ${sev}`,
                value: count,
            })),
        ]);
        if (results.length > 0) {
            pdf.addSectionTitle('Risultati');
            const columns = [
                { header: 'Tipo', key: 'result_type', width: 100 },
                { header: 'Severità', key: 'severity', width: 80 },
                { header: 'Titolo', key: 'title', width: 250 },
                { header: 'Entità', key: 'entity_type', width: 100 },
                { header: 'Applicato', key: 'is_applied', width: 60 },
            ];
            pdf.addTable(columns, results.map((r) => ({
                ...r,
                entity_type: r.entity_type ?? '-',
                is_applied: r.is_applied ? 'Sì' : 'No',
            })));
        }
        return pdf.generate();
    }
    // ---------------------------------------------------------------------------
    // Skill Gap Report (per org unit)
    // ---------------------------------------------------------------------------
    async exportSkillGapReport(orgUnitId, format) {
        const orgResult = await this.dbClient.query(`SELECT id, name, code, org_type FROM org_units WHERE id = $1`, [orgUnitId]);
        if (orgResult.rows.length === 0) {
            throw new Error('Org unit not found');
        }
        const orgUnit = orgResult.rows[0];
        // Employees in this org unit with their skill profiles
        const gapResult = await this.dbClient.query(`SELECT
         e.first_name || ' ' || e.last_name AS employee_name,
         e.job_title,
         es.preferred_label AS skill_name,
         esp.composite_score AS current_score,
         NULL::numeric AS required_score,
         NULL::numeric AS gap,
         esp.verification_status,
         NULL AS importance
       FROM employees e
       JOIN employee_skill_profiles esp ON esp.employee_id = e.id AND esp.tenant_id = e.tenant_id
       JOIN esco_skills es ON es.id = esp.skill_id
       WHERE e.org_unit_id = $1
       ORDER BY e.last_name, e.first_name, esp.composite_score DESC NULLS LAST`, [orgUnitId]);
        const rows = gapResult.rows;
        if (format === 'pdf') {
            return this.skillGapToPdf(orgUnit, rows);
        }
        return this.skillGapToXlsx(orgUnit, rows);
    }
    async skillGapToXlsx(orgUnit, rows) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heuresys Platform';
        wb.created = new Date();
        const sheet = wb.addWorksheet('Skill Gap');
        sheet.columns = [
            { header: 'Dipendente', key: 'employee_name', width: 25 },
            { header: 'Ruolo', key: 'job_title', width: 25 },
            { header: 'Skill', key: 'skill_name', width: 35 },
            { header: 'Score Attuale', key: 'current_score', width: 15 },
            { header: 'Score Richiesto', key: 'required_score', width: 16 },
            { header: 'Gap', key: 'gap', width: 10 },
            { header: 'Importanza', key: 'importance', width: 14 },
            { header: 'Stato Verifica', key: 'verification_status', width: 16 },
        ];
        for (const r of rows) {
            const row = sheet.addRow({
                employee_name: r.employee_name,
                job_title: r.job_title ?? '-',
                skill_name: r.skill_name,
                current_score: parseFloat(r.current_score) || 0,
                required_score: r.required_score != null ? parseFloat(r.required_score) : '-',
                gap: r.gap != null ? parseFloat(r.gap) : '-',
                importance: r.importance ?? '-',
                verification_status: r.verification_status,
            });
            // Highlight negative gaps in red
            if (r.gap != null && parseFloat(r.gap) < 0) {
                row.getCell('gap').font = { color: { argb: 'FFDC2626' }, bold: true };
            }
        }
        styleHeaderRow(sheet);
        // Add org unit info row at top (insert before data)
        sheet.insertRow(1, [`Org Unit: ${orgUnit.name} (${orgUnit.code}) — Tipo: ${orgUnit.org_type}`]);
        sheet.mergeCells(1, 1, 1, 8);
        sheet.getRow(1).font = { bold: true, size: 12 };
        sheet.getRow(1).height = 24;
        // Re-style header (now row 2)
        const headerRow = sheet.getRow(2);
        headerRow.eachCell((cell) => {
            cell.fill = HEADER_FILL;
            cell.font = HEADER_FONT;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        headerRow.height = 28;
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    skillGapToPdf(orgUnit, rows) {
        const pdf = new PDFGenerator({
            title: 'Skill Gap Analysis',
            subtitle: `${orgUnit.name} (${orgUnit.code})`,
            orientation: 'landscape',
        });
        pdf.addHeader();
        const negativeGaps = rows.filter((r) => r.gap != null && parseFloat(r.gap) < 0);
        pdf.addSectionTitle('Riepilogo');
        pdf.addSummary([
            { label: 'Org Unit', value: `${orgUnit.name} (${orgUnit.org_type})` },
            { label: 'Totale righe', value: rows.length },
            { label: 'Gap negativi', value: negativeGaps.length },
        ]);
        if (rows.length > 0) {
            pdf.addSectionTitle('Dettaglio Gap');
            const columns = [
                { header: 'Dipendente', key: 'employee_name', width: 120 },
                { header: 'Skill', key: 'skill_name', width: 150 },
                { header: 'Attuale', key: 'current_score', width: 60, align: 'right', format: 'number' },
                { header: 'Richiesto', key: 'required_score', width: 70, align: 'right' },
                { header: 'Gap', key: 'gap', width: 60, align: 'right' },
                { header: 'Importanza', key: 'importance', width: 80 },
            ];
            pdf.addTable(columns, rows.map((r) => ({
                ...r,
                current_score: parseFloat(r.current_score) || 0,
                required_score: r.required_score != null ? parseFloat(r.required_score) : '-',
                gap: r.gap != null ? parseFloat(r.gap) : '-',
                importance: r.importance ?? '-',
            })));
        }
        return pdf.generate();
    }
    // ---------------------------------------------------------------------------
    // Org Chart
    // ---------------------------------------------------------------------------
    async exportOrgChart(format) {
        const result = await this.dbClient.query(`SELECT
         ou.id, ou.code, ou.name, ou.org_type, ou.org_level,
         ou.is_active, ou.headcount_budget,
         p.name AS parent_name, p.code AS parent_code,
         mgr.first_name || ' ' || mgr.last_name AS manager_name,
         (SELECT COUNT(*)::int FROM employees e WHERE e.org_unit_id = ou.id) AS employee_count
       FROM org_units ou
       LEFT JOIN org_units p ON p.id = ou.parent_id
       LEFT JOIN employees mgr ON mgr.id = ou.manager_id
       ORDER BY ou.org_level, ou.sort_order, ou.name`);
        const rows = result.rows;
        if (format === 'pdf') {
            return this.orgChartToPdf(rows);
        }
        return this.orgChartToXlsx(rows);
    }
    async orgChartToXlsx(rows) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heuresys Platform';
        wb.created = new Date();
        const sheet = wb.addWorksheet('Org Chart');
        sheet.columns = [
            { header: 'Codice', key: 'code', width: 15 },
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'Tipo', key: 'org_type', width: 15 },
            { header: 'Livello', key: 'org_level', width: 10 },
            { header: 'Parent', key: 'parent_name', width: 25 },
            { header: 'Manager', key: 'manager_name', width: 25 },
            { header: 'Dipendenti', key: 'employee_count', width: 14 },
            { header: 'Budget HC', key: 'headcount_budget', width: 12 },
            { header: 'Attivo', key: 'is_active', width: 10 },
        ];
        for (const r of rows) {
            sheet.addRow({
                code: r.code,
                name: '  '.repeat(r.org_level - 1) + r.name,
                org_type: r.org_type ?? '-',
                org_level: r.org_level,
                parent_name: r.parent_name ?? '-',
                manager_name: r.manager_name ?? '-',
                employee_count: r.employee_count,
                headcount_budget: r.headcount_budget ?? '-',
                is_active: r.is_active ? 'Sì' : 'No',
            });
        }
        styleHeaderRow(sheet);
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    orgChartToPdf(rows) {
        const pdf = new PDFGenerator({
            title: 'Organigramma',
            subtitle: 'Struttura Organizzativa',
            orientation: 'landscape',
        });
        pdf.addHeader();
        const totalEmployees = rows.reduce((sum, r) => sum + (r.employee_count || 0), 0);
        pdf.addSectionTitle('Riepilogo');
        pdf.addSummary([
            { label: 'Unità organizzative', value: rows.length },
            { label: 'Dipendenti totali', value: totalEmployees },
            { label: 'Unità attive', value: rows.filter((r) => r.is_active).length },
        ]);
        pdf.addSectionTitle('Struttura');
        const columns = [
            { header: 'Codice', key: 'code', width: 70 },
            { header: 'Nome', key: 'name', width: 180 },
            { header: 'Tipo', key: 'org_type', width: 80 },
            { header: 'Lv', key: 'org_level', width: 30, align: 'center' },
            { header: 'Parent', key: 'parent_name', width: 120 },
            { header: 'Manager', key: 'manager_name', width: 120 },
            { header: 'Dip.', key: 'employee_count', width: 40, align: 'right', format: 'number' },
        ];
        pdf.addTable(columns, rows.map((r) => ({
            ...r,
            name: '  '.repeat(r.org_level - 1) + r.name,
            org_type: r.org_type ?? '-',
            parent_name: r.parent_name ?? '-',
            manager_name: r.manager_name ?? '-',
        })));
        return pdf.generate();
    }
    // ---------------------------------------------------------------------------
    // Skill Inventory
    // ---------------------------------------------------------------------------
    async exportSkillInventory(filters = {}, format) {
        const conditions = [];
        const params = [];
        let idx = 1;
        if (filters.orgUnitId) {
            conditions.push(`e.org_unit_id = $${idx++}`);
            params.push(filters.orgUnitId);
        }
        if (filters.verificationStatus) {
            conditions.push(`esp.verification_status = $${idx++}`);
            params.push(filters.verificationStatus);
        }
        if (filters.minCompositeScore != null) {
            conditions.push(`esp.composite_score >= $${idx++}`);
            params.push(filters.minCompositeScore);
        }
        if (filters.skillType) {
            conditions.push(`es.skill_type = $${idx++}`);
            params.push(filters.skillType);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.min(filters.limit ?? 5000, 10000);
        const offset = filters.offset ?? 0;
        const result = await this.dbClient.query(`SELECT
         e.first_name || ' ' || e.last_name AS employee_name,
         e.job_title,
         ou.name AS org_unit_name,
         es.preferred_label AS skill_name,
         es.skill_type,
         esp.composite_score,
         esp.knowledge_level,
         esp.skill_level,
         esp.ability_level,
         esp.source,
         esp.verification_status,
         esp.is_primary,
         esp.acquired_date
       FROM employee_skill_profiles esp
       JOIN employees e ON e.id = esp.employee_id AND e.tenant_id = esp.tenant_id
       JOIN esco_skills es ON es.id = esp.skill_id
       LEFT JOIN org_units ou ON ou.id = e.org_unit_id
       ${whereClause}
       ORDER BY e.last_name, e.first_name, esp.composite_score DESC
       LIMIT $${idx++} OFFSET $${idx}`, [...params, limit, offset]);
        const rows = result.rows;
        if (format === 'pdf') {
            return this.skillInventoryToPdf(rows, filters);
        }
        return this.skillInventoryToXlsx(rows, filters);
    }
    async skillInventoryToXlsx(rows, filters) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heuresys Platform';
        wb.created = new Date();
        const sheet = wb.addWorksheet('Skill Inventory');
        sheet.columns = [
            { header: 'Dipendente', key: 'employee_name', width: 25 },
            { header: 'Ruolo', key: 'job_title', width: 25 },
            { header: 'Org Unit', key: 'org_unit_name', width: 25 },
            { header: 'Skill', key: 'skill_name', width: 35 },
            { header: 'Tipo Skill', key: 'skill_type', width: 15 },
            { header: 'Score', key: 'composite_score', width: 10 },
            { header: 'K', key: 'knowledge_level', width: 6 },
            { header: 'S', key: 'skill_level', width: 6 },
            { header: 'A', key: 'ability_level', width: 6 },
            { header: 'Fonte', key: 'source', width: 18 },
            { header: 'Verifica', key: 'verification_status', width: 14 },
            { header: 'Primaria', key: 'is_primary', width: 10 },
            { header: 'Acquisita il', key: 'acquired_date', width: 14 },
        ];
        for (const r of rows) {
            sheet.addRow({
                employee_name: r.employee_name,
                job_title: r.job_title ?? '-',
                org_unit_name: r.org_unit_name ?? '-',
                skill_name: r.skill_name,
                skill_type: r.skill_type ?? '-',
                composite_score: parseFloat(r.composite_score) || 0,
                knowledge_level: r.knowledge_level,
                skill_level: r.skill_level,
                ability_level: r.ability_level,
                source: r.source,
                verification_status: r.verification_status,
                is_primary: r.is_primary ? 'Sì' : 'No',
                acquired_date: r.acquired_date
                    ? new Date(r.acquired_date).toLocaleDateString('it-IT')
                    : '-',
            });
        }
        styleHeaderRow(sheet);
        // Add filter info row at top
        const filterParts = ['Skill Inventory'];
        if (filters.orgUnitId)
            filterParts.push(`Org Unit: ${filters.orgUnitId}`);
        if (filters.verificationStatus)
            filterParts.push(`Verifica: ${filters.verificationStatus}`);
        if (filters.minCompositeScore != null)
            filterParts.push(`Score min: ${filters.minCompositeScore}`);
        if (filters.skillType)
            filterParts.push(`Tipo: ${filters.skillType}`);
        sheet.insertRow(1, [filterParts.join(' | ')]);
        sheet.mergeCells(1, 1, 1, 13);
        sheet.getRow(1).font = { bold: true, size: 12 };
        sheet.getRow(1).height = 24;
        const headerRow = sheet.getRow(2);
        headerRow.eachCell((cell) => {
            cell.fill = HEADER_FILL;
            cell.font = HEADER_FONT;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        headerRow.height = 28;
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    skillInventoryToPdf(rows, filters) {
        const pdf = new PDFGenerator({
            title: 'Skill Inventory',
            subtitle: 'Inventario Competenze',
            orientation: 'landscape',
        });
        pdf.addHeader();
        const activeFilters = [
            { label: 'Totale righe', value: rows.length },
        ];
        if (filters.orgUnitId)
            activeFilters.push({ label: 'Org Unit ID', value: filters.orgUnitId });
        if (filters.verificationStatus)
            activeFilters.push({ label: 'Stato verifica', value: filters.verificationStatus });
        if (filters.minCompositeScore != null)
            activeFilters.push({ label: 'Score minimo', value: filters.minCompositeScore });
        if (filters.skillType)
            activeFilters.push({ label: 'Tipo skill', value: filters.skillType });
        pdf.addSectionTitle('Filtri applicati');
        pdf.addSummary(activeFilters);
        if (rows.length > 0) {
            pdf.addSectionTitle('Inventario');
            const columns = [
                { header: 'Dipendente', key: 'employee_name', width: 120 },
                { header: 'Org Unit', key: 'org_unit_name', width: 100 },
                { header: 'Skill', key: 'skill_name', width: 150 },
                { header: 'Score', key: 'composite_score', width: 50, align: 'right', format: 'number' },
                { header: 'K', key: 'knowledge_level', width: 30, align: 'center' },
                { header: 'S', key: 'skill_level', width: 30, align: 'center' },
                { header: 'A', key: 'ability_level', width: 30, align: 'center' },
                { header: 'Verifica', key: 'verification_status', width: 80 },
            ];
            pdf.addTable(columns, rows.map((r) => ({
                ...r,
                org_unit_name: r.org_unit_name ?? '-',
                composite_score: parseFloat(r.composite_score) || 0,
            })));
        }
        return pdf.generate();
    }
}
//# sourceMappingURL=export-engine.js.map