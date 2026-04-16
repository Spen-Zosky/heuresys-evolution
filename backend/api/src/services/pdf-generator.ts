/**
 * PDF Generator Service
 * Sprint 2025-11 - S-ANLT-01-07: Export & Reporting Engine
 *
 * Generates professional PDF reports for analytics dashboards
 */

import PDFDocument from 'pdfkit';

// ============================================================================
// Types
// ============================================================================

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'letter' | 'legal';
  includeTimestamp?: boolean;
  includePageNumbers?: boolean;
  companyName?: string;
  footer?: string;
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date';
}

export interface PDFSection {
  title: string;
  type: 'table' | 'metrics' | 'chart' | 'text';
  data: Record<string, any>;
  columns?: TableColumn[];
}

// ============================================================================
// Colors and Styles
// ============================================================================

const COLORS = {
  primary: '#1e40af', // Blue-800
  secondary: '#3b82f6', // Blue-500
  text: '#1f2937', // Gray-800
  textLight: '#6b7280', // Gray-500
  border: '#e5e7eb', // Gray-200
  background: '#f9fafb', // Gray-50
  success: '#059669', // Green-600
  warning: '#d97706', // Amber-600
  danger: '#dc2626', // Red-600
  white: '#ffffff',
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class PDFGenerator {
  private doc: typeof PDFDocument.prototype;
  private options: PDFReportOptions;
  private currentY: number = 0;
  private pageCount: number = 1;
  private marginTop: number = 50;
  private marginBottom: number = 50;
  private marginLeft: number = 50;
  private marginRight: number = 50;
  private contentWidth: number = 0;
  private pageHeight: number = 0;

  constructor(options: PDFReportOptions) {
    this.options = {
      orientation: 'portrait',
      pageSize: 'A4',
      includeTimestamp: true,
      includePageNumbers: true,
      companyName: 'Heuresys',
      ...options,
    };

    // Create PDF document
    this.doc = new PDFDocument({
      size: this.options.pageSize,
      layout: this.options.orientation,
      margins: {
        top: this.marginTop,
        bottom: this.marginBottom,
        left: this.marginLeft,
        right: this.marginRight,
      },
      bufferPages: true,
    });

    // Calculate content dimensions
    const pageWidth =
      this.options.orientation === 'landscape'
        ? this.options.pageSize === 'A4'
          ? 841.89
          : 792
        : this.options.pageSize === 'A4'
          ? 595.28
          : 612;
    this.pageHeight =
      this.options.orientation === 'landscape'
        ? this.options.pageSize === 'A4'
          ? 595.28
          : 612
        : this.options.pageSize === 'A4'
          ? 841.89
          : 792;
    this.contentWidth = pageWidth - this.marginLeft - this.marginRight;
    this.currentY = this.marginTop;
  }

  /**
   * Generate PDF buffer
   */
  async generate(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      // Add page numbers if enabled
      if (this.options.includePageNumbers) {
        this.addPageNumbers();
      }

      this.doc.end();
    });
  }

  /**
   * Add header section
   */
  addHeader(): void {
    // Company name and logo area
    this.doc
      .fontSize(10)
      .fillColor(COLORS.textLight)
      .text(this.options.companyName || 'Heuresys', this.marginLeft, this.marginTop);

    // Title
    this.currentY = this.marginTop + 30;
    this.doc
      .fontSize(24)
      .fillColor(COLORS.primary)
      .text(this.options.title, this.marginLeft, this.currentY, {
        align: 'center',
        width: this.contentWidth,
      });

    this.currentY += 35;

    // Subtitle
    if (this.options.subtitle) {
      this.doc
        .fontSize(12)
        .fillColor(COLORS.textLight)
        .text(this.options.subtitle, this.marginLeft, this.currentY, {
          align: 'center',
          width: this.contentWidth,
        });
      this.currentY += 20;
    }

    // Timestamp
    if (this.options.includeTimestamp) {
      const timestamp = new Date().toLocaleString('it-IT', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      this.doc
        .fontSize(10)
        .fillColor(COLORS.textLight)
        .text(`Generato il: ${timestamp}`, this.marginLeft, this.currentY, {
          align: 'center',
          width: this.contentWidth,
        });
      this.currentY += 15;
    }

    // Separator line
    this.currentY += 10;
    this.doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .moveTo(this.marginLeft, this.currentY)
      .lineTo(this.marginLeft + this.contentWidth, this.currentY)
      .stroke();

    this.currentY += 20;
  }

  /**
   * Add section title
   */
  addSectionTitle(title: string): void {
    this.checkPageBreak(40);

    this.doc.fontSize(16).fillColor(COLORS.primary).text(title, this.marginLeft, this.currentY);

    this.currentY += 25;
  }

  /**
   * Add metrics cards section
   */
  addMetricsSection(
    metrics: Array<{ label: string; value: string | number; change?: number }>
  ): void {
    this.checkPageBreak(80);

    const cardWidth = (this.contentWidth - 30) / 4;
    const cardHeight = 60;
    let x = this.marginLeft;

    metrics.forEach((metric, index) => {
      if (index > 0 && index % 4 === 0) {
        x = this.marginLeft;
        this.currentY += cardHeight + 10;
      }

      // Card background
      this.doc.rect(x, this.currentY, cardWidth, cardHeight).fillColor(COLORS.background).fill();

      // Card border
      this.doc.rect(x, this.currentY, cardWidth, cardHeight).strokeColor(COLORS.border).stroke();

      // Label
      this.doc
        .fontSize(9)
        .fillColor(COLORS.textLight)
        .text(metric.label, x + 10, this.currentY + 10, {
          width: cardWidth - 20,
        });

      // Value
      const valueStr =
        typeof metric.value === 'number' ? this.formatNumber(metric.value) : metric.value;
      this.doc
        .fontSize(18)
        .fillColor(COLORS.text)
        .text(valueStr, x + 10, this.currentY + 28, {
          width: cardWidth - 20,
        });

      // Change indicator
      if (metric.change !== undefined) {
        const changeColor = metric.change >= 0 ? COLORS.success : COLORS.danger;
        const changeSymbol = metric.change >= 0 ? '▲' : '▼';
        this.doc
          .fontSize(10)
          .fillColor(changeColor)
          .text(
            `${changeSymbol} ${Math.abs(metric.change).toFixed(1)}%`,
            x + cardWidth - 50,
            this.currentY + 8
          );
      }

      x += cardWidth + 10;
    });

    this.currentY += cardHeight + 20;
  }

  /**
   * Add data table
   */
  addTable(columns: TableColumn[], data: Record<string, any>[]): void {
    if (data.length === 0) {
      this.addText('Nessun dato disponibile');
      return;
    }

    const rowHeight = 25;
    const headerHeight = 30;

    // Calculate column widths
    const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
    const undefinedCols = columns.filter((col) => !col.width).length;
    const remainingWidth = this.contentWidth - totalDefinedWidth;
    const defaultColWidth = undefinedCols > 0 ? remainingWidth / undefinedCols : 100;

    const colWidths = columns.map((col) => col.width || defaultColWidth);

    // Header
    this.checkPageBreak(headerHeight + rowHeight * Math.min(3, data.length));

    let x = this.marginLeft;
    this.doc
      .rect(this.marginLeft, this.currentY, this.contentWidth, headerHeight)
      .fillColor(COLORS.primary)
      .fill();

    columns.forEach((col, i) => {
      const colWidth = colWidths[i] ?? 100;
      this.doc
        .fontSize(10)
        .fillColor(COLORS.white)
        .text(col.header, x + 5, this.currentY + 9, {
          width: colWidth - 10,
          align: col.align || 'left',
        });
      x += colWidth;
    });

    this.currentY += headerHeight;

    // Data rows
    data.forEach((row, rowIndex) => {
      this.checkPageBreak(rowHeight);

      // Alternating row background
      if (rowIndex % 2 === 0) {
        this.doc
          .rect(this.marginLeft, this.currentY, this.contentWidth, rowHeight)
          .fillColor(COLORS.background)
          .fill();
      }

      // Row border
      this.doc
        .rect(this.marginLeft, this.currentY, this.contentWidth, rowHeight)
        .strokeColor(COLORS.border)
        .stroke();

      x = this.marginLeft;
      columns.forEach((col, i) => {
        const colWidth = colWidths[i] ?? 100;
        let value = row[col.key];

        // Format value based on type
        if (value !== null && value !== undefined) {
          switch (col.format) {
            case 'number':
              value = this.formatNumber(value);
              break;
            case 'currency':
              value = this.formatCurrency(value);
              break;
            case 'percent':
              value = `${Number(value).toFixed(1)}%`;
              break;
            case 'date':
              value = new Date(value).toLocaleDateString('it-IT');
              break;
          }
        } else {
          value = '-';
        }

        this.doc
          .fontSize(9)
          .fillColor(COLORS.text)
          .text(String(value), x + 5, this.currentY + 8, {
            width: colWidth - 10,
            align: col.align || 'left',
          });
        x += colWidth;
      });

      this.currentY += rowHeight;
    });

    this.currentY += 15;
  }

  /**
   * Add summary section with key-value pairs
   */
  addSummary(items: Array<{ label: string; value: string | number }>): void {
    this.checkPageBreak(items.length * 20 + 20);

    items.forEach((item) => {
      this.doc
        .fontSize(10)
        .fillColor(COLORS.textLight)
        .text(item.label + ':', this.marginLeft, this.currentY, { continued: true })
        .fillColor(COLORS.text)
        .text(' ' + String(item.value));
      this.currentY += 18;
    });

    this.currentY += 10;
  }

  /**
   * Add plain text paragraph
   */
  addText(text: string): void {
    this.checkPageBreak(30);

    this.doc.fontSize(11).fillColor(COLORS.text).text(text, this.marginLeft, this.currentY, {
      width: this.contentWidth,
      align: 'left',
    });

    this.currentY = this.doc.y + 15;
  }

  /**
   * Add space
   */
  addSpace(height: number = 20): void {
    this.currentY += height;
    this.checkPageBreak(0);
  }

  /**
   * Check if page break is needed
   */
  private checkPageBreak(requiredSpace: number): void {
    const availableSpace = this.pageHeight - this.marginBottom - this.currentY;
    if (availableSpace < requiredSpace) {
      this.doc.addPage();
      this.pageCount++;
      this.currentY = this.marginTop;
    }
  }

  /**
   * Add page numbers to all pages
   */
  private addPageNumbers(): void {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);

      // Page number
      this.doc
        .fontSize(9)
        .fillColor(COLORS.textLight)
        .text(`Pagina ${i + 1} di ${range.count}`, this.marginLeft, this.pageHeight - 30, {
          align: 'center',
          width: this.contentWidth,
        });

      // Footer
      if (this.options.footer) {
        this.doc
          .fontSize(8)
          .fillColor(COLORS.textLight)
          .text(this.options.footer, this.marginLeft, this.pageHeight - 45, {
            align: 'center',
            width: this.contentWidth,
          });
      }
    }
  }

  /**
   * Format number with locale
   */
  private formatNumber(value: number): string {
    return value.toLocaleString('it-IT', {
      maximumFractionDigits: 2,
    });
  }

  /**
   * Format currency
   */
  private formatCurrency(value: number): string {
    return value.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    });
  }
}

