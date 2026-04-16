/**
 * Comparison Report Service
 * Generates field-by-field comparison between employees and employees_staging
 * Part of Org Chart Generation System
 */
import { ChangeType, AssignmentMethod } from './employee-assignment.js';
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
export declare class ComparisonReportService {
    private tenantId;
    constructor(tenantId: string);
    /**
     * Generate comparison report for a session
     */
    generateComparison(sessionId: string): Promise<ComparisonReport>;
    /**
     * Generate summary statistics
     */
    private calculateSummary;
    /**
     * Get comparison for a specific employee
     */
    getEmployeeComparison(sessionId: string, employeeId: string): Promise<EmployeeComparison | null>;
    /**
     * Get comparisons filtered by change type
     */
    getComparisonsByChangeType(sessionId: string, changeType: ChangeType): Promise<EmployeeComparison[]>;
    /**
     * Get comparisons filtered by hierarchy level
     */
    getComparisonsByLevel(sessionId: string, level: number): Promise<EmployeeComparison[]>;
    /**
     * Get only employees with significant changes
     */
    getSignificantChanges(sessionId: string): Promise<EmployeeComparison[]>;
    /**
     * Export comparison as CSV
     */
    exportAsCSV(sessionId: string): Promise<string>;
    /**
     * Export detailed changes as CSV
     */
    exportDetailedCSV(sessionId: string): Promise<string>;
    /**
     * Export as JSON (full report)
     */
    exportAsJSON(sessionId: string): Promise<string>;
    /**
     * Approve staging changes for a session
     */
    approveChanges(sessionId: string, approvedBy: string): Promise<{
        approved: number;
        failed: number;
    }>;
    /**
     * Apply approved changes to employees table
     */
    applyApprovedChanges(sessionId: string): Promise<{
        updated: number;
        failed: number;
    }>;
    private valuesAreDifferent;
}
export declare function createComparisonReportService(tenantId: string): ComparisonReportService;
export default ComparisonReportService;
//# sourceMappingURL=comparison-report.d.ts.map