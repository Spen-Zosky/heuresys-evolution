/**
 * Review Cycles Routes - Unit Tests
 * Tests review cycle CRUD, participant management, phase management,
 * template management, launch/close lifecycle, and progress tracking.
 *
 * Endpoints tested:
 *  GET    /review-cycles                              - List cycles
 *  GET    /review-cycles/active                       - Active cycles
 *  GET    /review-cycles/stats                        - Statistics
 *  GET    /review-cycles/:id                          - Get cycle
 *  POST   /review-cycles                              - Create cycle
 *  PATCH  /review-cycles/:id                          - Update cycle
 *  DELETE /review-cycles/:id                          - Delete cycle
 *  GET    /review-cycles/:id/details                  - Detailed cycle view
 *  GET    /review-cycles/:id/participants             - List participants
 *  POST   /review-cycles/:id/participants             - Add participants
 *  GET    /review-cycles/:id/participants/:pid        - Get participant
 *  PATCH  /review-cycles/:id/participants/:pid        - Update participant
 *  DELETE /review-cycles/:id/participants/:pid        - Remove participant
 *  POST   /review-cycles/:id/launch                   - Launch cycle
 *  POST   /review-cycles/:id/close                    - Close cycle
 *  GET    /review-cycles/:id/progress                 - Progress summary
 *  GET    /review-cycles/:id/phases                   - List phases
 *  POST   /review-cycles/:id/phases                   - Add phases
 *  PATCH  /review-cycles/:id/phases/:phaseId          - Update phase
 *  GET    /review-cycles/config/templates             - List templates
 *  POST   /review-cycles/config/templates             - Create template
 *  GET    /review-cycles/config/templates/:tid        - Get template
 *  PATCH  /review-cycles/config/templates/:tid        - Update template
 *  POST   /review-cycles/:id/auto-assign              - Auto-assign participants
 *  GET    /review-cycles/config/rating-scales         - Rating scales
 *  GET    /review-cycles/:id/summary                  - Cycle summary
 */
export {};
//# sourceMappingURL=review-cycles.test.d.ts.map