// ============================================================================
// Factory Functions for Dashboard Reports
// ============================================================================

/**
 * Generate HR Dashboard PDF
 */
export async function generateHRDashboardPDF(data: Record<string, any>): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title: 'HR Analytics Report',
    subtitle: 'Dashboard Overview',
  });

  pdf.addHeader();

  // Key metrics
  pdf.addSectionTitle('Metriche Principali');
  const metrics = [
    { label: 'Dipendenti Totali', value: data.totalEmployees || data.total_employees || 0 },
    { label: 'Dipartimenti', value: data.totalDepartments || data.departments || 0 },
    { label: 'Tasso Turnover', value: `${(data.turnoverRate || 0).toFixed(1)}%` },
    { label: 'Anzianità Media', value: `${(data.avgTenure || 0).toFixed(1)} anni` },
  ];
  pdf.addMetricsSection(metrics);

  // Distribution by department
  if (data.byDepartment && data.byDepartment.length > 0) {
    pdf.addSectionTitle('Distribuzione per Dipartimento');
    pdf.addTable(
      [
        { header: 'Dipartimento', key: 'name', width: 200 },
        { header: 'Dipendenti', key: 'count', align: 'right', format: 'number' },
        { header: 'Percentuale', key: 'percentage', align: 'right', format: 'percent' },
      ],
      data.byDepartment.map((d: Record<string, any>) => ({
        name: d.name || d.department,
        count: d.count || d.employees,
        percentage: d.percentage || (d.count / data.totalEmployees) * 100,
      }))
    );
  }

  // Gender distribution
  if (data.byGender) {
    pdf.addSectionTitle('Distribuzione per Genere');
    pdf.addSummary([
      { label: 'Uomini', value: data.byGender.male || data.byGender.M || 0 },
      { label: 'Donne', value: data.byGender.female || data.byGender.F || 0 },
      { label: 'Altro', value: data.byGender.other || data.byGender.O || 0 },
    ]);
  }

  return pdf.generate();
}

