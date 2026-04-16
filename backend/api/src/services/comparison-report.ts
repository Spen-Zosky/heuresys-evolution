/**
 * Comparison Report Service
 * Generates field-by-field comparison between employees and employees_staging
 * Part of Org Chart Generation System
 */

import { pool } from '../config/database.js';
import { ChangeType, AssignmentMethod } from './employee-assignment.js';
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface FieldChange {
  fieldName: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  significance: 'high' | 'medium' | 'low';
}

export interface EmployeeComparison {
  employeeId: string;
  stagingId: string;
  employeeName: string;
  employeeEmail: string;
  changeType: ChangeType;
  assignmentMethod: AssignmentMethod;
  assignmentConfidence: number;
  hierarchyLevel: number;
  positionCode: string;
  unitCode: string;
  changes: FieldChange[];
  totalChanges: number;
}

export interface ComparisonSummary {
  totalEmployees: number;
  employeesWithChanges: number;
  employeesUnchanged: number;
  byChangeType: Record<ChangeType, number>;
  byLevel: Record<number, number>;
  byField: Record<string, number>;
  averageConfidence: number;
}

export interface ComparisonReport {
  sessionId: string;
  tenantId: string;
  generatedAt: string;
  summary: ComparisonSummary;
  comparisons: EmployeeComparison[];
}

// =============================================================================
// FIELD METADATA
// =============================================================================

const FIELD_LABELS: Record<string, { label: string; significance: 'high' | 'medium' | 'low' }> = {
  job_title: { label: 'Job Title', significance: 'high' },
  department: { label: 'OrgUnit', significance: 'high' },
  org_unit_id: { label: 'Org Unit ID', significance: 'medium' },
  manager_id: { label: 'Manager', significance: 'high' },
  position_id: { label: 'Position', significance: 'high' },
  cost_center: { label: 'Cost Center', significance: 'medium' },
  cost_center_id: { label: 'Cost Center ID', significance: 'medium' },
  location: { label: 'Location', significance: 'medium' },
  hierarchy_level: { label: 'Hierarchy Level', significance: 'high' },
  employee_group: { label: 'Employee Group', significance: 'low' },
  employee_subgroup: { label: 'Employee Subgroup', significance: 'low' },
};

const COMPARED_FIELDS = Object.keys(FIELD_LABELS);

// =============================================================================
// COMPARISON REPORT SERVICE
// =============================================================================

