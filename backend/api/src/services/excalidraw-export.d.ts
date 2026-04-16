/**
 * Excalidraw Export Service
 * Converts org chart structures to Excalidraw format for visual editing
 * Part of Org Chart Generation System
 */
import { OrgUnit, OrgPosition } from './org-chart-generator.js';
export interface ExcalidrawElement {
    id: string;
    type: 'rectangle' | 'text' | 'arrow' | 'line' | 'ellipse';
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: 'solid' | 'hachure' | 'cross-hatch';
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    roughness: number;
    opacity: number;
    groupIds: string[];
    roundness: {
        type: number;
        value?: number;
    } | null;
    seed: number;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    boundElements: {
        id: string;
        type: string;
    }[] | null;
    updated: number;
    link: string | null;
    locked: boolean;
    text?: string;
    fontSize?: number;
    fontFamily?: number;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    containerId?: string | null;
    originalText?: string;
    startBinding?: {
        elementId: string;
        focus: number;
        gap: number;
    } | null;
    endBinding?: {
        elementId: string;
        focus: number;
        gap: number;
    } | null;
    points?: [number, number][];
    lastCommittedPoint?: [number, number] | null;
    startArrowhead?: 'arrow' | null;
    endArrowhead?: 'arrow' | null;
}
export interface ExcalidrawAppState {
    viewBackgroundColor: string;
    currentItemFontFamily: number;
    currentItemFontSize: number;
    gridSize: number | null;
}
export interface ExcalidrawFile {
    type: 'excalidraw';
    version: number;
    source: string;
    elements: ExcalidrawElement[];
    appState: ExcalidrawAppState;
    files: Record<string, any>;
}
export interface TreeNode {
    code: string;
    name: string;
    level: number;
    type: 'unit' | 'position';
    data: OrgUnit | OrgPosition | null;
    employeeName?: string | undefined;
    employeeTitle?: string | undefined;
    children: TreeNode[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
export declare class ExcalidrawExportService {
    private tenantId;
    private elementCounter;
    private seed;
    constructor(tenantId: string);
    /**
     * Export org chart to Excalidraw format
     */
    exportToExcalidraw(sessionId: string, includeEmployees?: boolean): Promise<ExcalidrawFile>;
    /**
     * Export from staging data
     */
    exportStagingToExcalidraw(sessionId: string): Promise<ExcalidrawFile>;
    private getSession;
    private buildTreeFromOrgChart;
    private buildTreeWithEmployees;
    private buildTreeFromStaging;
    private calculateLayout;
    private shiftSubtree;
    private generateElements;
    private getTreeBounds;
    private generateNodeElements;
    /**
     * Save Excalidraw export as snapshot
     */
    saveSnapshot(sessionId: string, snapshotName: string, snapshotType: 'prototype' | 'real' | 'staging' | 'final', excalidrawFile: ExcalidrawFile, treeStructure?: any): Promise<string>;
    /**
     * Get snapshot by ID
     */
    getSnapshot(snapshotId: string): Promise<{
        id: string;
        sessionId: string;
        snapshotName: string;
        snapshotType: string;
        excalidrawFormat: ExcalidrawFile;
    } | null>;
    private generateId;
    private nextSeed;
}
export declare function createExcalidrawExportService(tenantId: string): ExcalidrawExportService;
export default ExcalidrawExportService;
//# sourceMappingURL=excalidraw-export.d.ts.map