/**
 * O*NET Routes - Unit Tests
 * Tests HTTP behavior for O*NET occupational data endpoints.
 * Note: O*NET routes use req.dbClient and some use ONetImportService.
 *
 * Endpoints tested:
 *  GET    /stats                      - Database statistics
 *  POST   /import/jobs                - Create import job (Zod)
 *  GET    /import/jobs                - List import jobs
 *  GET    /import/jobs/:jobId         - Get job status
 *  POST   /import/jobs/:jobId/execute - Execute import (Zod)
 *  POST   /map-to-esco               - Map skills to ESCO (Zod)
 *  GET    /occupations                - List occupations
 *  GET    /occupations/search         - Search occupations
 *  GET    /occupations/:id            - Get occupation
 *  GET    /occupations/:id/skills     - Skills for occupation
 *  GET    /skills                     - List skills
 *  GET    /skills/:id/occupations     - Occupations for skill
 *  GET    /unified-skills             - Unified skills view
 *  GET    /abilities                  - List abilities
 *  GET    /knowledge                  - List knowledge
 *  GET    /work-activities            - List work activities
 */
export {};
//# sourceMappingURL=onet.test.d.ts.map