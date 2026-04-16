/**
 * Employee Assignment Service
 * Maps real employees to positions in generated org chart
 * Creates employees_staging records with change tracking
 * Part of Org Chart Generation System
 */

import { pool } from '../config/database.js';
import { GeneratedOrgChart, OrgPosition, OrgUnit } from './org-chart-generator.js';

// =============================================================================
// TYPES
// =============================================================================

export type AssignmentMethod =
  | 'job_title_match'
  | 'org_unit_match'
  | 'manager_chain'
  | 'manual'
  | 'ai_suggested'
  | 'esco_match';

export type ChangeType =
  | 'unchanged'
  | 'new_position'
  | 'reassignment'
  | 'promotion'
  | 'demotion'
  | 'transfer'
  | 'new_hire_slot';

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
  // Other fields
  [key: string]: any;
}

export interface StagingRecord {
  id: string;
  sessionId: string;
  originalEmployeeId: string | null;
  // Staging organizational data
  positionCode: string;
  unitCode: string;
  hierarchyLevel: number;
  reportsToStagingId: string | null;
  // Change tracking
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

// =============================================================================
// EMPLOYEE ASSIGNMENT SERVICE
// =============================================================================

export class EmployeeAssignmentService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ---------------------------------------------------------------------------
  // MAIN ASSIGNMENT FLOW
  // ---------------------------------------------------------------------------