/**
 * Generate Compensation Analytics PDF
 */
export async function generateCompensationPDF(data: Record<string, any>): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title: 'Compensation Analytics Report',
    subtitle: 'Analisi Retributiva',
  });

  pdf.addHeader();

  // Overview metrics
  if (data.overview || data.summary) {
    const overview = data.overview || data.summary;
    pdf.addSectionTitle('Panoramica');
    pdf.addMetricsSection([
      {
        label: 'Salario Medio',
        value: `€${(overview.avg_salary || overview.avgSalary || 0).toLocaleString('it-IT')}`,
      },
      {
        label: 'Salario Minimo',
        value: `€${(overview.min_salary || overview.minSalary || 0).toLocaleString('it-IT')}`,
      },
      {
        label: 'Salario Massimo',
        value: `€${(overview.max_salary || overview.maxSalary || 0).toLocaleString('it-IT')}`,
      },
      { label: 'Dipendenti', value: overview.total_employees || overview.count || 0 },
    ]);
  }

  // By department
  if (data.by_org_unit && data.by_org_unit.length > 0) {
    pdf.addSectionTitle('Retribuzione per Dipartimento');
    pdf.addTable(
      [
        { header: 'Dipartimento', key: 'department', width: 150 },
        { header: 'Dipendenti', key: 'employees', align: 'right', format: 'number' },
        { header: 'Media', key: 'avg_salary', align: 'right', format: 'currency' },
        { header: 'Min', key: 'min_salary', align: 'right', format: 'currency' },
        { header: 'Max', key: 'max_salary', align: 'right', format: 'currency' },
      ],
      data.by_org_unit
    );
  }

  // Pay equity
  if (data.pay_equity) {
    pdf.addSectionTitle('Pay Equity Analysis');
    pdf.addText('Analisi delle differenze retributive per genere e dipartimento.');
    if (Array.isArray(data.pay_equity)) {
      pdf.addTable(
        [
          { header: 'Categoria', key: 'category', width: 150 },
          { header: 'Gap %', key: 'gap_percentage', align: 'right', format: 'percent' },
          { header: 'Media M', key: 'male_avg', align: 'right', format: 'currency' },
          { header: 'Media F', key: 'female_avg', align: 'right', format: 'currency' },
        ],
        data.pay_equity
      );
    }
  }

  return pdf.generate();
}

