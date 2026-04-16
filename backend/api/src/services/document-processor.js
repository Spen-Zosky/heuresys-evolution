/**
 * Document Processor Service
 * Handles document ingestion, chunking, and embedding generation
 * Epic 5: AI HR Assistant - Stories 5.2, 5.3
 */
import { pool } from '../config/database.js';
import { createAIOrchestrator } from './ai-orchestrator.js';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
// =============================================================================
// DOCUMENT PROCESSOR CLASS
// =============================================================================
export class DocumentProcessor {
    tenantId;
    provider;
    constructor(tenantId, provider = 'openai') {
        this.tenantId = tenantId;
        this.provider = provider;
    }
    // ---------------------------------------------------------------------------
    // MAIN PROCESSING PIPELINE
    // ---------------------------------------------------------------------------
    async processDocument(documentId, options = {}) {
        const startTime = Date.now();
        try {
            // Update status to processing
            await this.updateDocumentStatus(documentId, 'processing');
            // Get document details
            const doc = await this.getDocument(documentId);
            if (!doc) {
                throw new Error('Document not found');
            }
            // Read document content (this would integrate with file storage)
            const content = await this.getDocumentContent(doc);
            // Chunk the document
            const chunks = this.chunkDocument(content, {
                chunkSize: options.chunkSize || 1000,
                chunkOverlap: options.chunkOverlap || 200,
            });
            // Store chunks
            const storedChunks = await this.storeChunks(documentId, chunks, options.knowledgeBaseId);
            // Generate embeddings (if API key available)
            let embeddingsGenerated = 0;
            try {
                embeddingsGenerated = await this.generateChunkEmbeddings(storedChunks, options.embeddingModel);
            }
            catch {
                logger.warn('Embedding generation skipped - no API key or error');
            }
            // Update document status
            await pool.query(`
        UPDATE rag_documents SET
          status = 'completed',
          chunk_count = $1,
          processed_at = NOW()
        WHERE id = $2 AND tenant_id = $3
      `, [chunks.length, documentId, this.tenantId]);
            return {
                documentId,
                chunksCreated: chunks.length,
                embeddingsGenerated,
                processingTimeMs: Date.now() - startTime,
                success: true,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await pool.query(`
        UPDATE rag_documents SET status = 'error', error_message = $1
        WHERE id = $2 AND tenant_id = $3
      `, [errorMessage, documentId, this.tenantId]);
            return {
                documentId,
                chunksCreated: 0,
                embeddingsGenerated: 0,
                processingTimeMs: Date.now() - startTime,
                success: false,
                error: errorMessage,
            };
        }
    }
    // ---------------------------------------------------------------------------
    // DOCUMENT RETRIEVAL
    // ---------------------------------------------------------------------------
    async getDocument(documentId) {
        const result = await pool.query(`
      SELECT id, filename, original_name, mime_type, file_path, source_type, metadata
      FROM rag_documents
      WHERE id = $1 AND tenant_id = $2
    `, [documentId, this.tenantId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            filename: row.filename,
            originalName: row.original_name,
            mimeType: row.mime_type,
            filePath: row.file_path,
            sourceType: row.source_type,
            metadata: row.metadata || {},
        };
    }
    async getDocumentContent(doc) {
        // In production, this would:
        // 1. Read from file storage (S3, GCS, local filesystem)
        // 2. Parse based on mime type (PDF, DOCX, TXT, etc.)
        // 3. Extract text content
        // For now, check if content is stored in metadata
        if (doc.metadata.content && typeof doc.metadata.content === 'string') {
            return doc.metadata.content;
        }
        // Placeholder - in production, integrate with file storage and parsers
        if (doc.filePath) {
            // Would read from filesystem or cloud storage
            return `[Document content from ${doc.filePath}]`;
        }
        return '';
    }
    async updateDocumentStatus(documentId, status) {
        await pool.query(`
      UPDATE rag_documents SET status = $1 WHERE id = $2 AND tenant_id = $3
    `, [status, documentId, this.tenantId]);
    }
    // ---------------------------------------------------------------------------
    // CHUNKING
    // ---------------------------------------------------------------------------
    chunkDocument(content, options) {
        const { chunkSize, chunkOverlap } = options;
        const chunks = [];
        // Split by paragraphs first, then combine to chunk size
        const paragraphs = content.split(/\n\s*\n/);
        let currentChunk = '';
        let currentStart = 0;
        let charIndex = 0;
        for (const paragraph of paragraphs) {
            const trimmedPara = paragraph.trim();
            if (!trimmedPara) {
                charIndex += paragraph.length + 2; // Account for newlines
                continue;
            }
            // Check if adding this paragraph exceeds chunk size
            if (currentChunk.length + trimmedPara.length > chunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    content: currentChunk.trim(),
                    index: chunks.length,
                    startChar: currentStart,
                    endChar: charIndex,
                    sectionTitle: this.extractSectionTitle(currentChunk),
                });
                // Start new chunk with overlap
                const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
                currentChunk = currentChunk.substring(overlapStart) + '\n\n' + trimmedPara;
                currentStart = charIndex - (currentChunk.length - trimmedPara.length - 2);
            }
            else {
                currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
            }
            charIndex += paragraph.length + 2;
        }
        // Don't forget the last chunk
        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                index: chunks.length,
                startChar: currentStart,
                endChar: charIndex,
                sectionTitle: this.extractSectionTitle(currentChunk),
            });
        }
        return chunks;
    }
    extractSectionTitle(text) {
        // Try to extract a title from the beginning of the chunk
        const lines = text.split('\n');
        const firstLine = lines[0]?.trim();
        // Check if first line looks like a title (short, ends with :, all caps, etc.)
        if (firstLine) {
            if (firstLine.length < 100) {
                if (firstLine.endsWith(':') || firstLine === firstLine.toUpperCase()) {
                    return firstLine.replace(/:$/, '');
                }
                // Check for markdown headers
                const headerMatch = firstLine.match(/^#+\s*(.+)$/);
                if (headerMatch) {
                    return headerMatch[1];
                }
            }
        }
        return undefined;
    }
    // ---------------------------------------------------------------------------
    // CHUNK STORAGE
    // ---------------------------------------------------------------------------
    async storeChunks(documentId, chunks, knowledgeBaseId) {
        const storedChunks = [];
        // Delete existing chunks for this document
        await pool.query('DELETE FROM rag_document_chunks WHERE document_id = $1 AND tenant_id = $2', [
            documentId,
            this.tenantId,
        ]);
        for (const chunk of chunks) {
            const contentHash = crypto.createHash('sha256').update(chunk.content).digest('hex');
            const result = await pool.query(`
        INSERT INTO rag_document_chunks (
          tenant_id, document_id, chunk_index, content, content_hash,
          start_char, end_char, section_title, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `, [
                this.tenantId,
                documentId,
                chunk.index,
                chunk.content,
                contentHash,
                chunk.startChar,
                chunk.endChar,
                chunk.sectionTitle || null,
            ]);
            storedChunks.push({
                id: result.rows[0].id,
                content: chunk.content,
            });
        }
        // Update knowledge base association if specified
        if (knowledgeBaseId) {
            await pool.query('UPDATE rag_documents SET knowledge_base_id = $1 WHERE id = $2 AND tenant_id = $3', [knowledgeBaseId, documentId, this.tenantId]);
        }
        return storedChunks;
    }
    // ---------------------------------------------------------------------------
    // EMBEDDING GENERATION
    // ---------------------------------------------------------------------------
    async generateChunkEmbeddings(chunks, model) {
        const orchestrator = createAIOrchestrator(this.tenantId, { provider: this.provider });
        let generated = 0;
        const batchSize = 10; // Process in batches to avoid rate limits
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map((c) => c.content);
            try {
                const { embeddings } = await orchestrator.generateEmbeddings({
                    tenantId: this.tenantId,
                    texts,
                    model,
                });
                // Store embeddings
                for (let j = 0; j < batch.length; j++) {
                    const chunk = batch[j];
                    const embedding = embeddings[j];
                    if (chunk && embedding) {
                        await pool.query(`
              UPDATE rag_document_chunks SET
                embedding = $1,
                embedding_model = $2,
                embedding_dimensions = $3
              WHERE id = $4
            `, [
                            JSON.stringify(embedding),
                            model || 'text-embedding-3-small',
                            embedding.length,
                            chunk.id,
                        ]);
                        generated++;
                    }
                }
            }
            catch (error) {
                logger.error(`Failed to generate embeddings for batch ${i}:${error}`);
            }
        }
        return generated;
    }
    // ---------------------------------------------------------------------------
    // CCNL INGESTION
    // ---------------------------------------------------------------------------
    async ingestCCNL(params) {
        // Create or update CCNL record
        const ccnlResult = await pool.query(`
      INSERT INTO ccnl_contracts (code, name, sector, full_text, full_text_version, effective_date, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        full_text = EXCLUDED.full_text,
        full_text_version = EXCLUDED.full_text_version,
        effective_date = EXCLUDED.effective_date,
        updated_at = NOW()
      RETURNING id
    `, [
            params.code,
            params.name,
            params.sector,
            params.fullText,
            params.version || '1.0',
            params.effectiveDate || null,
        ]);
        const ccnlId = ccnlResult.rows[0].id;
        // Find or create CCNL knowledge base
        const kbResult = await pool.query(`
      SELECT id FROM rag_knowledge_bases
      WHERE code = 'ccnl_' || $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      LIMIT 1
    `, [params.sector, this.tenantId]);
        let knowledgeBaseId;
        if (kbResult.rows.length === 0) {
            // Create tenant-specific knowledge base
            const newKb = await pool.query(`
        INSERT INTO rag_knowledge_bases (tenant_id, code, name, description, kb_type, is_public, is_active)
        VALUES ($1, $2, $3, $4, 'ccnl', true, true)
        RETURNING id
      `, [
                this.tenantId,
                `ccnl_${params.code.toLowerCase()}`,
                `CCNL ${params.name}`,
                `Contratto Collettivo Nazionale ${params.name}`,
            ]);
            knowledgeBaseId = newKb.rows[0].id;
        }
        else {
            knowledgeBaseId = kbResult.rows[0].id;
        }
        // Create document record
        const docResult = await pool.query(`
      INSERT INTO rag_documents (
        tenant_id, filename, original_name, mime_type, file_size,
        source_type, metadata, knowledge_base_id, status, is_latest, version
      ) VALUES ($1, $2, $3, 'text/plain', $4, 'ccnl', $5, $6, 'pending', true, 1)
      RETURNING id
    `, [
            this.tenantId,
            `ccnl_${params.code.toLowerCase()}.txt`,
            `CCNL ${params.name}`,
            params.fullText.length,
            JSON.stringify({ ...params.metadata, ccnlId, code: params.code }),
            knowledgeBaseId,
        ]);
        const documentId = docResult.rows[0].id;
        // Store the content in a way processDocument can access it
        await pool.query(`
      UPDATE rag_documents SET metadata = metadata || $1
      WHERE id = $2
    `, [JSON.stringify({ content: params.fullText }), documentId]);
        // Process the document
        await this.processDocument(documentId, { knowledgeBaseId });
        return { documentId, ccnlId };
    }
    // ---------------------------------------------------------------------------
    // COMPANY POLICY INGESTION
    // ---------------------------------------------------------------------------
    async ingestCompanyPolicy(params) {
        // Find or create company policy knowledge base
        const kbResult = await pool.query(`
      SELECT id FROM rag_knowledge_bases
      WHERE code = 'company_policies' AND tenant_id = $1
      LIMIT 1
    `, [this.tenantId]);
        let knowledgeBaseId;
        if (kbResult.rows.length === 0) {
            const newKb = await pool.query(`
        INSERT INTO rag_knowledge_bases (tenant_id, code, name, description, kb_type, is_public, is_active)
        VALUES ($1, 'company_policies', 'Politiche Aziendali', 'Documenti e politiche aziendali interne', 'company_policy', false, true)
        RETURNING id
      `, [this.tenantId]);
            knowledgeBaseId = newKb.rows[0].id;
        }
        else {
            knowledgeBaseId = kbResult.rows[0].id;
        }
        // Create document record
        const sanitizedTitle = params.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const docResult = await pool.query(`
      INSERT INTO rag_documents (
        tenant_id, filename, original_name, mime_type, file_size,
        source_type, metadata, knowledge_base_id, status, is_latest, version
      ) VALUES ($1, $2, $3, 'text/plain', $4, 'policy', $5, $6, 'pending', true, 1)
      RETURNING id
    `, [
            this.tenantId,
            `policy_${sanitizedTitle}.txt`,
            params.title,
            params.content.length,
            JSON.stringify({
                ...params.metadata,
                policyType: params.policyType,
                effectiveDate: params.effectiveDate,
                orgUnitId: params.orgUnitId,
                content: params.content,
            }),
            knowledgeBaseId,
        ]);
        const documentId = docResult.rows[0].id;
        // Process the document
        await this.processDocument(documentId, { knowledgeBaseId });
        return { documentId, knowledgeBaseId };
    }
    // ---------------------------------------------------------------------------
    // BULK PROCESSING
    // ---------------------------------------------------------------------------
    async processPendingDocuments(limit = 10) {
        const result = await pool.query(`
      SELECT id FROM rag_documents
      WHERE tenant_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
    `, [this.tenantId, limit]);
        const results = [];
        for (const row of result.rows) {
            const processingResult = await this.processDocument(row.id);
            results.push(processingResult);
        }
        return results;
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
export function createDocumentProcessor(tenantId, provider = 'openai') {
    return new DocumentProcessor(tenantId, provider);
}
export default DocumentProcessor;
//# sourceMappingURL=document-processor.js.map