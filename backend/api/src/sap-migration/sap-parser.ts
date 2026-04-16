/**
 * SAP Export File Parser
 * Parses CSV, XML, and JSON exports from SAP HCM
 *
 * Story 6.1: SAP Export File Parser
 * Accepts: CSV (SAP format with | delimiter), XML (IDoc), JSON, ZIP archives
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  INFOTYPE_DEFINITIONS,
  VALUE_TRANSFORMERS,
  PA_INFOTYPES,
  HRP_INFOTYPES,
  InfotypeDefinition
} from './infotype-definitions.js';

// Type definitions
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
  errors: { field: string; message: string }[];
  warnings: { field?: string; message: string }[];
}

/**
 * Main parser class for SAP export files
 */
export class SAPParser {
  private options: Required<ParserOptions>;
  private errors: ParseError[] = [];
  private warnings: ParseWarning[] = [];

  constructor(options: ParserOptions = {}) {
    this.options = {
      maxFileSize: options.maxFileSize ?? 100 * 1024 * 1024, // 100MB
      encoding: options.encoding ?? 'utf-8'
    };
  }

  /**
   * Parse a file or buffer and return structured data
   */
  async parse(input: Buffer | string, options: ParseOptions = {}): Promise<ParseResult> {
    const startTime = Date.now();
    this.errors = [];
    this.warnings = [];

    try {
      // Determine input type
      let content: string;
      let filename = options.filename || 'unknown';

      if (Buffer.isBuffer(input)) {
        content = input.toString(this.options.encoding);
      } else if (typeof input === 'string') {
        if (input.length < 500 && fs.existsSync(input)) {
          // It's a file path
          filename = path.basename(input);
          content = fs.readFileSync(input, this.options.encoding);
        } else {
          // It's content
          content = input;
        }
      } else {
        throw new Error('Invalid input: expected Buffer or string');
      }

      // Detect format
      const format = this.detectFormat(content, filename);

      // Parse based on format
      let result: InternalParseResult;
      switch (format) {
        case 'CSV':
          result = await this.parseCSV(content, options);
          break;
        case 'XML':
          result = await this.parseXML(content, options);
          break;
        case 'JSON':
          result = await this.parseJSON(content, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        format,
        filename,
        data: result.data,
        infotypes: result.infotypes,
        summary: {
          filesProcessed: 1,
          totalRecords: result.totalRecords,
          recordsByInfotype: result.recordsByInfotype,
          parseErrors: this.errors.length,
          warnings: this.warnings.length,
          duration: `${duration}ms`
        },
        errors: this.errors,
        warnings: this.warnings
      };
    } catch (error) {
      const err = error as Error;
      this.errors.push({
        type: 'FATAL',
        message: err.message,
        stack: err.stack || ''
      });

      return {
        success: false,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Detect file format from content and filename
   */
  private detectFormat(content: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    // Check by extension first
    if (ext === '.csv') return 'CSV';
    if (ext === '.xml') return 'XML';
    if (ext === '.json') return 'JSON';

    // Detect from content
    const trimmed = content.trim();

    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      return 'XML';
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'JSON';
    }

    // Default to CSV
    return 'CSV';
  }

  /**
   * Parse CSV content (SAP format with | delimiter)
   */
  private async parseCSV(content: string, options: ParseOptions = {}): Promise<InternalParseResult> {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    // Detect delimiter
    const firstLineStr = lines[0];
    if (!firstLineStr) {
      throw new Error('Empty CSV file');
    }
    const delimiter = this.detectDelimiter(firstLineStr);

    // Check if first line is header
    const firstLine = firstLineStr.split(delimiter);
    const hasHeader = this.isHeaderRow(firstLine);

    let headers: string[];
    let dataStartIndex: number;

    if (hasHeader) {
      headers = firstLine.map(h => h.trim().toUpperCase());
      dataStartIndex = 1;
    } else {
      // Try to detect infotype from content
      headers = this.inferHeaders(firstLine, options.infotype);
      dataStartIndex = 0;
    }

    // Detect infotype from filename or headers
    const infotype = options.infotype || this.detectInfotype(options.filename, headers);

    if (!infotype) {
      this.warnings.push({
        type: 'INFOTYPE_UNKNOWN',
        message: 'Could not determine infotype, using generic parsing'
      });
    }

    const definition = infotype ? INFOTYPE_DEFINITIONS[infotype] : undefined;
    const data: SAPRecord[] = [];
    const recordsByInfotype: Record<string, number> = {};

    for (let i = dataStartIndex; i < lines.length; i++) {
      const lineContent = lines[i];
      if (!lineContent) continue;
      const line = lineContent.trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line, delimiter);
        const record = this.mapToRecord(headers, values, definition, i + 1);

        if (record) {
          // Add infotype to record if known
          if (infotype) {
            record._infotype = infotype;
            recordsByInfotype[infotype] = (recordsByInfotype[infotype] || 0) + 1;
          }
          data.push(record);
        }
      } catch (error) {
        const err = error as Error;
        this.errors.push({
          type: 'PARSE_ERROR',
          line: i + 1,
          message: err.message,
          content: line.substring(0, 100)
        });
      }
    }

    return {
      data,
      infotypes: infotype ? [infotype] : [],
      totalRecords: data.length,
      recordsByInfotype
    };
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Detect CSV delimiter
   */
  private detectDelimiter(line: string): string {
    const delimiters = ['|', ';', ',', '\t'];
    let bestDelimiter = '|';
    let maxCount = 0;

    for (const d of delimiters) {
      const count = (line.match(new RegExp('\\' + d, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }

    return bestDelimiter;
  }

  /**
   * Check if row is a header row
   */
  private isHeaderRow(values: string[]): boolean {
    // Header rows typically contain field names like PERNR, BEGDA, etc.
    const sapFieldPattern = /^[A-Z][A-Z0-9_]{2,}$/;
    const matchCount = values.filter(v => sapFieldPattern.test(v.trim())).length;
    return matchCount > values.length * 0.5; // More than half look like field names
  }

  /**
   * Infer headers from data if not provided
   */
  private inferHeaders(values: string[], infotype?: string): string[] {
    if (infotype && INFOTYPE_DEFINITIONS[infotype]) {
      return Object.keys(INFOTYPE_DEFINITIONS[infotype].fields);
    }

    // Generic numbered headers
    return values.map((_, i) => `FIELD${i + 1}`);
  }

  /**
   * Detect infotype from filename or headers
   */
  private detectInfotype(filename: string | null | undefined, headers: string[]): string | null {
    // Check filename
    if (filename) {
      const upper = filename.toUpperCase();

      // Match PA0001, HRP1000, etc.
      const match = upper.match(/(PA\d{4}|HRP\d{4})/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Check headers for characteristic fields
    const headerSet = new Set(headers);

    if (headerSet.has('NACHN') && headerSet.has('VORNA')) {
      return 'PA0002'; // Personal data
    }
    if (headerSet.has('ORGEH') && headerSet.has('PLANS') && headerSet.has('BUKRS')) {
      return 'PA0001'; // Org assignment
    }
    if (headerSet.has('STRAS') && headerSet.has('ORT01')) {
      return 'PA0006'; // Addresses
    }
    if (headerSet.has('ANSAL') || headerSet.has('TRFGR')) {
      return 'PA0008'; // Basic pay
    }
    if (headerSet.has('OTYPE') && headerSet.has('OBJID') && headerSet.has('STEXT')) {
      return 'HRP1000'; // Objects
    }
    if (headerSet.has('RSIGN') && headerSet.has('RELAT') && headerSet.has('SOBID')) {
      return 'HRP1001'; // Relationships
    }

    return null;
  }

  /**
   * Map values to a record using definition
   */
  private mapToRecord(
    headers: string[],
    values: string[],
    definition: InfotypeDefinition | undefined,
    lineNumber: number
  ): SAPRecord | null {
    const record: SAPRecord = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = values[i];

      if (value === undefined || value === '') {
        continue;
      }

      // Get field definition if available
      const fieldDef = header ? definition?.fields?.[header] : undefined;

      // Transform value based on type
      let transformedValue: unknown = value;

      if (fieldDef) {
        try {
          switch (fieldDef.type) {
            case 'date':
              transformedValue = VALUE_TRANSFORMERS.dateFromSAP(value);
              break;
            case 'decimal':
              transformedValue = VALUE_TRANSFORMERS.decimalFromSAP(value);
              break;
            case 'integer':
              const parsed = parseInt(value, 10);
              transformedValue = isNaN(parsed) ? null : parsed;
              break;
          }
        } catch {
          if (header) {
            this.warnings.push({
              type: 'TRANSFORM_WARNING',
              line: lineNumber,
              field: header,
              message: `Could not transform value: ${value}`
            });
          }
        }
      }

      if (header) {
        record[header] = transformedValue;
      }
    }

    // Validate required fields
    if (definition?.fields) {
      for (const [field, def] of Object.entries(definition.fields)) {
        if (def.required && !record[field]) {
          this.warnings.push({
            type: 'MISSING_REQUIRED',
            line: lineNumber,
            field,
            message: `Required field ${field} is missing`
          });
        }
      }
    }

    return Object.keys(record).length > 0 ? record : null;
  }

  /**
   * Parse XML content (IDoc format)
   */
  private async parseXML(content: string, _options: ParseOptions = {}): Promise<InternalParseResult> {
    // Simple XML parser for SAP IDoc format
    const data: SAPRecord[] = [];
    const recordsByInfotype: Record<string, number> = {};
    const infotypesFound = new Set<string>();

    // Extract segments (SAP IDoc structure)
    const segmentPattern = /<(E1P\w+|SEGMENT)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = segmentPattern.exec(content)) !== null) {
      const segmentName = match[1];
      const segmentContent = match[3];
      if (!segmentName || !segmentContent) continue;

      // Parse fields within segment
      const record: SAPRecord = {};
      const fieldPattern = /<(\w+)>([^<]*)<\/\1>/g;
      let fieldMatch;

      while ((fieldMatch = fieldPattern.exec(segmentContent)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2];
        if (fieldName && fieldValue !== undefined) {
          record[fieldName.toUpperCase()] = fieldValue.trim();
        }
      }

      if (Object.keys(record).length > 0) {
        // Detect infotype from segment name or content
        const infotype = this.detectInfotypeFromSegment(segmentName, record);
        if (infotype) {
          record._infotype = infotype;
          infotypesFound.add(infotype);
          recordsByInfotype[infotype] = (recordsByInfotype[infotype] || 0) + 1;
        }
        data.push(record);
      }
    }

    // Fallback: try simple record extraction
    if (data.length === 0) {
      const recordPattern = /<record([^>]*)>([\s\S]*?)<\/record>/gi;
      while ((match = recordPattern.exec(content)) !== null) {
        const record: SAPRecord = {};
        const fieldPattern = /<(\w+)>([^<]*)<\/\1>/g;
        let fieldMatch;

        const matchContent = match[2];
        if (matchContent) {
          while ((fieldMatch = fieldPattern.exec(matchContent)) !== null) {
            const fieldName = fieldMatch[1];
            const fieldValue = fieldMatch[2];
            if (fieldName && fieldValue !== undefined) {
              record[fieldName.toUpperCase()] = fieldValue.trim();
            }
          }
        }

        if (Object.keys(record).length > 0) {
          data.push(record);
        }
      }
    }

    return {
      data,
      infotypes: Array.from(infotypesFound),
      totalRecords: data.length,
      recordsByInfotype
    };
  }

  /**
   * Detect infotype from XML segment name
   */
  private detectInfotypeFromSegment(segmentName: string, record: SAPRecord): string | null {
    // E1P0001 -> PA0001
    const match = segmentName.match(/E1P(\d{4})/i);
    if (match && match[1]) {
      return `PA${match[1]}`;
    }

    // E1HRP1000 -> HRP1000
    const hrpMatch = segmentName.match(/E1(HRP\d{4})/i);
    if (hrpMatch && hrpMatch[1]) {
      return hrpMatch[1].toUpperCase();
    }

    // Try to detect from record fields
    return this.detectInfotype(null, Object.keys(record));
  }

  /**
   * Parse JSON content
   */
  private async parseJSON(content: string, _options: ParseOptions = {}): Promise<InternalParseResult> {
    const parsed = JSON.parse(content);
    const data: SAPRecord[] = [];
    const recordsByInfotype: Record<string, number> = {};
    const infotypesFound = new Set<string>();

    // Handle different JSON structures
    let records: Record<string, unknown>[];

    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (parsed.records) {
      records = parsed.records;
    } else if (parsed.data) {
      records = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    } else {
      // Single record or object with infotype keys
      if (parsed.PERNR || parsed.pernr) {
        records = [parsed];
      } else {
        // Try infotype keys like { PA0001: [...], PA0002: [...] }
        records = [];
        for (const [key, value] of Object.entries(parsed)) {
          if (Array.isArray(value)) {
            const infotype = key.toUpperCase();
            if (PA_INFOTYPES.includes(infotype) || HRP_INFOTYPES.includes(infotype)) {
              infotypesFound.add(infotype);
              for (const rec of value as Record<string, unknown>[]) {
                (rec as SAPRecord)._infotype = infotype;
                records.push(rec);
                recordsByInfotype[infotype] = (recordsByInfotype[infotype] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // Normalize records
    for (const record of records) {
      const normalized: SAPRecord = {};

      for (const [key, value] of Object.entries(record)) {
        normalized[key.toUpperCase()] = value;
      }

      // Detect infotype if not set
      if (!normalized._INFOTYPE) {
        const infotype = this.detectInfotype(null, Object.keys(normalized));
        if (infotype) {
          normalized._infotype = infotype;
          infotypesFound.add(infotype);
          recordsByInfotype[infotype] = (recordsByInfotype[infotype] || 0) + 1;
        }
      }

      data.push(normalized);
    }

    return {
      data,
      infotypes: Array.from(infotypesFound),
      totalRecords: data.length,
      recordsByInfotype
    };
  }

  /**
   * Parse multiple files (e.g., from ZIP extraction)
   */
  async parseMultiple(files: FileInput[]): Promise<MultipleParseResult> {
    const results: MultipleParseResult = {
      success: true,
      files: [],
      combinedData: [],
      summary: {
        filesProcessed: 0,
        totalRecords: 0,
        recordsByInfotype: {},
        parseErrors: 0,
        warnings: 0
      },
      allErrors: [],
      allWarnings: []
    };

    for (const file of files) {
      const result = await this.parse(file.content, { filename: file.filename });

      results.files.push({
        filename: file.filename,
        success: result.success,
        records: result.data?.length || 0,
        infotypes: result.infotypes || [],
        errors: result.errors?.length || 0
      });

      if (result.success && result.data) {
        results.combinedData.push(...result.data);
        results.summary.filesProcessed++;
        results.summary.totalRecords += result.data.length;

        // Merge recordsByInfotype
        for (const [infotype, count] of Object.entries(result.summary?.recordsByInfotype || {})) {
          results.summary.recordsByInfotype[infotype] =
            (results.summary.recordsByInfotype[infotype] || 0) + count;
        }
      }

      results.allErrors.push(...(result.errors || []));
      results.allWarnings.push(...(result.warnings || []));
    }

    results.summary.parseErrors = results.allErrors.length;
    results.summary.warnings = results.allWarnings.length;
    results.success = results.summary.filesProcessed > 0;

    return results;
  }

  /**
   * Get infotype definition
   */
  getInfotypeDefinition(infotype: string | null | undefined): InfotypeDefinition | null {
    if (!infotype) return null;
    return INFOTYPE_DEFINITIONS[infotype.toUpperCase()] || null;
  }

  /**
   * Get all supported infotypes
   */
  getSupportedInfotypes(): { PA: string[]; HRP: string[]; all: string[] } {
    return {
      PA: PA_INFOTYPES,
      HRP: HRP_INFOTYPES,
      all: [...PA_INFOTYPES, ...HRP_INFOTYPES]
    };
  }

  /**
   * Validate a record against infotype definition
   */
  validateRecord(record: SAPRecord, infotype: string): ValidationResult {
    const definition = INFOTYPE_DEFINITIONS[infotype];
    if (!definition) {
      return { valid: true, errors: [], warnings: [{ message: `Unknown infotype: ${infotype}` }] };
    }

    const errors: { field: string; message: string }[] = [];
    const warnings: { field?: string; message: string }[] = [];

    for (const [field, def] of Object.entries(definition.fields)) {
      const value = record[field];

      // Check required
      if (def.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `Required field ${field} is missing` });
        continue;
      }

      if (value === undefined || value === null) continue;

      // Check type
      switch (def.type) {
        case 'string':
          if (def.length && String(value).length > def.length) {
            warnings.push({
              field,
              message: `Field ${field} exceeds max length ${def.length}`
            });
          }
          break;
        case 'date':
          const dateVal = VALUE_TRANSFORMERS.dateFromSAP(String(value));
          if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            errors.push({ field, message: `Invalid date format for ${field}` });
          }
          break;
        case 'decimal':
        case 'integer':
          if (isNaN(parseFloat(String(value)))) {
            errors.push({ field, message: `Invalid numeric value for ${field}` });
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
