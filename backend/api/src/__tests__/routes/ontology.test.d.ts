/**
 * Ontology Routes - Unit Tests
 * Tests HTTP behavior for the skill ontology system endpoints.
 * Note: Ontology routes use req.dbClient and lazy-initialized
 * OntologyEmbeddingService / CrossEntityEmbeddingService.
 *
 * Endpoints tested:
 *  GET    /stats                               - Ontology statistics
 *  GET    /skills                              - List skills with filters
 *  GET    /skills/popular-pairs                - Popular skill pairs
 *  GET    /skills/:id                          - Get skill detail
 *  GET    /skills/:id/dimensions               - KSABA dimensions for skill
 *  GET    /skills/:id/relations                - Skill relations
 *  GET    /skills/:id/suggestions              - Skill suggestions
 *  POST   /skills/search                       - Semantic search (Zod)
 *  POST   /skills/record-usage                 - Record skill usage (Zod)
 *  POST   /skills/:id/dimensions               - Create dimension (Zod)
 *  PUT    /skills/:id/dimensions/:dimensionId  - Update dimension (Zod)
 *  DELETE /skills/:id/dimensions/:dimensionId  - Delete dimension
 *  POST   /skills/:id/relations                - Create relation (Zod)
 *  DELETE /skills/:id/relations/:relationId    - Delete relation
 *  GET    /categories                          - List categories
 *  GET    /categories/:id                      - Get category detail
 *  POST   /categories                          - Create category (Zod)
 *  PUT    /categories/:id                      - Update category (Zod)
 *  DELETE /categories/:id                      - Delete category
 *  GET    /embeddings/status                   - Embedding status
 *  GET    /tenant-skills                       - List tenant custom skills
 *  POST   /tenant-skills                       - Create tenant skill (Zod)
 *  PUT    /tenant-skills/:id                   - Update tenant skill (Zod)
 *  DELETE /tenant-skills/:id                   - Delete tenant skill
 *  GET    /industries                          - List NACE industries
 *  GET    /industries/:code/occupations        - Occupations for industry
 */
export {};
//# sourceMappingURL=ontology.test.d.ts.map