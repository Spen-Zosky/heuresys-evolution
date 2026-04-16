/**
 * Embeddings API Routes
 *
 * Exposes the embedding generation pipeline via REST endpoints.
 * Provides queue management, processing triggers, semantic search,
 * and queue statistics.
 *
 * Endpoints:
 * - POST /embeddings/queue       — Queue entities for embedding generation
 * - POST /embeddings/process     — Trigger queue processing (admin only)
 * - POST /embeddings/search      — Semantic similarity search
 * - GET  /embeddings/stats       — Queue statistics
 * - POST /embeddings/reindex     — Re-generate embedding for an entity
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=embeddings.d.ts.map