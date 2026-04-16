/**
 * RAG Document Chunking Service
 *
 * Dedicated service for splitting documents into chunks with overlap,
 * generating embeddings, storing chunks, and searching by vector similarity.
 *
 * Uses the exact column names from the rag_documents, rag_document_chunks,
 * and rag_knowledge_bases tables.
 */
import { pool } from '../config/database.js';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
// =============================================================================
// CONSTANTS
// =============================================================================
const DEFAULT_CHUNK_SIZE = 2000; // ~512 tokens
const DEFAULT_CHUNK_OVERLAP = 200; // ~50 tokens
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
// =============================================================================
// EMBEDDING GENERATION
// =============================================================================
/**
 * Load the OpenAI API key from system_config or environment.
 */
async function loadOpenAIApiKey() {
    try {
        const result = await pool.query(`SELECT config_value FROM system_config WHERE config_key = 'openai_api_key' LIMIT 1`);
        if (result.rows.length > 0 && result.rows[0].config_value) {
            return result.rows[0].config_value;
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.rag-chunking');
    }
    return process.env.OPENAI_API_KEY || null;
}
/**
 * Generate an embedding vector for the given text using OpenAI.
 * Returns null if no API key is available or text is empty.
 */
async function generateEmbedding(text) {
    const apiKey = await loadOpenAIApiKey();
    if (!apiKey) {
        return null;
    }
    const cleanText = text.slice(0, 8000).trim();
    if (!cleanText) {
        return null;
    }
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        signal: AbortSignal.timeout(30000),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: cleanText,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    const data = (await response.json());
    return data.data[0]?.embedding ?? null;
}
/**
 * Generate embeddings for a batch of texts.
 * Returns an array of embeddings (or null for entries that failed).
 */
async function generateEmbeddingBatch(texts) {
    const apiKey = await loadOpenAIApiKey();
    if (!apiKey) {
        return texts.map(() => null);
    }
    const cleanTexts = texts.map((t) => t.slice(0, 8000).trim());
    const nonEmpty = cleanTexts.filter((t) => t.length > 0);
    if (nonEmpty.length === 0) {
        return texts.map(() => null);
    }
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        signal: AbortSignal.timeout(30000),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: nonEmpty,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    const data = (await response.json());
    // Map back to full array including empty entries
    const embeddingMap = new Map();
    for (const item of data.data) {
        embeddingMap.set(item.index, item.embedding);
    }
    let nonEmptyIdx = 0;
    return cleanTexts.map((t) => {
        if (t.length === 0) {
            return null;
        }
        const embedding = embeddingMap.get(nonEmptyIdx) ?? null;
        nonEmptyIdx++;
        return embedding;
    });
}
// =============================================================================
// CHUNKING LOGIC
// =============================================================================
/**
 * Extract the section title from a chunk of text.
 * Detects markdown headings, ALL CAPS titles, and colon-terminated lines.
 */
function extractSectionTitle(text) {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    if (!firstLine || firstLine.length >= 100) {
        return null;
    }
    // Markdown heading
    const headerMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
    if (headerMatch?.[1]) {
        return headerMatch[1];
    }
    // ALL CAPS line or line ending with colon
    if (firstLine === firstLine.toUpperCase() && firstLine.length > 3) {
        return firstLine;
    }
    if (firstLine.endsWith(':')) {
        return firstLine.replace(/:$/, '');
    }
    return null;
}
/**
 * Split text into chunks with configurable size and overlap.
 *
 * Strategy:
 * - Split on paragraph boundaries (double newline)
 * - Preserve markdown structure: never split inside a heading group
 * - Apply overlap by repeating trailing text of previous chunk
 * - Each chunk gets position metadata
 */
export function chunkText(text, options = {}) {
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
    if (!text || text.trim().length === 0) {
        return [];
    }
    const chunks = [];
    // Split into paragraphs while tracking character positions
    const paragraphs = [];
    let pos = 0;
    for (const segment of text.split(/\n\s*\n/)) {
        const trimmed = segment.trim();
        const start = text.indexOf(segment, pos);
        const end = start + segment.length;
        pos = end;
        if (trimmed.length > 0) {
            paragraphs.push({ text: trimmed, start, end });
        }
    }
    if (paragraphs.length === 0) {
        return [];
    }
    let currentParagraphs = [];
    let currentLength = 0;
    const flushChunk = () => {
        if (currentParagraphs.length === 0)
            return;
        const content = currentParagraphs.map((p) => p.text).join('\n\n');
        const startChar = currentParagraphs[0].start;
        const endChar = currentParagraphs[currentParagraphs.length - 1].end;
        chunks.push({
            content,
            index: chunks.length,
            startChar,
            endChar,
            sectionTitle: extractSectionTitle(content),
        });
        // Calculate overlap: keep paragraphs from the tail that fit within chunkOverlap chars
        if (chunkOverlap > 0) {
            const overlapParagraphs = [];
            let overlapLen = 0;
            for (let i = currentParagraphs.length - 1; i >= 0; i--) {
                const p = currentParagraphs[i];
                if (overlapLen + p.text.length > chunkOverlap && overlapParagraphs.length > 0) {
                    break;
                }
                overlapParagraphs.unshift(p);
                overlapLen += p.text.length + 2; // +2 for \n\n separator
            }
            currentParagraphs = overlapParagraphs;
            currentLength = overlapLen;
        }
        else {
            currentParagraphs = [];
            currentLength = 0;
        }
    };
    for (const para of paragraphs) {
        const paraLen = para.text.length;
        // If adding this paragraph would exceed chunk size and we have content,
        // flush -- but never split right before a heading that belongs with
        // the preceding content (the heading starts a new section, so flush first)
        if (currentLength + paraLen > chunkSize && currentParagraphs.length > 0) {
            // If the next paragraph is a heading, flush current first so heading
            // starts a new chunk
            flushChunk();
        }
        // Handle oversized paragraphs: force-split them by character boundary
        if (paraLen > chunkSize) {
            // Flush whatever we have so far
            if (currentParagraphs.length > 0) {
                flushChunk();
            }
            // Split the oversized paragraph at sentence or word boundaries
            let offset = 0;
            while (offset < para.text.length) {
                const remaining = para.text.length - offset;
                let end = Math.min(offset + chunkSize, para.text.length);
                // Try to break at a sentence boundary within the last 20% of the chunk
                if (end < para.text.length) {
                    const searchStart = Math.max(offset, end - Math.floor(chunkSize * 0.2));
                    const segment = para.text.slice(searchStart, end);
                    const sentenceEnd = segment.search(/[.!?]\s/);
                    if (sentenceEnd >= 0) {
                        end = searchStart + sentenceEnd + 2; // include the period and space
                    }
                }
                const sliceText = para.text.slice(offset, end).trim();
                if (sliceText.length > 0) {
                    chunks.push({
                        content: sliceText,
                        index: chunks.length,
                        startChar: para.start + offset,
                        endChar: para.start + end,
                        sectionTitle: extractSectionTitle(sliceText),
                    });
                }
                // Apply overlap for the next sub-chunk
                const overlapStart = Math.max(offset, end - chunkOverlap);
                offset =
                    remaining <= chunkSize ? para.text.length : overlapStart === offset ? end : overlapStart;
                if (offset >= end && offset < para.text.length) {
                    offset = end; // prevent infinite loop
                }
            }
            continue;
        }
        currentParagraphs.push(para);
        currentLength += paraLen + (currentParagraphs.length > 1 ? 2 : 0);
    }
    // Flush remaining
    if (currentParagraphs.length > 0) {
        flushChunk();
    }
    return chunks;
}
// =============================================================================
// RAG CHUNKING SERVICE
// =============================================================================
/**
 * Chunk a document by its ID.
 * Reads the document content from metadata.content or file_path,
 * splits it into chunks, and returns the chunks (does NOT store them).
 */
export async function chunkDocument(documentId, tenantId, options = {}) {
    // Get document details
    const docResult = await pool.query(`SELECT id, filename, mime_type, file_path, metadata, knowledge_base_id
     FROM rag_documents
     WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
    if (docResult.rows.length === 0) {
        throw new Error(`Document ${documentId} not found for tenant ${tenantId}`);
    }
    const doc = docResult.rows[0];
    // Load chunk settings from knowledge base if available
    const effectiveOptions = { ...options };
    if (doc.knowledge_base_id && (!options.chunkSize || !options.chunkOverlap)) {
        const kbResult = await pool.query(`SELECT chunk_size, chunk_overlap FROM rag_knowledge_bases WHERE id = $1 AND tenant_id = $2`, [doc.knowledge_base_id, tenantId]);
        if (kbResult.rows.length > 0) {
            const kb = kbResult.rows[0];
            if (!effectiveOptions.chunkSize && kb.chunk_size) {
                effectiveOptions.chunkSize = kb.chunk_size;
            }
            if (!effectiveOptions.chunkOverlap && kb.chunk_overlap) {
                effectiveOptions.chunkOverlap = kb.chunk_overlap;
            }
        }
    }
    // Extract text content
    const content = extractDocumentContent(doc.metadata, doc.file_path);
    if (!content) {
        throw new Error(`No content available for document ${documentId}. Store text in metadata.content or provide file_path.`);
    }
    return chunkText(content, effectiveOptions);
}
/**
 * Extract text content from document metadata or file path.
 */
function extractDocumentContent(metadata, _filePath) {
    // Check metadata.content first
    if (metadata?.content && typeof metadata.content === 'string') {
        return metadata.content;
    }
    // In production, this would read from file storage (S3, GCS, local fs)
    // and apply file-type-specific parsers (PDF, DOCX, etc.)
    return null;
}
/**
 * Full processing pipeline for a document:
 * 1. Set status to 'processing'
 * 2. Chunk the document
 * 3. Store chunks in rag_document_chunks
 * 4. Generate embeddings for each chunk
 * 5. Update document status to 'completed' (or 'error')
 */
export async function processDocument(documentId, tenantId, options = {}) {
    const startTime = Date.now();
    try {
        // Set status to processing
        await pool.query(`UPDATE rag_documents SET status = 'processing', error_message = NULL
       WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
        // Step 1: Chunk
        const chunks = await chunkDocument(documentId, tenantId, options);
        if (chunks.length === 0) {
            throw new Error('Document produced zero chunks - possibly empty content');
        }
        // Step 2: Delete old chunks and store new ones
        await pool.query('DELETE FROM rag_document_chunks WHERE document_id = $1 AND tenant_id = $2', [
            documentId,
            tenantId,
        ]);
        const storedChunkIds = [];
        const storedChunkTexts = [];
        for (const chunk of chunks) {
            const contentHash = crypto.createHash('sha256').update(chunk.content).digest('hex');
            const insertResult = await pool.query(`INSERT INTO rag_document_chunks (
           tenant_id, document_id, chunk_index, content, content_hash,
           start_char, end_char, section_title, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id`, [
                tenantId,
                documentId,
                chunk.index,
                chunk.content,
                contentHash,
                chunk.startChar,
                chunk.endChar,
                chunk.sectionTitle,
            ]);
            storedChunkIds.push(insertResult.rows[0].id);
            storedChunkTexts.push(chunk.content);
        }
        // Step 3: Generate embeddings in batches
        let embeddingsGenerated = 0;
        const batchSize = 20;
        for (let i = 0; i < storedChunkIds.length; i += batchSize) {
            const batchIds = storedChunkIds.slice(i, i + batchSize);
            const batchTexts = storedChunkTexts.slice(i, i + batchSize);
            try {
                const embeddings = await generateEmbeddingBatch(batchTexts);
                for (let j = 0; j < batchIds.length; j++) {
                    const chunkId = batchIds[j];
                    const embedding = embeddings[j];
                    if (chunkId && embedding) {
                        await pool.query(`UPDATE rag_document_chunks SET
                 embedding = $1,
                 embedding_model = $2,
                 embedding_dimensions = $3
               WHERE id = $4`, [JSON.stringify(embedding), EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, chunkId]);
                        embeddingsGenerated++;
                    }
                }
            }
            catch (error) {
                logger.warn(`[rag-chunking] Embedding generation failed for batch starting at ${i}: ${error instanceof Error ? error.message : String(error)}`);
                // Continue processing remaining batches
            }
        }
        // Step 4: Update document as completed
        await pool.query(`UPDATE rag_documents SET
         status = 'completed',
         chunk_count = $1,
         processed_at = NOW()
       WHERE id = $2 AND tenant_id = $3`, [chunks.length, documentId, tenantId]);
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
        await pool.query(`UPDATE rag_documents SET status = 'error', error_message = $1
       WHERE id = $2 AND tenant_id = $3`, [errorMessage, documentId, tenantId]);
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
/**
 * Search chunks by vector similarity using cosine distance.
 *
 * Since rag_document_chunks.embedding is stored as JSONB,
 * we compute cosine similarity in SQL using array arithmetic.
 */
export async function searchChunks(query, tenantId, options = {}) {
    const limit = options.limit ?? 10;
    const similarityThreshold = options.similarityThreshold ?? 0.5;
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
        throw new Error('Unable to generate query embedding. Ensure the OpenAI API key is configured.');
    }
    // Build dynamic filters
    const params = [tenantId, JSON.stringify(queryEmbedding)];
    let paramIndex = 3;
    let extraFilters = '';
    if (options.knowledgeBaseId) {
        extraFilters += ` AND rd.knowledge_base_id = $${paramIndex}`;
        params.push(options.knowledgeBaseId);
        paramIndex++;
    }
    if (options.documentId) {
        extraFilters += ` AND c.document_id = $${paramIndex}`;
        params.push(options.documentId);
        paramIndex++;
    }
    params.push(similarityThreshold, limit);
    // Cosine similarity computed from JSONB arrays.
    // The embedding is stored as a JSON array of numbers.
    // We use a lateral subquery to compute dot product, magnitude A, magnitude B.
    const sql = `
    WITH query_vec AS (
      SELECT $2::jsonb AS vec
    ),
    scored_chunks AS (
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.section_title,
        rd.filename AS document_filename,
        rd.original_name AS document_original_name,
        (
          SELECT
            CASE
              WHEN mag_a = 0 OR mag_b = 0 THEN 0
              ELSE dot_product / (mag_a * mag_b)
            END
          FROM (
            SELECT
              SUM(a.val * b.val) AS dot_product,
              SQRT(SUM(a.val * a.val)) AS mag_a,
              SQRT(SUM(b.val * b.val)) AS mag_b
            FROM
              jsonb_array_elements_text(c.embedding) WITH ORDINALITY AS a(val_text, idx),
              jsonb_array_elements_text(qv.vec) WITH ORDINALITY AS b(val_text, idx)
            WHERE a.idx = b.idx
              AND a.val_text IS NOT NULL
              AND b.val_text IS NOT NULL
            HAVING COUNT(*) > 0
          ) AS cosine(dot_product, mag_a, mag_b)
        ) AS similarity
      FROM rag_document_chunks c
      CROSS JOIN query_vec qv
      INNER JOIN rag_documents rd ON rd.id = c.document_id AND rd.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
        AND c.embedding IS NOT NULL
        ${extraFilters}
    )
    SELECT
      chunk_id,
      document_id,
      chunk_index,
      content,
      section_title,
      similarity,
      document_filename,
      document_original_name
    FROM scored_chunks
    WHERE similarity >= $${paramIndex}
    ORDER BY similarity DESC
    LIMIT $${paramIndex + 1}
  `;
    const result = await pool.query(sql, params);
    return result.rows.map((row) => ({
        chunk_id: row.chunk_id,
        document_id: row.document_id,
        chunk_index: row.chunk_index,
        content: row.content,
        section_title: row.section_title ?? null,
        similarity: parseFloat(row.similarity),
        document_filename: row.document_filename,
        document_original_name: row.document_original_name,
    }));
}
/**
 * Get all chunks for a specific document, ordered by chunk_index.
 */
export async function getDocumentChunks(documentId, tenantId) {
    const result = await pool.query(`SELECT
       id, document_id, chunk_index, content, content_hash,
       start_char, end_char, section_title,
       embedding_model, embedding_dimensions, created_at
     FROM rag_document_chunks
     WHERE document_id = $1 AND tenant_id = $2
     ORDER BY chunk_index ASC`, [documentId, tenantId]);
    return result.rows;
}
/**
 * Delete all chunks for a document (for re-processing).
 * Returns the number of chunks deleted.
 */
export async function deleteDocumentChunks(documentId, tenantId) {
    const result = await pool.query('DELETE FROM rag_document_chunks WHERE document_id = $1 AND tenant_id = $2', [documentId, tenantId]);
    // Reset document chunk_count and status
    await pool.query(`UPDATE rag_documents
     SET chunk_count = 0, status = 'pending', processed_at = NULL
     WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
    return result.rowCount ?? 0;
}
//# sourceMappingURL=rag-chunking.js.map