/**
 * Generate Workforce Planning PDF
 */
export async function generateWorkforcePlanningPDF(data: Record<string, any>): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title: 'Workforce Planning Report',
    subtitle: 'Pianificazione Organico',
    orientation: 'landscape',
  });

  pdf.addHeader();

  // Turnover summary
  if (Array.isArray(data)) {
    pdf.addSectionTitle('Trend Turnover (Ultimi 12 Mesi)');
    pdf.addTable(
      [
        { header: 'Mese', key: 'month', width: 100 },
        { header: 'Uscite', key: 'departures', align: 'right', format: 'number' },
        { header: 'Volontarie', key: 'voluntary', align: 'right', format: 'number' },
        { header: 'Involontarie', key: 'involuntary', align: 'right', format: 'number' },
        { header: 'Tasso %', key: 'rate', align: 'right', format: 'percent' },
      ],
      data
    );
  }

  return pdf.generate();
}

/**
 * Generate Time & Attendance PDF
 */
export async function generateTimeAnalyticsPDF(data: Record<string, any>): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title: 'Time & Attendance Report',
    subtitle: 'Analisi Presenze e Orari',
  });

  pdf.addHeader();

  // Dashboard metrics
  if (data.summary || data.dashboard) {
    const summary = data.summary || data.dashboard;
    pdf.addSectionTitle('Riepilogo');
    pdf.addMetricsSection([
      { label: 'Ore Totali', value: summary.total_hours || summary.totalHours || 0 },
      { label: 'Ore Medie/Dip.', value: (summary.avg_hours || summary.avgHours || 0).toFixed(1) },
      {
        label: 'Tasso Presenza',
        value: `${(summary.attendance_rate || summary.attendanceRate || 0).toFixed(1)}%`,
      },
      { label: 'Ore Straordinario', value: summary.overtime_hours || summary.overtimeHours || 0 },
    ]);
  }

  // Overtime by department
  if (data.overtime_by_dept && data.overtime_by_dept.length > 0) {
    pdf.addSectionTitle('Straordinari per Dipartimento');
    pdf.addTable(
      [
        { header: 'Dipartimento', key: 'department', width: 200 },
        { header: 'Ore Totali', key: 'total_hours', align: 'right', format: 'number' },
        { header: 'Media/Dip.', key: 'avg_per_employee', align: 'right', format: 'number' },
      ],
      data.overtime_by_dept
    );
  }

  return pdf.generate();
}

