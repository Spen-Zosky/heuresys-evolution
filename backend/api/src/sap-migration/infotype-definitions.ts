/**
 * SAP HCM Infotype Definitions
 * Defines structure and field mappings for SAP PA and HRP infotypes
 *
 * IMPORTANT: These tables are READ-ONLY archives - data flows FROM SAP TO Heuresys,
 * never the other way around. The Heuresys tables are the SOURCE OF TRUTH.
 */

// Type definitions
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

export const INFOTYPE_DEFINITIONS: Record<string, InfotypeDefinition> = {
  // ============================================
  // PA (Personnel Administration) Infotypes
  // ============================================

  PA0000: {
    name: 'Actions',
    description: 'Personnel actions/events',
    sapTable: 'pa0000',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      MASSN: { type: 'string', length: 2, description: 'Action type' },
      MASSG: { type: 'string', length: 2, description: 'Action reason' },
      STAT2: { type: 'string', length: 1, description: 'Employment status' }
    }
  },

  PA0001: {
    name: 'Organizational Assignment',
    description: 'Employee organizational assignment',
    sapTable: 'pa0001',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      BUKRS: { type: 'string', length: 4, description: 'Company code' },
      WERKS: { type: 'string', length: 4, description: 'Personnel area' },
      BTRTL: { type: 'string', length: 4, description: 'Personnel subarea' },
      PERSG: { type: 'string', length: 1, description: 'Employee group' },
      PERSK: { type: 'string', length: 2, description: 'Employee subgroup' },
      PLANS: { type: 'string', length: 8, description: 'Position' },
      ORGEH: { type: 'string', length: 8, description: 'Organizational unit' },
      STELL: { type: 'string', length: 8, description: 'Job' },
      KOSTL: { type: 'string', length: 10, description: 'Cost center' }
    },
    heuresysMapping: {
      targetTable: 'employees',
      fieldMap: {
        PERNR: 'pernr',
        BUKRS: 'company_code',
        WERKS: 'location',
        BTRTL: 'department',
        ORGEH: 'org_unit_code',
        PLANS: 'position_code',
        STELL: 'job_title_code',
        KOSTL: 'cost_center_code'
      }
    }
  },

  PA0002: {
    name: 'Personal Data',
    description: 'Employee personal data',
    sapTable: 'pa0002',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      NACHN: { type: 'string', length: 40, required: true, description: 'Last name' },
      VORNA: { type: 'string', length: 40, required: true, description: 'First name' },
      MIDNM: { type: 'string', length: 40, description: 'Middle name' },
      GBDAT: { type: 'date', description: 'Birth date' },
      GBORT: { type: 'string', length: 40, description: 'Birth place' },
      NATIO: { type: 'string', length: 3, description: 'Nationality' },
      GESCH: { type: 'string', length: 1, description: 'Gender (1=M, 2=F)' },
      FAMST: { type: 'string', length: 1, description: 'Marital status' }
    },
    heuresysMapping: {
      targetTable: 'employees',
      fieldMap: {
        PERNR: 'pernr',
        NACHN: 'last_name',
        VORNA: 'first_name',
        MIDNM: 'middle_name',
        GBDAT: 'birth_date',
        NATIO: 'nationality',
        GESCH: { field: 'gender', transform: 'genderCode' }
      }
    }
  },

  PA0006: {
    name: 'Addresses',
    description: 'Employee addresses',
    sapTable: 'pa0006',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Address type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      STRAS: { type: 'string', length: 60, description: 'Street' },
      ORT01: { type: 'string', length: 40, description: 'City' },
      PSTLZ: { type: 'string', length: 10, description: 'Postal code' },
      LAND1: { type: 'string', length: 3, description: 'Country' },
      REGIO: { type: 'string', length: 3, description: 'Region/Province' }
    },
    heuresysMapping: {
      targetTable: 'employee_addresses',
      fieldMap: {
        PERNR: 'employee_pernr',
        SUBTY: 'address_type',
        STRAS: 'street',
        ORT01: 'city',
        PSTLZ: 'postal_code',
        LAND1: 'country_code',
        REGIO: 'province'
      }
    }
  },

  PA0008: {
    name: 'Basic Pay',
    description: 'Employee basic pay information',
    sapTable: 'pa0008',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Pay type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      TRFAR: { type: 'string', length: 2, description: 'Pay scale area' },
      TRFGB: { type: 'string', length: 2, description: 'Pay scale type' },
      TRFGR: { type: 'string', length: 8, description: 'Pay scale group' },
      TRFST: { type: 'string', length: 2, description: 'Pay scale level' },
      ANSAL: { type: 'decimal', precision: 15, scale: 2, description: 'Annual salary' },
      BET01: { type: 'decimal', precision: 15, scale: 2, description: 'Wage type 1 amount' },
      LGA01: { type: 'string', length: 4, description: 'Wage type 1 code' },
      DIVGV: { type: 'integer', description: 'Divisor for payments (typically 12)' },
      WAESSION: { type: 'string', length: 5, description: 'Currency' },
      BESSION: { type: 'decimal', precision: 5, scale: 2, description: 'FTE percentage' }
    },
    heuresysMapping: {
      targetTable: 'employee_contracts',
      fieldMap: {
        PERNR: 'employee_pernr',
        TRFAR: 'pay_scale_area',
        TRFGB: 'ccnl_code',
        TRFGR: 'level',
        ANSAL: 'annual_salary',
        WAESSION: 'currency',
        BESSION: 'fte_percentage'
      }
    }
  },

  PA0009: {
    name: 'Bank Details',
    description: 'Employee bank details',
    sapTable: 'pa0009',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Bank subtype' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      BANKS: { type: 'string', length: 3, description: 'Bank country' },
      BANKL: { type: 'string', length: 15, description: 'Bank key (ABI)' },
      BANKN: { type: 'string', length: 18, description: 'Bank account number' },
      BKONT: { type: 'string', length: 2, description: 'Bank control key (CAB)' },
      IBAN: { type: 'string', length: 34, description: 'IBAN' },
      SWIFT: { type: 'string', length: 11, description: 'SWIFT/BIC' }
    }
  },

  PA0014: {
    name: 'Recurring Payments/Deductions',
    description: 'Recurring payments and deductions',
    sapTable: 'pa0014',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Wage type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      LGART: { type: 'string', length: 4, description: 'Wage type code' },
      BETRG: { type: 'decimal', precision: 15, scale: 2, description: 'Amount' },
      WAESSION: { type: 'string', length: 5, description: 'Currency' }
    }
  },

  PA0016: {
    name: 'Contract Elements',
    description: 'Contract elements and details',
    sapTable: 'pa0016',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Contract type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      CTTYP: { type: 'string', length: 2, description: 'Contract category' },
      CTEFP: { type: 'date', description: 'Contract end date' }
    },
    heuresysMapping: {
      targetTable: 'employee_contracts',
      fieldMap: {
        PERNR: 'employee_pernr',
        CTTYP: 'contract_type',
        BEGDA: 'start_date',
        CTEFP: 'end_date'
      }
    }
  },

  PA0105: {
    name: 'Communication',
    description: 'Communication data (email, phone)',
    sapTable: 'pa0105',
    fields: {
      PERNR: { type: 'string', length: 8, required: true, description: 'Personnel number' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Communication type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      USRID: { type: 'string', length: 30, description: 'User ID / Value' },
      USRID_LONG: { type: 'string', length: 241, description: 'Long communication value (email)' }
    },
    subtypes: {
      '0001': 'System username',
      '0010': 'Email',
      '0020': 'Mobile phone',
      '0030': 'Work phone'
    },
    heuresysMapping: {
      targetTable: 'employees',
      fieldMap: {
        PERNR: 'pernr',
        USRID_LONG: { field: 'email', condition: "SUBTY = '0010'" }
      }
    }
  },

  // ============================================
  // HRP (Organizational Management) Infotypes
  // ============================================

  HRP1000: {
    name: 'Object',
    description: 'Organizational object (org unit, position, job)',
    sapTable: 'hrp1000',
    fields: {
      PLVAR: { type: 'string', length: 2, required: true, description: 'Plan variant' },
      OTYPE: { type: 'string', length: 2, required: true, description: 'Object type (O=OrgUnit, S=Position, C=Job)' },
      OBJID: { type: 'string', length: 8, required: true, description: 'Object ID' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      LANGU: { type: 'string', length: 2, description: 'Language key' },
      STEXT: { type: 'string', length: 40, description: 'Short text' },
      LTEXT: { type: 'string', length: 80, description: 'Long text' }
    },
    objectTypes: {
      'O': 'Organizational Unit',
      'S': 'Position',
      'C': 'Job',
      'P': 'Person',
      'K': 'Cost Center'
    },
    heuresysMapping: {
      'O': { targetTable: 'org_units', fieldMap: { OBJID: 'code', STEXT: 'name', LTEXT: 'description' } },
      'S': { targetTable: 'positions', fieldMap: { OBJID: 'code', STEXT: 'name', LTEXT: 'description' } },
      'C': { targetTable: 'job_titles', fieldMap: { OBJID: 'code', STEXT: 'name', LTEXT: 'description' } }
    }
  },

  HRP1001: {
    name: 'Relationships',
    description: 'Organizational relationships',
    sapTable: 'hrp1001',
    fields: {
      PLVAR: { type: 'string', length: 2, required: true, description: 'Plan variant' },
      OTYPE: { type: 'string', length: 2, required: true, description: 'Object type' },
      OBJID: { type: 'string', length: 8, required: true, description: 'Object ID' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Relationship type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      RSIGN: { type: 'string', length: 1, description: 'Relationship direction (A/B)' },
      RELAT: { type: 'string', length: 3, description: 'Relationship code' },
      SCLAS: { type: 'string', length: 2, description: 'Related object type' },
      SOBID: { type: 'string', length: 8, description: 'Related object ID' }
    },
    relationshipTypes: {
      'A002': 'Reports to',
      'B002': 'Is line manager of',
      'A003': 'Belongs to (Org Unit)',
      'B003': 'Incorporates',
      'A007': 'Describes (Job)',
      'A008': 'Holder (Position-Person)'
    }
  },

  HRP1002: {
    name: 'Description',
    description: 'Extended descriptions',
    sapTable: 'hrp1002',
    fields: {
      PLVAR: { type: 'string', length: 2, required: true, description: 'Plan variant' },
      OTYPE: { type: 'string', length: 2, required: true, description: 'Object type' },
      OBJID: { type: 'string', length: 8, required: true, description: 'Object ID' },
      SUBTY: { type: 'string', length: 4, required: true, description: 'Description type' },
      ENDDA: { type: 'date', required: true, description: 'End date' },
      BEGDA: { type: 'date', required: true, description: 'Start date' },
      LANGU: { type: 'string', length: 2, description: 'Language' },
      TLINE: { type: 'text', description: 'Description text' }
    }
  }
};

// Value transformations
export const VALUE_TRANSFORMERS = {
  genderCode: (value: string | null | undefined): string | null => {
    if (!value) return null;
    const map: Record<string, string> = { '1': 'M', '2': 'F', 'M': 'M', 'F': 'F' };
    return map[value] || null;
  },

  dateFromSAP: (value: string | null | undefined): string | null => {
    if (!value) return null;
    // SAP date format: YYYYMMDD or YYYY-MM-DD
    if (value.includes('-')) return value;
    if (value.length === 8) {
      return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    return value;
  },

  decimalFromSAP: (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    // SAP may use comma as decimal separator
    return parseFloat(String(value).replace(',', '.'));
  },

  contractTypeFromSAP: (value: string | null | undefined): string => {
    if (!value) return 'altro';
    const map: Record<string, string> = {
      '01': 'indeterminato',
      '02': 'determinato',
      '03': 'apprendistato',
      '04': 'somministrazione',
      '05': 'collaborazione',
      '06': 'tirocinio'
    };
    return map[value] || 'altro';
  }
};

// Supported file formats
export const SUPPORTED_FORMATS: Record<string, SupportedFormat> = {
  CSV: {
    extension: '.csv',
    mimeTypes: ['text/csv', 'application/csv', 'text/plain'],
    delimiter: '|', // SAP standard
    alternateDelimiters: [';', ',', '\t']
  },
  XML: {
    extension: '.xml',
    mimeTypes: ['application/xml', 'text/xml'],
    idocFormat: true
  },
  JSON: {
    extension: '.json',
    mimeTypes: ['application/json']
  }
};

// List of all PA infotypes in order
export const PA_INFOTYPES: string[] = [
  'PA0000', 'PA0001', 'PA0002', 'PA0003', 'PA0005', 'PA0006', 'PA0007', 'PA0008',
  'PA0009', 'PA0014', 'PA0015', 'PA0016', 'PA0017', 'PA0019', 'PA0021', 'PA0022',
  'PA0024', 'PA0025', 'PA0027', 'PA0032', 'PA0041', 'PA0105', 'PA0167', 'PA0168',
  'PA0169', 'PA0170', 'PA0171', 'PA0185', 'PA2000', 'PA2001', 'PA2002', 'PA2003',
  'PA2004', 'PA2005', 'PA2006', 'PA2007', 'PA2010', 'PA2011', 'PA2012', 'PA2013'
];

// List of all HRP infotypes
export const HRP_INFOTYPES: string[] = [
  'HRP1000', 'HRP1001', 'HRP1002', 'HRP1003', 'HRP1005', 'HRP1006', 'HRP1007',
  'HRP1008', 'HRP1010', 'HRP1011', 'HRP1013', 'HRP1014', 'HRP1035', 'HRP1036',
  'HRP5001', 'HRP5002', 'HRPDEV1'
];
