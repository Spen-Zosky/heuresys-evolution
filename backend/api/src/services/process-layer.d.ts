/**
 * Process Layer Service
 * CRUD operations for process phases, roles, skill requirements, KPIs, and blueprint templates.
 * Uses req.dbClient (PoolClient with tenant context) for RLS enforcement.
 */
import { PoolClient } from 'pg';
import type { ProcessPhase, ProcessRole, ProcessSkillRequirement, ProcessKpi, BlueprintTemplate } from './business-process-research.js';
export interface CreatePhaseInput {
    phaseCode: string;
    phaseName: string;
    phaseOrder: number;
    description?: string;
    estimatedDurationDays?: number;
    isOptional?: boolean;
}
export type UpdatePhaseInput = Partial<CreatePhaseInput>;
export interface CreateRoleInput {
    roleName: string;
    roleType: 'owner' | 'executor' | 'approver' | 'reviewer' | 'informed';
    phaseId?: string;
    escoOccupationId?: string;
    minHeadcount?: number;
    maxHeadcount?: number;
    description?: string;
}
export type UpdateRoleInput = Partial<CreateRoleInput>;
export interface CreateSkillReqInput {
    escoSkillId: string;
    phaseId?: string;
    proficiencyLevel: number;
    isMandatory?: boolean;
    description?: string;
}
export type UpdateSkillReqInput = Partial<CreateSkillReqInput>;
export interface CreateKpiInput {
    kpiCode: string;
    kpiName: string;
    phaseId?: string;
    measurementUnit?: string;
    targetDirection?: 'higher_better' | 'lower_better' | 'target_range';
    benchmarkValue?: number;
    benchmarkMin?: number;
    benchmarkMax?: number;
    description?: string;
}
export type UpdateKpiInput = Partial<CreateKpiInput>;
export interface ProcessListItem {
    id: string;
    processCode: string;
    processName: string;
    processCategory: string;
    valueChainPosition: number;
    description: string | null;
    phaseCount: number;
    roleCount: number;
    skillCount: number;
    kpiCount: number;
}
export interface ProcessDetail {
    process: {
        id: string;
        profileId: string;
        processCode: string;
        processName: string;
        processCategory: string;
        valueChainPosition: number;
        description: string | null;
    };
    phases: ProcessPhase[];
    roles: ProcessRole[];
    skillRequirements: ProcessSkillRequirement[];
    kpis: ProcessKpi[];
}
export declare class ProcessLayerService {
    private dbClient;
    constructor(dbClient: PoolClient);
    listProcesses(category?: string, search?: string): Promise<ProcessListItem[]>;
    getPhasesByProcess(processId: string): Promise<ProcessPhase[]>;
    createPhase(processId: string, data: CreatePhaseInput): Promise<ProcessPhase>;
    updatePhase(phaseId: string, data: UpdatePhaseInput): Promise<ProcessPhase>;
    deletePhase(phaseId: string): Promise<void>;
    getRolesByProcess(processId: string): Promise<ProcessRole[]>;
    createRole(processId: string, data: CreateRoleInput): Promise<ProcessRole>;
    updateRole(roleId: string, data: UpdateRoleInput): Promise<ProcessRole>;
    deleteRole(roleId: string): Promise<void>;
    getSkillRequirementsByProcess(processId: string): Promise<ProcessSkillRequirement[]>;
    createSkillRequirement(processId: string, data: CreateSkillReqInput): Promise<ProcessSkillRequirement>;
    updateSkillRequirement(reqId: string, data: UpdateSkillReqInput): Promise<ProcessSkillRequirement>;
    deleteSkillRequirement(reqId: string): Promise<void>;
    getKpisByProcess(processId: string): Promise<ProcessKpi[]>;
    createKpi(processId: string, data: CreateKpiInput): Promise<ProcessKpi>;
    updateKpi(kpiId: string, data: UpdateKpiInput): Promise<ProcessKpi>;
    deleteKpi(kpiId: string): Promise<void>;
    getTemplates(profileId?: string): Promise<BlueprintTemplate[]>;
    getTemplateById(templateId: string): Promise<BlueprintTemplate | null>;
    getProcessDetail(processId: string): Promise<ProcessDetail | null>;
    private mapPhase;
    private mapRole;
    private mapSkillRequirement;
    private mapKpi;
    private mapTemplate;
}
//# sourceMappingURL=process-layer.d.ts.map