/**
 * Generate Performance Analytics PDF
 */
export async function generatePerformancePDF(data: Record<string, any>): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title: 'Performance Analytics Report',
    subtitle: 'Analisi Performance',
  });

  pdf.addHeader();

  // Overview metrics
  pdf.addSectionTitle('Metriche Performance');
  pdf.addMetricsSection([
    { label: 'Score Medio', value: (data.avgScore || data.avg_score || 0).toFixed(1) },
    { label: 'Review Complete', value: data.completedReviews || data.completed_reviews || 0 },
    {
      label: 'Goals Raggiunti',
      value: `${(data.goalCompletion || data.goal_completion || 0).toFixed(0)}%`,
    },
    { label: 'Alto Rendimento', value: data.highPerformers || data.high_performers || 0 },
  ]);

  // Rating distribution
  if (data.ratingDistribution && data.ratingDistribution.length > 0) {
    pdf.addSectionTitle('Distribuzione Rating');
    pdf.addTable(
      [
        { header: 'Rating', key: 'rating', width: 150 },
        { header: 'Dipendenti', key: 'count', align: 'right', format: 'number' },
        { header: 'Percentuale', key: 'percentage', align: 'right', format: 'percent' },
      ],
      data.ratingDistribution
    );
  }

  return pdf.generate();
}

/**
 * Generate generic analytics PDF
 */
export async function generateGenericPDF(
  data: Record<string, any>,
  title: string
): Promise<Buffer> {
  const pdf = new PDFGenerator({
    title,
    subtitle: 'Analytics Export',
  });

  pdf.addHeader();

  // If data is an array, render as table
  if (Array.isArray(data) && data.length > 0) {
    const columns = Object.keys(data[0]).map((key) => ({
      header: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      key,
      width: Math.floor(pdf['contentWidth'] / Object.keys(data[0]).length),
    }));
    pdf.addTable(columns as TableColumn[], data);
  } else if (typeof data === 'object') {
    // Render as key-value summary
    const items = Object.entries(data)
      .filter(([, v]) => typeof v !== 'object')
      .map(([k, v]) => ({
        label: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        value: v,
      }));
    if (items.length > 0) {
      pdf.addSummary(items);
    }

    // Check for nested arrays
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0) {
        pdf.addSectionTitle(key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
        const columns = Object.keys(value[0]).map((k) => ({
          header: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          key: k,
        }));
        pdf.addTable(columns as TableColumn[], value);
      }
    }
  }

  return pdf.generate();
}

export default PDFGenerator;
