/**
 * Goals Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for goal CRUD endpoints.
 * All external dependencies (database, redis, services) are mocked.
 *
 * Core endpoints tested:
 *  GET    /goals/stats/summary    - Goal statistics
 *  GET    /goals/stats            - Goal statistics (alias)
 *  GET    /goals                  - List goals with filters
 *  GET    /goals/:id              - Single goal detail
 *  POST   /goals                  - Create a goal
 *  PUT    /goals/:id              - Update a goal
 *  DELETE /goals/:id              - Delete a goal
 *  PATCH  /goals/:id/progress     - Update progress
 *  GET    /goals/:id/children     - List child goals
 *  GET    /goals/templates        - List goal templates
 *  POST   /goals/templates        - Create goal template
 *  POST   /goals/from-template    - Create goal from template
 *  GET    /goals/team             - Team goals
 *  POST   /goals/:id/check-in     - Goal check-in
 *  POST   /goals/:id/validate-smart - SMART validation
 */
export {};
//# sourceMappingURL=goals.test.d.ts.map