-- Migration 165: Map employee department codes to valid org_unit codes
-- Current: MI-RTL-BA-{AREA}-{LEVEL}-{NUM} (not matching any org_unit)
-- Target: org_unit.code values that exist in the DB

BEGIN;

-- Map area codes to org_unit codes for RTL Bank tenant
UPDATE employees SET department = 'DIR-RISKM'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-RISK-%';

UPDATE employees SET department = 'DIR-AFC'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-FIN-%';

UPDATE employees SET department = 'DIR-HR'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-HR-%';

UPDATE employees SET department = 'DIV-IT'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-IT-%';

UPDATE employees SET department = 'DIV-LEGAL'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-LEGAL-%';

UPDATE employees SET department = 'DIV-OPS'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-OPS-%';

UPDATE employees SET department = 'DIR-PROD'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-PROD-%';

UPDATE employees SET department = 'DIR-COMM'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-SALES-%';

UPDATE employees SET department = 'DIR-AML'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-CMPL-%';

UPDATE employees SET department = 'RTL'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department LIKE 'MI-RTL-BA-GEN-%';

-- Also fix 'General' department
UPDATE employees SET department = 'RTL'
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND department = 'General';

COMMIT;