  /**
   * Assign all employees to positions in the generated org chart
   */
  async assignEmployeesToPositions(
    sessionId: string,
    orgChart: GeneratedOrgChart
  ): Promise<AssignmentResult> {
    // Update session status
    await pool.query(
      `
      UPDATE org_chart_generation_sessions
      SET status = 'assigning'
      WHERE id = $1
    `,
      [sessionId]
    );

    try {
      // Get all active employees
      const employees = await this.getEmployees();

      // Build position slots map
      const positionSlots = this.buildPositionSlots(orgChart);

      // Phase 1: Assign managers by existing manager_id chain
      const managerAssignments = await this.assignByManagerChain(
        sessionId,
        employees,
        positionSlots,
        orgChart
      );

      // Phase 2: Assign by job title similarity
      const unassignedAfterManagers = employees.filter(
        (e) => !managerAssignments.assignedEmployeeIds.has(e.id)
      );
      const titleAssignments = await this.assignByJobTitle(
        sessionId,
        unassignedAfterManagers,
        positionSlots
      );

      // Phase 3: Assign by department
      const unassignedAfterTitle = unassignedAfterManagers.filter(
        (e) => !titleAssignments.assignedEmployeeIds.has(e.id)
      );
      const deptAssignments = await this.assignByDepartment(
        sessionId,
        unassignedAfterTitle,
        positionSlots
      );

      // Phase 4: Assign remaining to level 7 positions
      const stillUnassigned = unassignedAfterTitle.filter(
        (e) => !deptAssignments.assignedEmployeeIds.has(e.id)
      );
      await this.assignRemainingToStaff(sessionId, stillUnassigned, positionSlots);

      // Build hierarchy (set reports_to_staging_id)
      await this.buildStagingHierarchy(sessionId, positionSlots);

      // Calculate result statistics
      const result = await this.calculateAssignmentStats(sessionId);

      // Update session status
      await pool.query(
        `
        UPDATE org_chart_generation_sessions
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `,
        [sessionId]
      );

      return result;
    } catch (error) {
      await pool.query(
        `
        UPDATE org_chart_generation_sessions
        SET status = 'failed', error_message = $2
        WHERE id = $1
      `,
        [sessionId, (error as Error).message]
      );

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // EMPLOYEE DATA
  // ---------------------------------------------------------------------------

  private async getEmployees(): Promise<EmployeeData[]> {
    const result = await pool.query(
      `
      SELECT
        id, tenant_id, first_name, last_name, middle_name, email, personal_email,
        phone_mobile, phone_work, phone_home,
        job_title, department, location, hire_date, is_active,
        manager_id, org_unit_id, org_unit_id, cost_center_id, position_id,
        cost_center, legacy_org_unit_code,
        birth_date, birth_place, gender, nationality, marital_status,
        address_street, address_city, address_postal_code, address_country, address_region,
        salary, currency, pay_scale_area, pay_scale_type, pay_scale_group, pay_scale_level,
        pay_periods_per_year, work_schedule_percentage,
        iban, swift_bic, bank_name, bank_account_number,
        skills, performance_rating, potential,
        employee_group, employee_subgroup, pernr, tax_id
      FROM employees
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY
        CASE WHEN manager_id IS NULL THEN 0 ELSE 1 END, -- Managers first (those without manager)
        hire_date ASC
    `,
      [this.tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      jobTitle: row.job_title,
      department: row.department,
      orgUnitId: row.org_unit_id,
      managerId: row.manager_id,
      isActive: row.is_active,
      // Include all other fields
      ...row,
    }));
  }

  // ---------------------------------------------------------------------------
  // POSITION SLOTS
  // ---------------------------------------------------------------------------

  private buildPositionSlots(orgChart: GeneratedOrgChart): Map<string, PositionSlot> {
    const slots = new Map<string, PositionSlot>();

    for (const position of orgChart.positions) {
      const unit = orgChart.units.find((u) => u.code === position.unitCode);
      if (!unit) continue;

      slots.set(position.code, {
        position,
        unit,
        remainingSlots: position.headcount,
        assignedEmployees: [],
      });
    }

    return slots;
  }

  // ---------------------------------------------------------------------------
  // ASSIGNMENT METHODS
  // ---------------------------------------------------------------------------

  /**
   * Phase 1: Assign based on existing manager chain
   * Identifies employees who are managers (have direct reports) and assigns them to manager positions
   */
  private async assignByManagerChain(
    sessionId: string,
    employees: EmployeeData[],
    positionSlots: Map<string, PositionSlot>,
    _orgChart: GeneratedOrgChart
  ): Promise<{ assignedEmployeeIds: Set<string> }> {
    const assignedEmployeeIds = new Set<string>();

    // Find employees who have direct reports (they are managers)
    const managerIds = new Set(employees.filter((e) => e.managerId).map((e) => e.managerId));
    const actualManagers = employees.filter((e) => managerIds.has(e.id));

    // Sort by number of direct reports (more reports = higher level)
    const managersByReports = actualManagers
      .map((m) => ({
        employee: m,
        directReports: employees.filter((e) => e.managerId === m.id).length,
      }))
      .sort((a, b) => b.directReports - a.directReports);

    // Find CEO (no manager_id, or most direct reports)
    const potentialCEO = employees.find((e) => !e.managerId) || managersByReports[0]?.employee;

    // Assign CEO
    if (potentialCEO) {
      const ceoSlot = Array.from(positionSlots.values()).find(
        (s) => s.position.level === 1 && s.remainingSlots > 0
      );

      if (ceoSlot) {
        await this.createStagingRecord(sessionId, potentialCEO, ceoSlot, 'manager_chain', 0.95);
        ceoSlot.remainingSlots--;
        ceoSlot.assignedEmployees.push(potentialCEO.id);
        assignedEmployeeIds.add(potentialCEO.id);
      }
    }

    // Assign other managers by level estimation
    for (const { employee, directReports } of managersByReports) {
      if (assignedEmployeeIds.has(employee.id)) continue;

      // Estimate level based on direct reports and job title
      const estimatedLevel = this.estimateLevelFromReports(directReports, employee.jobTitle);

      // Find matching manager position
      const slot = this.findBestManagerSlot(positionSlots, estimatedLevel, employee);

      if (slot) {
        await this.createStagingRecord(sessionId, employee, slot, 'manager_chain', 0.85);
        slot.remainingSlots--;
        slot.assignedEmployees.push(employee.id);
        assignedEmployeeIds.add(employee.id);
      }
    }

    return { assignedEmployeeIds };
  }

  /**
   * Phase 2: Assign by job title similarity
   */
  private async assignByJobTitle(
    sessionId: string,
    employees: EmployeeData[],
    positionSlots: Map<string, PositionSlot>
  ): Promise<{ assignedEmployeeIds: Set<string> }> {
    const assignedEmployeeIds = new Set<string>();

    for (const employee of employees) {
      if (!employee.jobTitle) continue;

      // Find position with matching title
      const matchingSlot = this.findSlotByTitleSimilarity(positionSlots, employee.jobTitle);

      if (matchingSlot && matchingSlot.remainingSlots > 0) {
        const confidence = this.calculateTitleMatchConfidence(
          employee.jobTitle,
          matchingSlot.position.titleIt,
          matchingSlot.position.titleEn
        );

        await this.createStagingRecord(
          sessionId,
          employee,
          matchingSlot,
          'job_title_match',
          confidence
        );
        matchingSlot.remainingSlots--;
        matchingSlot.assignedEmployees.push(employee.id);
        assignedEmployeeIds.add(employee.id);
      }
    }

    return { assignedEmployeeIds };
  }

  /**
   * Phase 3: Assign by department
   */
  private async assignByDepartment(
    sessionId: string,
    employees: EmployeeData[],
    positionSlots: Map<string, PositionSlot>
  ): Promise<{ assignedEmployeeIds: Set<string> }> {
    const assignedEmployeeIds = new Set<string>();

    for (const employee of employees) {
      if (!employee.department && !employee.orgUnitId) continue;

      // Find unit matching department
      const matchingSlot = this.findSlotByDepartment(
        positionSlots,
        employee.department || '',
        employee.orgUnitId
      );

      if (matchingSlot && matchingSlot.remainingSlots > 0) {
        await this.createStagingRecord(sessionId, employee, matchingSlot, 'org_unit_match', 0.6);
        matchingSlot.remainingSlots--;
        matchingSlot.assignedEmployees.push(employee.id);
        assignedEmployeeIds.add(employee.id);
      }
    }

    return { assignedEmployeeIds };
  }

  /**
   * Phase 4: Assign remaining employees to level 7 (staff) positions
   */
  private async assignRemainingToStaff(
    sessionId: string,
    employees: EmployeeData[],
    positionSlots: Map<string, PositionSlot>
  ): Promise<void> {
    // Get all level 7 positions with remaining slots
    const staffSlots = Array.from(positionSlots.values())
      .filter((s) => s.position.level === 7 && s.remainingSlots > 0)
      .sort((a, b) => b.remainingSlots - a.remainingSlots);

    let slotIndex = 0;

    for (const employee of employees) {
      if (staffSlots.length === 0) break;

      // Round-robin across staff positions
      let attempts = 0;
      while (attempts < staffSlots.length) {
        const slot = staffSlots[slotIndex % staffSlots.length];

        if (slot && slot.remainingSlots > 0) {
          await this.createStagingRecord(sessionId, employee, slot, 'org_unit_match', 0.4);
          slot.remainingSlots--;
          slot.assignedEmployees.push(employee.id);
          break;
        }

        slotIndex++;
        attempts++;
      }

      slotIndex++;
    }
  }

  // ---------------------------------------------------------------------------
  // STAGING RECORD CREATION
  // ---------------------------------------------------------------------------

  private async createStagingRecord(
    sessionId: string,
    employee: EmployeeData,
    slot: PositionSlot,
    method: AssignmentMethod,
    confidence: number
  ): Promise<string> {
    // Determine change type
    const changeType = this.determineChangeType(employee, slot);

    // Capture original values
    const originalValues = {
      job_title: employee.jobTitle,
      department: employee.department,
      org_unit_id: employee.orgUnitId,
      manager_id: employee.managerId,
      position_id: employee.position_id,
    };

    // Calculate diff fields
    const diffFields = this.calculateDiffFields(employee, slot);

    const result = await pool.query(
      `
      INSERT INTO employees_staging (
        session_id,
        original_employee_id,
        tenant_id,
        -- Core employee fields
        first_name, last_name, middle_name, email, personal_email,
        phone_mobile, phone_work, phone_home,
        job_title, department, location, hire_date, is_active,
        manager_id, org_unit_id, org_unit_id, cost_center_id, position_id,
        cost_center, legacy_org_unit_code,
        birth_date, birth_place, gender, nationality, marital_status,
        address_street, address_city, address_postal_code, address_country, address_region,
        salary, currency, pay_scale_area, pay_scale_type, pay_scale_group, pay_scale_level,
        pay_periods_per_year, work_schedule_percentage,
        iban, swift_bic, bank_name, bank_account_number,
        skills, performance_rating, potential,
        employee_group, employee_subgroup, pernr, tax_id,
        -- Staging-specific fields
        hierarchy_level, position_code, unit_code,
        original_values, diff_fields, change_type,
        assignment_method, assignment_confidence
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
        $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48,
        $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60
      )
      RETURNING id
    `,
      [
        sessionId,
        employee.id,
        this.tenantId,
        // Core fields
        employee.firstName || employee.first_name,
        employee.lastName || employee.last_name,
        employee.middle_name,
        employee.email,
        employee.personal_email,
        employee.phone_mobile,
        employee.phone_work,
        employee.phone_home,
        slot.position.titleIt, // New job title from position
        slot.unit.name, // New department from unit
        employee.location,
        employee.hire_date,
        employee.is_active,
        employee.manager_id, // Will be updated in buildStagingHierarchy
        employee.org_unit_id,
        employee.org_unit_id,
        employee.cost_center_id,
        slot.position.code, // New position_id
        slot.unit.costCenter || employee.cost_center,
        employee.legacy_org_unit_code,
        employee.birth_date,
        employee.birth_place,
        employee.gender,
        employee.nationality,
        employee.marital_status,
        employee.address_street,
        employee.address_city,
        employee.address_postal_code,
        employee.address_country,
        employee.address_region,
        employee.salary,
        employee.currency,
        employee.pay_scale_area,
        employee.pay_scale_type,
        employee.pay_scale_group,
        employee.pay_scale_level,
        employee.pay_periods_per_year,
        employee.work_schedule_percentage,
        employee.iban,
        employee.swift_bic,
        employee.bank_name,
        employee.bank_account_number,
        employee.skills,
        employee.performance_rating,
        employee.potential,
        employee.employee_group,
        employee.employee_subgroup,
        employee.pernr,
        employee.tax_id,
        // Staging fields
        slot.position.level,
        slot.position.code,
        slot.unit.code,
        JSON.stringify(originalValues),
        diffFields,
        changeType,
        method,
        confidence,
      ]
    );

    return result.rows[0].id;
  }

  // ---------------------------------------------------------------------------
  // HIERARCHY BUILDING
  // ---------------------------------------------------------------------------

  /**
   * Set reports_to_staging_id based on position hierarchy
   */
  private async buildStagingHierarchy(
    sessionId: string,
    positionSlots: Map<string, PositionSlot>
  ): Promise<void> {
    // Get all staging records ordered by level
    const stagingResult = await pool.query(
      `
      SELECT id, hierarchy_level, position_code, unit_code
      FROM employees_staging
      WHERE session_id = $1
      ORDER BY hierarchy_level ASC
    `,
      [sessionId]
    );

    const stagingRecords = stagingResult.rows;

    // Build map of position code to staging IDs
    const positionToStaging = new Map<string, string[]>();
    for (const record of stagingRecords) {
      const ids = positionToStaging.get(record.position_code) || [];
      ids.push(record.id);
      positionToStaging.set(record.position_code, ids);
    }

    // Build map of unit code to manager staging ID
    const unitToManager = new Map<string, string>();

    // First pass: identify managers (lowest level person in each unit who is a manager)
    for (const [posCode, slot] of positionSlots) {
      if (slot.position.isManager && slot.assignedEmployees.length > 0) {
        const managerStagingIds = positionToStaging.get(posCode);
        const firstManagerId = managerStagingIds?.[0];
        if (firstManagerId) {
          unitToManager.set(slot.unit.code, firstManagerId);
        }
      }
    }

    // Second pass: set reports_to_staging_id
    for (const record of stagingRecords) {
      if (record.hierarchy_level === 1) continue; // CEO reports to no one

      // Find the manager to report to
      let managerId: string | null = null;

      // Option 1: Report to position's reportsToPositionCode
      const slot = positionSlots.get(record.position_code);
      if (slot?.position.reportsToPositionCode) {
        const managerStagingIds = positionToStaging.get(slot.position.reportsToPositionCode);
        const firstManagerId = managerStagingIds?.[0];
        if (firstManagerId) {
          managerId = firstManagerId;
        }
      }

      // Option 2: Report to unit manager
      if (!managerId) {
        managerId = unitToManager.get(record.unit_code) || null;
      }

      // Option 3: Report to parent unit manager
      if (!managerId && slot) {
        const parentUnit = Array.from(positionSlots.values()).find(
          (s) => s.unit.code === slot.unit.parentCode
        );
        if (parentUnit) {
          managerId = unitToManager.get(parentUnit.unit.code) || null;
        }
      }

      // Option 4: Report to any level N-1 person
      if (!managerId) {
        const higherLevelRecord = stagingRecords.find(
          (r) => r.hierarchy_level === record.hierarchy_level - 1
        );
        if (higherLevelRecord) {
          managerId = higherLevelRecord.id;
        }
      }

      if (managerId && managerId !== record.id) {
        await pool.query(
          `
          UPDATE employees_staging
          SET reports_to_staging_id = $2
          WHERE id = $1
        `,
          [record.id, managerId]
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private estimateLevelFromReports(directReports: number, jobTitle: string | null): number {
    // Level estimation based on direct reports
    if (directReports > 20) return 2; // C-Level
    if (directReports > 10) return 3; // VP/Director
    if (directReports > 5) return 4; // Director
    if (directReports > 2) return 5; // Manager
    if (directReports > 0) return 6; // Team Lead

    // Job title hints
    if (jobTitle) {
      const title = jobTitle.toLowerCase();
      if (title.includes('ceo') || title.includes('amministratore delegato')) return 1;
      if (
        title.includes('cfo') ||
        title.includes('cto') ||
        title.includes('coo') ||
        title.includes('chief')
      )
        return 2;
      if (
        title.includes('vp') ||
        title.includes('vice president') ||
        title.includes('direttore generale')
      )
        return 3;
      if (
        title.includes('director') ||
        title.includes('direttore') ||
        title.includes('responsabile')
      )
        return 4;
      if (title.includes('manager') || title.includes('capo')) return 5;
      if (title.includes('senior') || title.includes('lead') || title.includes('coordinat'))
        return 6;
    }

    return 7; // Default to staff level
  }

  private findBestManagerSlot(
    positionSlots: Map<string, PositionSlot>,
    targetLevel: number,
    employee: EmployeeData
  ): PositionSlot | null {
    // Find manager positions at or near target level with available slots
    const candidates = Array.from(positionSlots.values())
      .filter(
        (s) =>
          s.position.isManager &&
          s.remainingSlots > 0 &&
          Math.abs(s.position.level - targetLevel) <= 1
      )
      .sort((a, b) => {
        // Prefer exact level match
        const levelDiffA = Math.abs(a.position.level - targetLevel);
        const levelDiffB = Math.abs(b.position.level - targetLevel);
        if (levelDiffA !== levelDiffB) return levelDiffA - levelDiffB;

        // Then prefer department match
        if (employee.department) {
          const deptMatchA = a.unit.name.toLowerCase().includes(employee.department.toLowerCase())
            ? 0
            : 1;
          const deptMatchB = b.unit.name.toLowerCase().includes(employee.department.toLowerCase())
            ? 0
            : 1;
          if (deptMatchA !== deptMatchB) return deptMatchA - deptMatchB;
        }

        return 0;
      });

    return candidates[0] || null;
  }

  private findSlotByTitleSimilarity(
    positionSlots: Map<string, PositionSlot>,
    jobTitle: string
  ): PositionSlot | null {
    const titleLower = jobTitle.toLowerCase();
    const titleWords = titleLower.split(/\s+/);

    let bestMatch: PositionSlot | null = null;
    let bestScore = 0;

    for (const slot of positionSlots.values()) {
      if (slot.remainingSlots <= 0) continue;

      const positionTitle = (slot.position.titleIt + ' ' + slot.position.titleEn).toLowerCase();

      // Calculate similarity score
      let score = 0;
      for (const word of titleWords) {
        if (word.length > 2 && positionTitle.includes(word)) {
          score += word.length;
        }
      }

      // Bonus for exact matches
      if (positionTitle.includes(titleLower)) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = slot;
      }
    }

    return bestScore > 3 ? bestMatch : null;
  }

  private findSlotByDepartment(
    positionSlots: Map<string, PositionSlot>,
    orgUnitName: string,
    _orgUnitId: string | null
  ): PositionSlot | null {
    const deptLower = orgUnitName.toLowerCase();

    // Find unit matching department
    for (const slot of positionSlots.values()) {
      if (slot.remainingSlots <= 0) continue;

      const unitName = slot.unit.name.toLowerCase();

      if (
        unitName.includes(deptLower) ||
        deptLower.includes(unitName) ||
        this.orgUnitsMatch(orgUnitName, slot.unit.name)
      ) {
        return slot;
      }
    }

    // Fallback: any level 7 position with slots
    for (const slot of positionSlots.values()) {
      if (slot.position.level === 7 && slot.remainingSlots > 0) {
        return slot;
      }
    }

    return null;
  }

  private orgUnitsMatch(dept1: string, dept2: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]/g, '');

    const n1 = normalize(dept1);
    const n2 = normalize(dept2);

    return n1.includes(n2) || n2.includes(n1);
  }

  private determineChangeType(employee: EmployeeData, slot: PositionSlot): ChangeType {
    // Compare current level (estimated) with target level
    const currentLevel = this.estimateLevelFromReports(0, employee.jobTitle);
    const targetLevel = slot.position.level;

    if (currentLevel === targetLevel) {
      // Check if department changed
      if (employee.department && !this.orgUnitsMatch(employee.department, slot.unit.name)) {
        return 'transfer';
      }
      return 'unchanged';
    }

    if (targetLevel < currentLevel) {
      return 'promotion';
    }

    if (targetLevel > currentLevel) {
      return 'demotion';
    }

    return 'reassignment';
  }

  private calculateDiffFields(employee: EmployeeData, slot: PositionSlot): string[] {
    const diffs: string[] = [];

    if (employee.jobTitle !== slot.position.titleIt) {
      diffs.push('job_title');
    }
    if (employee.department !== slot.unit.name) {
      diffs.push('department');
    }
    if (employee.position_id !== slot.position.code) {
      diffs.push('position_id');
    }

    return diffs;
  }

  private calculateTitleMatchConfidence(
    originalTitle: string,
    targetTitleIt: string,
    targetTitleEn: string
  ): number {
    const original = originalTitle.toLowerCase();
    const targetIt = targetTitleIt.toLowerCase();
    const targetEn = targetTitleEn.toLowerCase();

    if (original === targetIt || original === targetEn) return 1.0;
    if (targetIt.includes(original) || targetEn.includes(original)) return 0.9;
    if (original.includes(targetIt) || original.includes(targetEn)) return 0.8;

    // Word overlap
    const originalWords = new Set(original.split(/\s+/));
    const targetWords = new Set([...targetIt.split(/\s+/), ...targetEn.split(/\s+/)]);

    let matches = 0;
    for (const word of originalWords) {
      if (word.length > 2 && targetWords.has(word)) {
        matches++;
      }
    }

    return Math.min(0.7, matches * 0.2);
  }

  // ---------------------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------------------

  private async calculateAssignmentStats(sessionId: string): Promise<AssignmentResult> {
    const result = await pool.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN change_type = 'unchanged' THEN 1 END) as unchanged,
        COUNT(CASE WHEN change_type = 'new_position' THEN 1 END) as new_position,
        COUNT(CASE WHEN change_type = 'reassignment' THEN 1 END) as reassignment,
        COUNT(CASE WHEN change_type = 'promotion' THEN 1 END) as promotion,
        COUNT(CASE WHEN change_type = 'demotion' THEN 1 END) as demotion,
        COUNT(CASE WHEN change_type = 'transfer' THEN 1 END) as transfer,
        COUNT(CASE WHEN assignment_method = 'job_title_match' THEN 1 END) as by_title,
        COUNT(CASE WHEN assignment_method = 'org_unit_match' THEN 1 END) as by_dept,
        COUNT(CASE WHEN assignment_method = 'manager_chain' THEN 1 END) as by_manager
      FROM employees_staging
      WHERE session_id = $1
    `,
      [sessionId]
    );

    const levelResult = await pool.query(
      `
      SELECT hierarchy_level, COUNT(*) as count
      FROM employees_staging
      WHERE session_id = $1
      GROUP BY hierarchy_level
      ORDER BY hierarchy_level
    `,
      [sessionId]
    );

    const row = result.rows[0];
    const byLevel: Record<number, number> = {};
    for (const lr of levelResult.rows) {
      byLevel[lr.hierarchy_level] = parseInt(lr.count);
    }

    return {
      sessionId,
      totalEmployees: parseInt(row.total),
      assigned: parseInt(row.total),
      vacantPositions: 0, // Would need to compare with position headcounts
      byChangeType: {
        unchanged: parseInt(row.unchanged),
        new_position: parseInt(row.new_position),
        reassignment: parseInt(row.reassignment),
        promotion: parseInt(row.promotion),
        demotion: parseInt(row.demotion),
        transfer: parseInt(row.transfer),
        new_hire_slot: 0,
      },
      byMethod: {
        job_title_match: parseInt(row.by_title),
        org_unit_match: parseInt(row.by_dept),
        manager_chain: parseInt(row.by_manager),
        manual: 0,
        ai_suggested: 0,
        esco_match: 0,
      },
      byLevel,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createEmployeeAssignmentService(tenantId: string): EmployeeAssignmentService {
  return new EmployeeAssignmentService(tenantId);
}

export default EmployeeAssignmentService;
