/**
 * RAG Document Chunking Service
 *
 * Dedicated service for splitting documents into chunks with overlap,
 * generating embeddings, storing chunks, and searching by vector similarity.
 *
 * Uses the exact column names from the rag_documents, rag_document_chunks,
 * and rag_knowledge_bases tables.
 */
export interface ChunkOptions {
    /** Target chunk size in characters (default: 2000, ~512 tokens) */
    chunkSize?: number | undefined;
    /** Overlap between chunks in characters (default: 200, ~50 tokens) */
    chunkOverlap?: number | undefined;
}
export interface TextChunk {
    content: string;
    index: number;
    startChar: number;
    endChar: number;
    sectionTitle: string | null;
}
export interface StoredChunk {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    content_hash: string;
    start_char: number;
    end_char: number;
    section_title: string | null;
    embedding_model: string | null;
    embedding_dimensions: number | null;
    created_at: string;
}
export interface ProcessDocumentResult {
    documentId: string;
    chunksCreated: number;
    embeddingsGenerated: number;
    processingTimeMs: number;
    success: boolean;
    error?: string;
}
export interface SearchOptions {
    /** Maximum number of results (default: 10) */
    limit?: number | undefined;
    /** Minimum similarity score threshold 0-1 (default: 0.5) */
    similarityThreshold?: number | undefined;
    /** Filter by knowledge base id */
    knowledgeBaseId?: string | undefined;
    /** Filter by document id */
    documentId?: string | undefined;
}
export interface SearchResult {
    chunk_id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    section_title: string | null;
    similarity: number;
    document_filename: string;
    document_original_name: string;
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
export declare function chunkText(text: string, options?: ChunkOptions): TextChunk[];
/**
 * Chunk a document by its ID.
 * Reads the document content from metadata.content or file_path,
 * splits it into chunks, and returns the chunks (does NOT store them).
 */
export declare function chunkDocument(documentId: string, tenantId: string, options?: ChunkOptions): Promise<TextChunk[]>;
/**
 * Full processing pipeline for a document:
 * 1. Set status to 'processing'
 * 2. Chunk the document
 * 3. Store chunks in rag_document_chunks
 * 4. Generate embeddings for each chunk
 * 5. Update document status to 'completed' (or 'error')
 */
export declare function processDocument(documentId: string, tenantId: string, options?: ChunkOptions): Promise<ProcessDocumentResult>;
/**
 * Search chunks by vector similarity using cosine distance.
 *
 * Since rag_document_chunks.embedding is stored as JSONB,
 * we compute cosine similarity in SQL using array arithmetic.
 */
export declare function searchChunks(query: string, tenantId: string, options?: SearchOptions): Promise<SearchResult[]>;
/**
 * Get all chunks for a specific document, ordered by chunk_index.
 */
export declare function getDocumentChunks(documentId: string, tenantId: string): Promise<StoredChunk[]>;
/**
 * Delete all chunks for a document (for re-processing).
 * Returns the number of chunks deleted.
 */
export declare function deleteDocumentChunks(documentId: string, tenantId: string): Promise<number>;
//# sourceMappingURL=rag-chunking.d.ts.map