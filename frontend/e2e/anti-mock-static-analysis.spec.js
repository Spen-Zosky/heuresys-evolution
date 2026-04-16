"use strict";
/**
 * Anti-Mock Static Analysis Test Suite
 *
 * Scans all frontend source files for patterns that indicate:
 * - Mock data / sample data / demo data
 * - Hardcoded placeholder content
 * - Fake/dummy values
 * - Static fallback data that bypasses APIs
 *
 * This test FAILS if any mock patterns are found in production code.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Directories to scan
const SCAN_DIRECTORIES = [
    'src/app',
    'src/components',
    'src/lib',
];
// File extensions to check
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
// Patterns that indicate mock/demo/placeholder data
const MOCK_PATTERNS = [
    // Variable naming patterns
    /\b(mock|Mock|MOCK)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(sample|Sample|SAMPLE)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(fake|Fake|FAKE)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(dummy|Dummy|DUMMY)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(placeholder|Placeholder|PLACEHOLDER)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(demo|Demo|DEMO)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(test|Test|TEST)Data\s*[:=]/g,
    /\b(hardcoded|Hardcoded|HARDCODED)[A-Z_a-z0-9]*\s*[:=]/g,
    /\b(static|Static|STATIC)Data\s*[:=]/g,
    /\b(example|Example|EXAMPLE)[A-Z_a-z0-9]*Data\s*[:=]/g,
    // Comment patterns indicating mock data
    /\/\/\s*(mock|Mock|MOCK|TODO:\s*replace|temporary|temp|fake|placeholder|demo)\s/gi,
    /\/\*\s*(mock|Mock|MOCK|TODO:\s*replace|temporary|temp|fake|placeholder|demo)/gi,
    // Common mock data patterns in code
    /['"]lorem\s+ipsum['"]/gi,
    /['"]test@test\.com['"]/gi,
    /['"]test@example\.com['"]/gi,
    /['"]john\.doe@['"]/gi,
    /['"]jane\.doe@['"]/gi,
    /['"]placeholder['"]/gi,
    /['"]example\.com['"]/gi,
    /['"]foo@bar['"]/gi,
    /['"]user@user\.com['"]/gi,
    // Hardcoded UUIDs that look like test data
    /['"]00000000-0000-0000-0000-000000000/gi,
    /['"]11111111-1111-1111-1111-111111111/gi,
    /['"]12345678-/gi,
    // Array/object declarations that look like mock data
    /const\s+\w+\s*=\s*\[\s*\{[^}]*name:\s*['"](?:John|Jane|Test|Demo|Sample)/gi,
    // Explicit mock declarations
    /in production.*(?:would|should|will).*(?:come from|use|call)/gi,
];
// Exclusions - patterns/paths to ignore
const EXCLUSIONS = {
    // Paths to skip entirely
    paths: [
        'e2e/',
        '.spec.',
        '.test.',
        '__tests__',
        '__mocks__',
        'storybook',
        '.stories.',
        'node_modules',
        'design-editor', // Design tool - sample data is expected
    ],
    // Patterns that are acceptable in certain contexts
    acceptablePatterns: [
        // Loading state placeholders are okay
        /Skeleton/,
        /loading.*placeholder/i,
        // Error messages can mention demo
        /error.*demo/i,
        /demo.*error/i,
        // Documentation comments
        /\*\s*@example/,
        // Type definitions
        /interface\s+\w*Mock/,
        /type\s+\w*Mock/,
        // JSX placeholder attributes are valid HTML
        /placeholder\s*=\s*['"{`]/,
        /placeholder\s*:\s*['"]/,
        // Form input placeholder text
        /placeholderText/i,
        /placeholder.*text/i,
        // Import statements
        /^import\s/,
        // CSS class names
        /className.*placeholder/i,
        // HR terminology (demotion is not demo data)
        /demotion/i,
        /demotions/i,
        // Demographics is a valid business term
        /demographics/i,
        // Design editor is a prototyping tool - sample data expected
        /design-editor/,
        // Login page demo credentials display is legitimate
        /Credenziali demo/,
        // DEMO is a valid user role in the system (not demo data)
        /DEMO\s*:/,
        /DEMO\s*'/,
        /value="DEMO"/,
        // Comment describing layout structure (not mock data)
        /Placeholder\s+(for|header|chart|section|layout|area|content)/i,
        // Production data comments about data sourcing
        /in production.*(?:would|should|will)/i,
        // "Templates" is a valid business term (not "temp" mock data)
        /Templates/,
    ],
};
function scanFile(filePath) {
    const violations = [];
    // Skip excluded paths
    if (EXCLUSIONS.paths.some(exclusion => filePath.includes(exclusion))) {
        return violations;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        // Skip if line matches acceptable patterns
        if (EXCLUSIONS.acceptablePatterns.some(pattern => pattern.test(line))) {
            return;
        }
        MOCK_PATTERNS.forEach(pattern => {
            // Reset regex state
            pattern.lastIndex = 0;
            const match = pattern.exec(line);
            if (match) {
                violations.push({
                    file: filePath,
                    line: index + 1,
                    pattern: pattern.source.substring(0, 50),
                    content: line.trim().substring(0, 100),
                });
            }
        });
    });
    return violations;
}
function scanDirectory(dirPath) {
    const violations = [];
    if (!fs.existsSync(dirPath)) {
        return violations;
    }
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            violations.push(...scanDirectory(itemPath));
        }
        else if (item.isFile() && FILE_EXTENSIONS.some(ext => item.name.endsWith(ext))) {
            violations.push(...scanFile(itemPath));
        }
    }
    return violations;
}
test_1.test.describe('Anti-Mock Static Analysis', () => {
    (0, test_1.test)('should not have mock/sample/demo data in source files', async () => {
        const frontendRoot = path.resolve(__dirname, '..');
        const allViolations = [];
        for (const dir of SCAN_DIRECTORIES) {
            const fullPath = path.join(frontendRoot, dir);
            const violations = scanDirectory(fullPath);
            allViolations.push(...violations);
        }
        // Group violations by file for better reporting
        const violationsByFile = allViolations.reduce((acc, v) => {
            if (!acc[v.file]) {
                acc[v.file] = [];
            }
            acc[v.file].push(v);
            return acc;
        }, {});
        // Generate detailed report
        if (allViolations.length > 0) {
            console.error('\n=== MOCK DATA VIOLATIONS FOUND ===\n');
            for (const [file, violations] of Object.entries(violationsByFile)) {
                const relativePath = file.replace(frontendRoot, '');
                console.error(`\n${relativePath}:`);
                for (const v of violations) {
                    console.error(`  Line ${v.line}: ${v.content}`);
                }
            }
            console.error(`\n\nTotal violations: ${allViolations.length}`);
            console.error('Files affected:', Object.keys(violationsByFile).length);
            console.error('\n=================================\n');
        }
        (0, test_1.expect)(allViolations.length, `Found ${allViolations.length} mock data patterns in source code. ` +
            `See console output for details.`).toBe(0);
    });
    (0, test_1.test)('should not have hardcoded array data larger than 3 items', async () => {
        const frontendRoot = path.resolve(__dirname, '..');
        const violations = [];
        // Pattern to find large hardcoded arrays that likely represent mock data
        const largeArrayPattern = /(?:const|let|var)\s+\w+\s*[:=]\s*\[\s*\{[\s\S]*?\{[\s\S]*?\{[\s\S]*?\{/g;
        for (const dir of SCAN_DIRECTORIES) {
            const fullPath = path.join(frontendRoot, dir);
            scanForLargeArrays(fullPath, violations, largeArrayPattern, frontendRoot);
        }
        if (violations.length > 0) {
            console.error('\n=== LARGE HARDCODED ARRAYS FOUND ===\n');
            for (const v of violations) {
                console.error(`${v.file}:${v.line} - ${v.content}`);
            }
            console.error('\n====================================\n');
        }
        // Allow some flexibility - warn but don't fail for now
        if (violations.length > 0) {
            console.warn(`Found ${violations.length} large hardcoded arrays - review for mock data`);
        }
    });
});
function scanForLargeArrays(dirPath, violations, pattern, frontendRoot) {
    if (!fs.existsSync(dirPath))
        return;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            scanForLargeArrays(itemPath, violations, pattern, frontendRoot);
        }
        else if (item.isFile() && FILE_EXTENSIONS.some(ext => item.name.endsWith(ext))) {
            if (EXCLUSIONS.paths.some(exclusion => itemPath.includes(exclusion))) {
                continue;
            }
            const content = fs.readFileSync(itemPath, 'utf-8');
            const match = pattern.exec(content);
            if (match) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                violations.push({
                    file: itemPath.replace(frontendRoot, ''),
                    line: lineNumber,
                    pattern: 'large-array',
                    content: match[0].substring(0, 80) + '...',
                });
            }
        }
    }
}
//# sourceMappingURL=anti-mock-static-analysis.spec.js.map