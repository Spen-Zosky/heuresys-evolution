/**
 * Excalidraw Export Service
 * Converts org chart structures to Excalidraw format for visual editing
 * Part of Org Chart Generation System
 */

import { pool } from '../config/database.js';
import { GeneratedOrgChart, OrgUnit, OrgPosition } from './org-chart-generator.js';

// =============================================================================
// TYPES
// =============================================================================

// Excalidraw element types
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
  roundness: { type: number; value?: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: string }[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  // Text-specific properties
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  containerId?: string | null;
  originalText?: string;
  // Arrow-specific properties
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
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

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

const LAYOUT = {
  BOX_WIDTH: 200,
  BOX_HEIGHT: 80,
  HORIZONTAL_GAP: 40,
  VERTICAL_GAP: 60,
  PADDING: 50,
  FONT_SIZE_TITLE: 14,
  FONT_SIZE_NAME: 12,
  FONT_SIZE_CODE: 10,
};

const COLORS_BY_LEVEL: Record<number, { bg: string; stroke: string }> = {
  1: { bg: '#4F46E5', stroke: '#3730A3' }, // CEO - Indigo
  2: { bg: '#7C3AED', stroke: '#5B21B6' }, // C-Level - Purple
  3: { bg: '#0891B2', stroke: '#0E7490' }, // VP - Cyan
  4: { bg: '#0D9488', stroke: '#0F766E' }, // Director - Teal
  5: { bg: '#059669', stroke: '#047857' }, // Manager - Emerald
  6: { bg: '#65A30D', stroke: '#4D7C0F' }, // Senior - Lime
  7: { bg: '#9CA3AF', stroke: '#6B7280' }, // Staff - Gray
};

// =============================================================================
// EXCALIDRAW EXPORT SERVICE
// =============================================================================

export class ExcalidrawExportService {
  private tenantId: string;
  private elementCounter: number = 0;
  private seed: number = Date.now();

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ---------------------------------------------------------------------------
  // MAIN EXPORT
  // ---------------------------------------------------------------------------

  /**
   * Export org chart to Excalidraw format
   */
  async exportToExcalidraw(
    sessionId: string,
    includeEmployees: boolean = true
  ): Promise<ExcalidrawFile> {
    // Get session data
    const session = await this.getSession(sessionId);
    if (!session || !session.generated_structure) {
      throw new Error('Session not found or no generated structure');
    }

    const orgChart: GeneratedOrgChart = session.generated_structure;

    // Build tree structure
    let tree: TreeNode;
    if (includeEmployees) {
      tree = await this.buildTreeWithEmployees(sessionId, orgChart);
    } else {
      tree = this.buildTreeFromOrgChart(orgChart);
    }

    // Calculate layout
    this.calculateLayout(tree);

    // Generate Excalidraw elements
    const elements = this.generateElements(tree);

    return {
      type: 'excalidraw',
      version: 2,
      source: 'heuresys-org-chart-generator',
      elements,
      appState: {
        viewBackgroundColor: '#ffffff',
        currentItemFontFamily: 1,
        currentItemFontSize: 14,
        gridSize: null,
      },
      files: {},
    };
  }

  /**
   * Export from staging data
   */
  async exportStagingToExcalidraw(sessionId: string): Promise<ExcalidrawFile> {
    // Get staging hierarchy
    const stagingResult = await pool.query(
      `
      SELECT
        es.id,
        es.first_name,
        es.last_name,
        es.job_title,
        es.hierarchy_level,
        es.position_code,
        es.unit_code,
        es.reports_to_staging_id
      FROM employees_staging es
      WHERE es.session_id = $1 AND es.tenant_id = $2
      ORDER BY es.hierarchy_level, es.last_name
    `,
      [sessionId, this.tenantId]
    );

    // Build tree from staging
    const tree = this.buildTreeFromStaging(stagingResult.rows);

    // Calculate layout
    this.calculateLayout(tree);

    // Generate elements
    const elements = this.generateElements(tree);

    return {
      type: 'excalidraw',
      version: 2,
      source: 'heuresys-org-chart-generator',
      elements,
      appState: {
        viewBackgroundColor: '#ffffff',
        currentItemFontFamily: 1,
        currentItemFontSize: 14,
        gridSize: null,
      },
      files: {},
    };
  }

  // ---------------------------------------------------------------------------
  // TREE BUILDING
  // ---------------------------------------------------------------------------

  private async getSession(sessionId: string): Promise<Record<string, any>> {
    const result = await pool.query(
      `
      SELECT * FROM org_chart_generation_sessions
      WHERE id = $1 AND tenant_id = $2
    `,
      [sessionId, this.tenantId]
    );

    return result.rows[0] || null;
  }

  private buildTreeFromOrgChart(orgChart: GeneratedOrgChart): TreeNode {
    // Find root unit (level 1 or no parent)
    const rootUnit = orgChart.units.find((u) => u.level === 1 || !u.parentCode);

    if (!rootUnit) {
      throw new Error('No root unit found in org chart');
    }

    // Build unit hierarchy
    const buildNode = (unit: OrgUnit): TreeNode => {
      const childUnits = orgChart.units.filter((u) => u.parentCode === unit.code);

      // Get positions for this unit
      const positions = orgChart.positions.filter((p) => p.unitCode === unit.code);
      const managerPosition = positions.find((p) => p.isManager);

      return {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        type: 'unit',
        data: unit,
        employeeTitle: managerPosition?.titleIt,
        children: childUnits.map(buildNode),
      };
    };

    return buildNode(rootUnit);
  }

  private async buildTreeWithEmployees(
    sessionId: string,
    orgChart: GeneratedOrgChart
  ): Promise<TreeNode> {
    // Get staging data
    const stagingResult = await pool.query(
      `
      SELECT
        es.first_name,
        es.last_name,
        es.job_title,
        es.hierarchy_level,
        es.position_code,
        es.unit_code
      FROM employees_staging es
      WHERE es.session_id = $1 AND es.tenant_id = $2
      ORDER BY es.hierarchy_level, es.last_name
    `,
      [sessionId, this.tenantId]
    );

    // Group employees by unit
    const employeesByUnit = new Map<string, Record<string, any>[]>();
    for (const row of stagingResult.rows) {
      const unitEmployees = employeesByUnit.get(row.unit_code) || [];
      unitEmployees.push(row);
      employeesByUnit.set(row.unit_code, unitEmployees);
    }

    // Build tree with employees
    const rootUnit = orgChart.units.find((u) => u.level === 1 || !u.parentCode);
    if (!rootUnit) throw new Error('No root unit found');

    const buildNode = (unit: OrgUnit): TreeNode => {
      const childUnits = orgChart.units.filter((u) => u.parentCode === unit.code);
      const employees = employeesByUnit.get(unit.code) || [];

      // Find manager (lowest hierarchy_level in this unit)
      const manager =
        employees.find((e) =>
          orgChart.positions.find((p) => p.code === e.position_code && p.isManager)
        ) || employees[0];

      return {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        type: 'unit',
        data: unit,
        employeeName: manager ? `${manager.first_name} ${manager.last_name}` : undefined,
        employeeTitle: manager?.job_title,
        children: childUnits.map(buildNode),
      };
    };

    return buildNode(rootUnit);
  }

  private buildTreeFromStaging(stagingRows: any[]): TreeNode {
    // Build parent-child map
    const childMap = new Map<string | null, Record<string, any>[]>();

    for (const row of stagingRows) {
      const parentId = row.reports_to_staging_id;
      const children = childMap.get(parentId) || [];
      children.push(row);
      childMap.set(parentId, children);
    }

    // Find root (reports_to_staging_id is null)
    const roots = childMap.get(null) || [];
    const root = roots[0];

    if (!root) {
      // Fallback: create virtual root
      return {
        code: 'ROOT',
        name: 'Organization',
        level: 0,
        type: 'unit',
        data: null,
        children: stagingRows.slice(0, 10).map((r) => ({
          code: r.id,
          name: r.unit_code || 'Unknown',
          level: r.hierarchy_level,
          type: 'position',
          data: null,
          employeeName: `${r.first_name} ${r.last_name}`,
          employeeTitle: r.job_title,
          children: [],
        })),
      };
    }

    const buildNode = (row: any): TreeNode => {
      const children = childMap.get(row.id) || [];

      return {
        code: row.id,
        name: row.unit_code || 'Unknown',
        level: row.hierarchy_level,
        type: 'position',
        data: null,
        employeeName: `${row.first_name} ${row.last_name}`,
        employeeTitle: row.job_title,
        children: children.map(buildNode),
      };
    };

    return buildNode(root);
  }

  // ---------------------------------------------------------------------------
  // LAYOUT CALCULATION
  // ---------------------------------------------------------------------------

  private calculateLayout(
    node: TreeNode,
    x: number = 0,
    y: number = 0
  ): { width: number; height: number } {
    node.width = LAYOUT.BOX_WIDTH;
    node.height = LAYOUT.BOX_HEIGHT;

    if (node.children.length === 0) {
      node.x = x;
      node.y = y;
      return { width: LAYOUT.BOX_WIDTH, height: LAYOUT.BOX_HEIGHT };
    }

    // Calculate children layout
    let totalChildWidth = 0;
    const childLayouts: { width: number; height: number }[] = [];

    for (const child of node.children) {
      const layout = this.calculateLayout(child, 0, y + LAYOUT.BOX_HEIGHT + LAYOUT.VERTICAL_GAP);
      childLayouts.push(layout);
      totalChildWidth += layout.width;
    }

    // Add gaps between children
    totalChildWidth += (node.children.length - 1) * LAYOUT.HORIZONTAL_GAP;

    // Position children
    let currentX = x - totalChildWidth / 2 + LAYOUT.BOX_WIDTH / 2;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childLayout = childLayouts[i];

      if (child && childLayout) {
        child.x = currentX + (childLayout.width - LAYOUT.BOX_WIDTH) / 2;
        child.y = y + LAYOUT.BOX_HEIGHT + LAYOUT.VERTICAL_GAP;

        // Recalculate subtree positions
        this.shiftSubtree(child, child.x - (child.x || 0), 0);

        currentX += childLayout.width + LAYOUT.HORIZONTAL_GAP;
      }
    }

    // Center parent above children
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    if (firstChild && lastChild) {
      node.x = ((firstChild.x ?? 0) + (lastChild.x ?? 0)) / 2;
    }
    node.y = y;

    const maxChildY = Math.max(...node.children.map((c) => c.y! + (c.height || LAYOUT.BOX_HEIGHT)));

    return {
      width: Math.max(LAYOUT.BOX_WIDTH, totalChildWidth),
      height: maxChildY - y,
    };
  }

  private shiftSubtree(node: TreeNode, dx: number, dy: number): void {
    node.x = (node.x || 0) + dx;
    node.y = (node.y || 0) + dy;

    for (const child of node.children) {
      this.shiftSubtree(child, dx, dy);
    }
  }

  // ---------------------------------------------------------------------------
  // ELEMENT GENERATION
  // ---------------------------------------------------------------------------

  private generateElements(tree: TreeNode): ExcalidrawElement[] {
    const elements: ExcalidrawElement[] = [];

    // Normalize positions to start from padding
    const bounds = this.getTreeBounds(tree);
    const offsetX = LAYOUT.PADDING - bounds.minX;
    const offsetY = LAYOUT.PADDING - bounds.minY;
    this.shiftSubtree(tree, offsetX, offsetY);

    // Generate elements recursively
    this.generateNodeElements(tree, elements, null);

    return elements;
  }

  private getTreeBounds(node: TreeNode): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = node.x!;
    let minY = node.y!;
    let maxX = node.x! + LAYOUT.BOX_WIDTH;
    let maxY = node.y! + LAYOUT.BOX_HEIGHT;

    for (const child of node.children) {
      const childBounds = this.getTreeBounds(child);
      minX = Math.min(minX, childBounds.minX);
      minY = Math.min(minY, childBounds.minY);
      maxX = Math.max(maxX, childBounds.maxX);
      maxY = Math.max(maxY, childBounds.maxY);
    }

    return { minX, minY, maxX, maxY };
  }

  private generateNodeElements(
    node: TreeNode,
    elements: ExcalidrawElement[],
    parentId: string | null
  ): string {
    const defaultColors = { bg: '#9CA3AF', stroke: '#6B7280' };
    const colors = COLORS_BY_LEVEL[node.level] ?? defaultColors;
    const boxId = this.generateId();

    // Create box
    const boxElement: ExcalidrawElement = {
      id: boxId,
      type: 'rectangle',
      x: node.x!,
      y: node.y!,
      width: LAYOUT.BOX_WIDTH,
      height: LAYOUT.BOX_HEIGHT,
      angle: 0,
      strokeColor: colors.stroke,
      backgroundColor: colors.bg,
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      roundness: { type: 3, value: 8 },
      seed: this.nextSeed(),
      version: 1,
      versionNonce: this.nextSeed(),
      isDeleted: false,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
    };
    elements.push(boxElement);

    // Create title text (employee name or unit name)
    const titleText = node.employeeName || node.name;
    const titleId = this.generateId();
    const titleElement: ExcalidrawElement = {
      id: titleId,
      type: 'text',
      x: node.x! + 10,
      y: node.y! + 10,
      width: LAYOUT.BOX_WIDTH - 20,
      height: 20,
      angle: 0,
      strokeColor: '#ffffff',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      roundness: null,
      seed: this.nextSeed(),
      version: 1,
      versionNonce: this.nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: titleText,
      fontSize: LAYOUT.FONT_SIZE_TITLE,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'top',
      containerId: null,
      originalText: titleText,
    };
    elements.push(titleElement);

    // Create subtitle text (job title or position)
    const subtitle = node.employeeTitle || node.code;
    if (subtitle) {
      const subtitleId = this.generateId();
      const subtitleElement: ExcalidrawElement = {
        id: subtitleId,
        type: 'text',
        x: node.x! + 10,
        y: node.y! + 35,
        width: LAYOUT.BOX_WIDTH - 20,
        height: 18,
        angle: 0,
        strokeColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: null,
        seed: this.nextSeed(),
        version: 1,
        versionNonce: this.nextSeed(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        text: subtitle.substring(0, 30),
        fontSize: LAYOUT.FONT_SIZE_NAME,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        containerId: null,
        originalText: subtitle.substring(0, 30),
      };
      elements.push(subtitleElement);
    }

    // Create level indicator
    const levelText = `L${node.level}`;
    const levelId = this.generateId();
    const levelElement: ExcalidrawElement = {
      id: levelId,
      type: 'text',
      x: node.x! + 10,
      y: node.y! + 55,
      width: 30,
      height: 14,
      angle: 0,
      strokeColor: 'rgba(255,255,255,0.6)',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      roundness: null,
      seed: this.nextSeed(),
      version: 1,
      versionNonce: this.nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: levelText,
      fontSize: LAYOUT.FONT_SIZE_CODE,
      fontFamily: 1,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
      originalText: levelText,
    };
    elements.push(levelElement);

    // Create arrow from parent
    if (parentId) {
      const arrowId = this.generateId();
      const parentBox = elements.find((e) => e.id === parentId);
      if (parentBox) {
        const arrowElement: ExcalidrawElement = {
          id: arrowId,
          type: 'arrow',
          x: parentBox.x + LAYOUT.BOX_WIDTH / 2,
          y: parentBox.y + LAYOUT.BOX_HEIGHT,
          width: node.x! + LAYOUT.BOX_WIDTH / 2 - (parentBox.x + LAYOUT.BOX_WIDTH / 2),
          height: node.y! - (parentBox.y + LAYOUT.BOX_HEIGHT),
          angle: 0,
          strokeColor: '#374151',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 2,
          strokeStyle: 'solid',
          roughness: 0,
          opacity: 100,
          groupIds: [],
          roundness: { type: 2 },
          seed: this.nextSeed(),
          version: 1,
          versionNonce: this.nextSeed(),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
          startBinding: { elementId: parentId, focus: 0, gap: 1 },
          endBinding: { elementId: boxId, focus: 0, gap: 1 },
          points: [
            [0, 0],
            [
              node.x! + LAYOUT.BOX_WIDTH / 2 - (parentBox.x + LAYOUT.BOX_WIDTH / 2),
              node.y! - (parentBox.y + LAYOUT.BOX_HEIGHT),
            ],
          ],
          lastCommittedPoint: null,
          startArrowhead: null,
          endArrowhead: 'arrow',
        };
        elements.push(arrowElement);
      }
    }

    // Process children
    for (const child of node.children) {
      this.generateNodeElements(child, elements, boxId);
    }

    return boxId;
  }

  // ---------------------------------------------------------------------------
  // SNAPSHOT MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Save Excalidraw export as snapshot
   */
  async saveSnapshot(
    sessionId: string,
    snapshotName: string,
    snapshotType: 'prototype' | 'real' | 'staging' | 'final',
    excalidrawFile: ExcalidrawFile,
    treeStructure?: any
  ): Promise<string> {
    const result = await pool.query(
      `
      INSERT INTO org_chart_snapshots (
        session_id, tenant_id, snapshot_name, snapshot_type,
        tree_structure, excalidraw_format
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [
        sessionId,
        this.tenantId,
        snapshotName,
        snapshotType,
        JSON.stringify(treeStructure || {}),
        JSON.stringify(excalidrawFile),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<{
    id: string;
    sessionId: string;
    snapshotName: string;
    snapshotType: string;
    excalidrawFormat: ExcalidrawFile;
  } | null> {
    const result = await pool.query(
      `
      SELECT id, session_id, snapshot_name, snapshot_type, excalidraw_format
      FROM org_chart_snapshots
      WHERE id = $1 AND tenant_id = $2
    `,
      [snapshotId, this.tenantId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      snapshotName: row.snapshot_name,
      snapshotType: row.snapshot_type,
      excalidrawFormat: row.excalidraw_format,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private generateId(): string {
    this.elementCounter++;
    return `element_${Date.now()}_${this.elementCounter}`;
  }

  private nextSeed(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createExcalidrawExportService(tenantId: string): ExcalidrawExportService {
  return new ExcalidrawExportService(tenantId);
}

export default ExcalidrawExportService;
