/**
 * Document Processor Service
 * Handles document ingestion, chunking, and embedding generation
 * Epic 5: AI HR Assistant - Stories 5.2, 5.3
 */
import { AIProvider } from './ai-orchestrator.js';
export interface DocumentProcessingOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingModel?: string;
    knowledgeBaseId?: string | undefined;
}
export interface ProcessingResult {
    documentId: string;
    chunksCreated: number;
    embeddingsGenerated: number;
    processingTimeMs: number;
    success: boolean;
    error?: string | undefined;
}
interface TextChunk {
    content: string;
    index: number;
    startChar: number;
    endChar: number;
    pageNumber?: number | undefined;
    sectionTitle?: string | undefined;
}
export declare class DocumentProcessor {
    private tenantId;
    private provider;
    constructor(tenantId: string, provider?: AIProvider);
    processDocument(documentId: string, options?: DocumentProcessingOptions): Promise<ProcessingResult>;
    private getDocument;
    private getDocumentContent;
    private updateDocumentStatus;
    chunkDocument(content: string, options: {
        chunkSize: number;
        chunkOverlap: number;
    }): TextChunk[];
    private extractSectionTitle;
    private storeChunks;
    private generateChunkEmbeddings;
    ingestCCNL(params: {
        code: string;
        name: string;
        sector: string;
        fullText: string;
        effectiveDate?: string;
        version?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        documentId: string;
        ccnlId: string;
    }>;
    ingestCompanyPolicy(params: {
        title: string;
        content: string;
        policyType: string;
        effectiveDate?: string;
        version?: string;
        orgUnitId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        documentId: string;
        knowledgeBaseId: string;
    }>;
    processPendingDocuments(limit?: number): Promise<ProcessingResult[]>;
}
export declare function createDocumentProcessor(tenantId: string, provider?: AIProvider): DocumentProcessor;
export default DocumentProcessor;
//# sourceMappingURL=document-processor.d.ts.map