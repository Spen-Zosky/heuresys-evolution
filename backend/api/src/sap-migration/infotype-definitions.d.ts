/**
 * SAP HCM Infotype Definitions
 * Defines structure and field mappings for SAP PA and HRP infotypes
 *
 * IMPORTANT: These tables are READ-ONLY archives - data flows FROM SAP TO Heuresys,
 * never the other way around. The Heuresys tables are the SOURCE OF TRUTH.
 */
export interface FieldDefinition {
    type: 'string' | 'date' | 'decimal' | 'integer' | 'text';
    length?: number;
    precision?: number;
    scale?: number;
    required?: boolean;
    description: string;
}
export interface FieldMapping {
    field: string;
    transform?: string;
    condition?: string;
}
export interface HeuresysMapping {
    targetTable: string;
    fieldMap: Record<string, string | FieldMapping>;
}
export interface InfotypeDefinition {
    name: string;
    description: string;
    sapTable: string;
    fields: Record<string, FieldDefinition>;
    subtypes?: Record<string, string>;
    objectTypes?: Record<string, string>;
    relationshipTypes?: Record<string, string>;
    heuresysMapping?: HeuresysMapping | Record<string, HeuresysMapping>;
}
export interface SupportedFormat {
    extension: string;
    mimeTypes: string[];
    delimiter?: string;
    alternateDelimiters?: string[];
    idocFormat?: boolean;
}
export declare const INFOTYPE_DEFINITIONS: Record<string, InfotypeDefinition>;
export declare const VALUE_TRANSFORMERS: {
    genderCode: (value: string | null | undefined) => string | null;
    dateFromSAP: (value: string | null | undefined) => string | null;
    decimalFromSAP: (value: string | number | null | undefined) => number | null;
    contractTypeFromSAP: (value: string | null | undefined) => string;
};
export declare const SUPPORTED_FORMATS: Record<string, SupportedFormat>;
export declare const PA_INFOTYPES: string[];
export declare const HRP_INFOTYPES: string[];
//# sourceMappingURL=infotype-definitions.d.ts.map