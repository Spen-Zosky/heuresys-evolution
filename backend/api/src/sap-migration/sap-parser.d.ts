/**
 * SAP Export File Parser
 * Parses CSV, XML, and JSON exports from SAP HCM
 *
 * Story 6.1: SAP Export File Parser
 * Accepts: CSV (SAP format with | delimiter), XML (IDoc), JSON, ZIP archives
 */
import { InfotypeDefinition } from './infotype-definitions.js';
export interface ParseError {
    type: string;
    message: string;
    line?: number;
    field?: string;
    content?: string;
    stack?: string;
}
export interface ParseWarning {
    type: string;
    message: string;
    line?: number;
    field?: string;
}
export interface ParseOptions {
    filename?: string;
    infotype?: string;
    encoding?: BufferEncoding;
}
export interface ParserOptions {
    maxFileSize?: number;
    encoding?: BufferEncoding;
}
export interface SAPRecord {
    _infotype?: string;
    [key: string]: unknown;
}
export interface ParseResult {
    success: boolean;
    format?: string;
    filename?: string;
    data?: SAPRecord[];
    infotypes?: string[];
    summary?: {
        filesProcessed: number;
        totalRecords: number;
        recordsByInfotype: Record<string, number>;
        parseErrors: number;
        warnings: number;
        duration?: string;
    };
    errors: ParseError[];
    warnings: ParseWarning[];
}
export interface InternalParseResult {
    data: SAPRecord[];
    infotypes: string[];
    totalRecords: number;
    recordsByInfotype: Record<string, number>;
}
export interface FileInput {
    content: Buffer | string;
    filename: string;
}
export interface MultipleParseResult {
    success: boolean;
    files: {
        filename: string;
        success: boolean;
        records: number;
        infotypes: string[];
        errors: number;
    }[];
    combinedData: SAPRecord[];
    summary: {
        filesProcessed: number;
        totalRecords: number;
        recordsByInfotype: Record<string, number>;
        parseErrors: number;
        warnings: number;
    };
    allErrors: ParseError[];
    allWarnings: ParseWarning[];
}
export interface ValidationResult {
    valid: boolean;
    errors: {
        field: string;
        message: string;
    }[];
    warnings: {
        field?: string;
        message: string;
    }[];
}
/**
 * Main parser class for SAP export files
 */
export declare class SAPParser {
    private options;
    private errors;
    private warnings;
    constructor(options?: ParserOptions);
    /**
     * Parse a file or buffer and return structured data
     */
    parse(input: Buffer | string, options?: ParseOptions): Promise<ParseResult>;
    /**
     * Detect file format from content and filename
     */
    private detectFormat;
    /**
     * Parse CSV content (SAP format with | delimiter)
     */
    private parseCSV;
    /**
     * Parse a single CSV line handling quoted values
     */
    private parseCSVLine;
    /**
     * Detect CSV delimiter
     */
    private detectDelimiter;
    /**
     * Check if row is a header row
     */
    private isHeaderRow;
    /**
     * Infer headers from data if not provided
     */
    private inferHeaders;
    /**
     * Detect infotype from filename or headers
     */
    private detectInfotype;
    /**
     * Map values to a record using definition
     */
    private mapToRecord;
    /**
     * Parse XML content (IDoc format)
     */
    private parseXML;
    /**
     * Detect infotype from XML segment name
     */
    private detectInfotypeFromSegment;
    /**
     * Parse JSON content
     */
    private parseJSON;
    /**
     * Parse multiple files (e.g., from ZIP extraction)
     */
    parseMultiple(files: FileInput[]): Promise<MultipleParseResult>;
    /**
     * Get infotype definition
     */
    getInfotypeDefinition(infotype: string | null | undefined): InfotypeDefinition | null;
    /**
     * Get all supported infotypes
     */
    getSupportedInfotypes(): {
        PA: string[];
        HRP: string[];
        all: string[];
    };
    /**
     * Validate a record against infotype definition
     */
    validateRecord(record: SAPRecord, infotype: string): ValidationResult;
}
//# sourceMappingURL=sap-parser.d.ts.map