export class ComparisonReportService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ---------------------------------------------------------------------------
  // GENERATE COMPARISON
  // ---------------------------------------------------------------------------

  /**
   * Generate comparison report for a session
   */
  async generateComparison(sessionId: string): Promise<ComparisonReport> {
    // Get all staging records with original employee data
    // Resolve org_unit_id to actual department names for meaningful comparison
    const result = await pool.query(
      `
      SELECT
        s.id as staging_id,
        s.original_employee_id,
        s.first_name as staging_first_name,
        s.last_name as staging_last_name,
        s.email as staging_email,
        s.job_title as staging_job_title,
        -- Use resolved department names, not the unreliable text fields
        sd.name as staging_department,
        s.org_unit_id as staging_org_unit_id,
        s.org_unit_id as staging_org_unit_id,
        s.manager_id as staging_manager_id,
        s.position_id as staging_position_id,
        scc.name as staging_cost_center,
        s.cost_center_id as staging_cost_center_id,
        s.location as staging_location,
        s.hierarchy_level,
        s.position_code,
        s.unit_code,
        s.original_values,
        s.diff_fields,
        s.change_type,
        s.assignment_method,
        s.assignment_confidence,
        s.reports_to_staging_id,
        -- Original employee data with resolved names
        e.first_name as original_first_name,
        e.last_name as original_last_name,
        e.email as original_email,
        e.job_title as original_job_title,
        od.name as original_department,
        e.org_unit_id as original_org_unit_id,
        e.org_unit_id as original_org_unit_id,
        e.manager_id as original_manager_id,
        e.position_id as original_position_id,
        occ.name as original_cost_center,
        e.cost_center_id as original_cost_center_id,
        ol.name as original_location
      FROM employees_staging s
      LEFT JOIN employees e ON s.original_employee_id = e.id
      -- Resolve staging references
      LEFT JOIN org_units sd ON s.org_unit_id = sd.id
      LEFT JOIN cost_centers scc ON s.cost_center_id = scc.id
      -- Resolve original references
      LEFT JOIN org_units od ON e.org_unit_id = od.id
      LEFT JOIN cost_centers occ ON e.cost_center_id = occ.id
      LEFT JOIN locations ol ON e.location_id = ol.id
      WHERE s.session_id = $1 AND s.tenant_id = $2
      ORDER BY s.hierarchy_level, s.last_name, s.first_name
    `,
      [sessionId, this.tenantId]
    );

    const comparisons: EmployeeComparison[] = [];
    const fieldChangeCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let employeesWithChanges = 0;

    for (const row of result.rows) {
      const changes: FieldChange[] = [];

      // Compare each field
      for (const fieldName of COMPARED_FIELDS) {
        const originalValue = row[`original_${fieldName}`];
        const stagingValue = row[`staging_${fieldName}`];

        // Also check original_values JSONB
        const storedOriginal = row.original_values?.[fieldName];

        if (this.valuesAreDifferent(originalValue || storedOriginal, stagingValue)) {
          const fieldMeta = FIELD_LABELS[fieldName] || { label: fieldName, significance: 'low' };

          changes.push({
            fieldName,
            fieldLabel: fieldMeta.label,
            oldValue: originalValue || storedOriginal || null,
            newValue: stagingValue,
            significance: fieldMeta.significance,
          });

          fieldChangeCounts[fieldName] = (fieldChangeCounts[fieldName] || 0) + 1;
        }
      }

      // Add hierarchy_level as a virtual change (always present)
      changes.push({
        fieldName: 'hierarchy_level',
        fieldLabel: 'Hierarchy Level',
        oldValue: null, // Original didn't have hierarchy_level
        newValue: row.hierarchy_level,
        significance: 'high',
      });

      if (changes.length > 1) {
        // More than just hierarchy_level
        employeesWithChanges++;
      }

      totalConfidence += parseFloat(row.assignment_confidence) || 0;

      comparisons.push({
        employeeId: row.original_employee_id,
        stagingId: row.staging_id,
        employeeName: `${row.staging_first_name} ${row.staging_last_name}`,
        employeeEmail: row.staging_email,
        changeType: row.change_type,
        assignmentMethod: row.assignment_method,
        assignmentConfidence: parseFloat(row.assignment_confidence) || 0,
        hierarchyLevel: row.hierarchy_level,
        positionCode: row.position_code,
        unitCode: row.unit_code,
        changes,
        totalChanges: changes.length - 1, // Exclude hierarchy_level from count
      });
    }

    // Calculate summary
    const summary = await this.calculateSummary(
      sessionId,
      comparisons,
      fieldChangeCounts,
      totalConfidence
    );

    return {
      sessionId,
      tenantId: this.tenantId,
      generatedAt: new Date().toISOString(),
      summary,
      comparisons,
    };
  }

  /**
   * Generate summary statistics
   */
  private async calculateSummary(
    _sessionId: string,
    comparisons: EmployeeComparison[],
    fieldChangeCounts: Record<string, number>,
    totalConfidence: number
  ): Promise<ComparisonSummary> {
    const totalEmployees = comparisons.length;

    // Count by change type
    const byChangeType: Record<ChangeType, number> = {
      unchanged: 0,
      new_position: 0,
      reassignment: 0,
      promotion: 0,
      demotion: 0,
      transfer: 0,
      new_hire_slot: 0,
    };

    // Count by level
    const byLevel: Record<number, number> = {};

    let employeesWithChanges = 0;

    for (const comp of comparisons) {
      byChangeType[comp.changeType] = (byChangeType[comp.changeType] || 0) + 1;
      byLevel[comp.hierarchyLevel] = (byLevel[comp.hierarchyLevel] || 0) + 1;

      if (comp.totalChanges > 0) {
        employeesWithChanges++;
      }
    }

    return {
      totalEmployees,
      employeesWithChanges,
      employeesUnchanged: totalEmployees - employeesWithChanges,
      byChangeType,
      byLevel,
      byField: fieldChangeCounts,
      averageConfidence: totalEmployees > 0 ? totalConfidence / totalEmployees : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // DETAILED COMPARISONS
  // ---------------------------------------------------------------------------

  /**
   * Get comparison for a specific employee
   */
  async getEmployeeComparison(
    sessionId: string,
    employeeId: string
  ): Promise<EmployeeComparison | null> {
    const report = await this.generateComparison(sessionId);
    return report.comparisons.find((c) => c.employeeId === employeeId) || null;
  }

  /**
   * Get comparisons filtered by change type
   */
  async getComparisonsByChangeType(
    sessionId: string,
    changeType: ChangeType
  ): Promise<EmployeeComparison[]> {
    const report = await this.generateComparison(sessionId);
    return report.comparisons.filter((c) => c.changeType === changeType);
  }

  /**
   * Get comparisons filtered by hierarchy level
   */
  async getComparisonsByLevel(sessionId: string, level: number): Promise<EmployeeComparison[]> {
    const report = await this.generateComparison(sessionId);
    return report.comparisons.filter((c) => c.hierarchyLevel === level);
  }

  /**
   * Get only employees with significant changes
   */
  async getSignificantChanges(sessionId: string): Promise<EmployeeComparison[]> {
    const report = await this.generateComparison(sessionId);
    return report.comparisons.filter(
      (c) => c.totalChanges > 0 && c.changes.some((ch) => ch.significance === 'high')
    );
  }

  // ---------------------------------------------------------------------------
  // EXPORT FORMATS
  // ---------------------------------------------------------------------------

  /**
   * Export comparison as CSV
   */
  async exportAsCSV(sessionId: string): Promise<string> {
    const report = await this.generateComparison(sessionId);

    const headers = [
      'Employee ID',
      'Name',
      'Email',
      'Change Type',
      'Level',
      'Position Code',
      'Unit Code',
      'Confidence',
      'Total Changes',
      'Changed Fields',
    ];

    const rows = report.comparisons.map((c) => [
      c.employeeId || '',
      c.employeeName,
      c.employeeEmail,
      c.changeType,
      c.hierarchyLevel.toString(),
      c.positionCode,
      c.unitCode,
      c.assignmentConfidence.toFixed(2),
      c.totalChanges.toString(),
      c.changes.map((ch) => ch.fieldName).join('; '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Export detailed changes as CSV
   */
  async exportDetailedCSV(sessionId: string): Promise<string> {
    const report = await this.generateComparison(sessionId);

    const headers = [
      'Employee ID',
      'Name',
      'Field',
      'Old Value',
      'New Value',
      'Significance',
      'Change Type',
    ];

    const rows: string[][] = [];

    for (const comp of report.comparisons) {
      for (const change of comp.changes) {
        rows.push([
          comp.employeeId || '',
          comp.employeeName,
          change.fieldLabel,
          String(change.oldValue || ''),
          String(change.newValue || ''),
          change.significance,
          comp.changeType,
        ]);
      }
    }

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Export as JSON (full report)
   */
  async exportAsJSON(sessionId: string): Promise<string> {
    const report = await this.generateComparison(sessionId);
    return JSON.stringify(report, null, 2);
  }

  // ---------------------------------------------------------------------------
  // APPROVAL WORKFLOW
  // ---------------------------------------------------------------------------

  /**
   * Approve staging changes for a session
   */
  async approveChanges(
    sessionId: string,
    approvedBy: string
  ): Promise<{ approved: number; failed: number }> {
    let approved = 0;
    let failed = 0;

    // Get all unapproved staging records
    const result = await pool.query(
      `
      SELECT id, original_employee_id
      FROM employees_staging
      WHERE session_id = $1 AND tenant_id = $2 AND is_approved = false
    `,
      [sessionId, this.tenantId]
    );

    for (const row of result.rows) {
      try {
        await pool.query(
          `
          UPDATE employees_staging
          SET is_approved = true, approved_by = $2, approved_at = NOW()
          WHERE id = $1
        `,
          [row.id, approvedBy]
        );
        approved++;
      } catch (error) {
        failed++;
      }
    }

    // Update session status
    if (failed === 0) {
      await pool.query(
        `
        UPDATE org_chart_generation_sessions
        SET status = 'approved'
        WHERE id = $1
      `,
        [sessionId]
      );
    }

    return { approved, failed };
  }

  /**
   * Apply approved changes to employees table
   */
  async applyApprovedChanges(sessionId: string): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    // Get all approved staging records
    const result = await pool.query(
      `
      SELECT
        id,
        original_employee_id,
        job_title,
        department,
        org_unit_id,
        org_unit_id,
        manager_id,
        position_id,
        cost_center,
        cost_center_id,
        reports_to_staging_id
      FROM employees_staging
      WHERE session_id = $1 AND tenant_id = $2 AND is_approved = true
    `,
      [sessionId, this.tenantId]
    );

    // Build mapping of staging_id to original_employee_id for manager resolution
    const stagingToEmployee = new Map<string, string>();
    for (const row of result.rows) {
      if (row.original_employee_id) {
        stagingToEmployee.set(row.id, row.original_employee_id);
      }
    }

    for (const row of result.rows) {
      if (!row.original_employee_id) {
        // Skip records without original employee (new hire slots)
        continue;
      }

      try {
        // Resolve manager_id from staging hierarchy
        let resolvedManagerId = row.manager_id;
        if (row.reports_to_staging_id) {
          resolvedManagerId = stagingToEmployee.get(row.reports_to_staging_id) || row.manager_id;
        }

        await pool.query(
          `
          UPDATE employees
          SET
            job_title = COALESCE($2, job_title),
            department = COALESCE($3, department),
            org_unit_id = COALESCE($4, org_unit_id),
            org_unit_id = COALESCE($5, org_unit_id),
            manager_id = $6,
            position_id = COALESCE($7, position_id),
            cost_center = COALESCE($8, cost_center),
            cost_center_id = COALESCE($9, cost_center_id),
            updated_at = NOW()
          WHERE id = $1 AND tenant_id = $10
        `,
          [
            row.original_employee_id,
            row.job_title,
            row.department,
            row.org_unit_id,
            row.org_unit_id,
            resolvedManagerId,
            row.position_id,
            row.cost_center,
            row.cost_center_id,
            this.tenantId,
          ]
        );

        updated++;
      } catch (error) {
        logger.error(`Failed to update employee ${row.original_employee_id}:${error}`);
        failed++;
      }
    }

    return { updated, failed };
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private valuesAreDifferent(oldValue: any, newValue: any): boolean {
    // Handle null/undefined
    if (oldValue == null && newValue == null) return false;
    if (oldValue == null || newValue == null) return true;

    // Handle UUIDs (case-insensitive comparison)
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(oldValue) && uuidRegex.test(newValue)) {
        return oldValue.toLowerCase() !== newValue.toLowerCase();
      }
    }

    // String comparison (trim and case-insensitive for titles)
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return oldValue.trim().toLowerCase() !== newValue.trim().toLowerCase();
    }

    // Default comparison
    return oldValue !== newValue;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createComparisonReportService(tenantId: string): ComparisonReportService {
  return new ComparisonReportService(tenantId);
}

export default ComparisonReportService;
