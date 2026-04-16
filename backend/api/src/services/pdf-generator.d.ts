/**
 * PDF Generator Service
 * Sprint 2025-11 - S-ANLT-01-07: Export & Reporting Engine
 *
 * Generates professional PDF reports for analytics dashboards
 */
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
export declare class PDFGenerator {
    private doc;
    private options;
    private currentY;
    private pageCount;
    private marginTop;
    private marginBottom;
    private marginLeft;
    private marginRight;
    private contentWidth;
    private pageHeight;
    constructor(options: PDFReportOptions);
    /**
     * Generate PDF buffer
     */
    generate(): Promise<Buffer>;
    /**
     * Add header section
     */
    addHeader(): void;
    /**
     * Add section title
     */
    addSectionTitle(title: string): void;
    /**
     * Add metrics cards section
     */
    addMetricsSection(metrics: Array<{
        label: string;
        value: string | number;
        change?: number;
    }>): void;
    /**
     * Add data table
     */
    addTable(columns: TableColumn[], data: Record<string, any>[]): void;
    /**
     * Add summary section with key-value pairs
     */
    addSummary(items: Array<{
        label: string;
        value: string | number;
    }>): void;
    /**
     * Add plain text paragraph
     */
    addText(text: string): void;
    /**
     * Add space
     */
    addSpace(height?: number): void;
    /**
     * Check if page break is needed
     */
    private checkPageBreak;
    /**
     * Add page numbers to all pages
     */
    private addPageNumbers;
    /**
     * Format number with locale
     */
    private formatNumber;
    /**
     * Format currency
     */
    private formatCurrency;
}
/**
 * Generate HR Dashboard PDF
 */
export declare function generateHRDashboardPDF(data: Record<string, any>): Promise<Buffer>;
/**
 * Generate Compensation Analytics PDF
 */
export declare function generateCompensationPDF(data: Record<string, any>): Promise<Buffer>;
/**
 * Generate Workforce Planning PDF
 */
export declare function generateWorkforcePlanningPDF(data: Record<string, any>): Promise<Buffer>;
/**
 * Generate Time & Attendance PDF
 */
export declare function generateTimeAnalyticsPDF(data: Record<string, any>): Promise<Buffer>;
/**
 * Generate Performance Analytics PDF
 */
export declare function generatePerformancePDF(data: Record<string, any>): Promise<Buffer>;
/**
 * Generate generic analytics PDF
 */
export declare function generateGenericPDF(data: Record<string, any>, title: string): Promise<Buffer>;
export default PDFGenerator;
//# sourceMappingURL=pdf-generator.d.ts.map