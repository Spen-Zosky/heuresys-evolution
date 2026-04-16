/**
 * Employee Assignment Service
 * Maps real employees to positions in generated org chart
 * Creates employees_staging records with change tracking
 * Part of Org Chart Generation System
 */
import { GeneratedOrgChart, OrgPosition, OrgUnit } from './org-chart-generator.js';
export type AssignmentMethod = 'job_title_match' | 'org_unit_match' | 'manager_chain' | 'manual' | 'ai_suggested' | 'esco_match';
export type ChangeType = 'unchanged' | 'new_position' | 'reassignment' | 'promotion' | 'demotion' | 'transfer' | 'new_hire_slot';
export interface EmployeeData {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    orgUnitId: string | null;
    managerId: string | null;
    isActive: boolean;
    [key: string]: any;
}
export interface StagingRecord {
    id: string;
    sessionId: string;
    originalEmployeeId: string | null;
    positionCode: string;
    unitCode: string;
    hierarchyLevel: number;
    reportsToStagingId: string | null;
    originalValues: Record<string, any>;
    diffFields: string[];
    changeType: ChangeType;
    assignmentMethod: AssignmentMethod;
    assignmentConfidence: number;
    assignmentNotes: string | null;
}
export interface AssignmentResult {
    sessionId: string;
    totalEmployees: number;
    assigned: number;
    vacantPositions: number;
    byChangeType: Record<ChangeType, number>;
    byMethod: Record<AssignmentMethod, number>;
    byLevel: Record<number, number>;
}
export interface PositionSlot {
    position: OrgPosition;
    unit: OrgUnit;
    remainingSlots: number;
    assignedEmployees: string[];
}
export declare class EmployeeAssignmentService {
    private tenantId;
    constructor(tenantId: string);
    /**
     * Assign all employees to positions in the generated org chart
     */
    assignEmployeesToPositions(sessionId: string, orgChart: GeneratedOrgChart): Promise<AssignmentResult>;
    private getEmployees;
    private buildPositionSlots;
    /**
     * Phase 1: Assign based on existing manager chain
     * Identifies employees who are managers (have direct reports) and assigns them to manager positions
     */
    private assignByManagerChain;
    /**
     * Phase 2: Assign by job title similarity
     */
    private assignByJobTitle;
    /**
     * Phase 3: Assign by department
     */
    private assignByDepartment;
    /**
     * Phase 4: Assign remaining employees to level 7 (staff) positions
     */
    private assignRemainingToStaff;
    private createStagingRecord;
    /**
     * Set reports_to_staging_id based on position hierarchy
     */
    private buildStagingHierarchy;
    private estimateLevelFromReports;
    private findBestManagerSlot;
    private findSlotByTitleSimilarity;
    private findSlotByDepartment;
    private orgUnitsMatch;
    private determineChangeType;
    private calculateDiffFields;
    private calculateTitleMatchConfidence;
    private calculateAssignmentStats;
}
export declare function createEmployeeAssignmentService(tenantId: string): EmployeeAssignmentService;
export default EmployeeAssignmentService;
//# sourceMappingURL=employee-assignment.d.ts.map