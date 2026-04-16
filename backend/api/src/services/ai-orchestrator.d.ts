/**
 * AI Orchestrator Service
 * Multi-provider AI service with RAG support
 * Epic 5: AI HR Assistant
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'azure_openai';
export interface AIConfig {
    provider: AIProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface RAGContext {
    chunks: DocumentChunk[];
    sources: SourceReference[];
    retrievalScore: number;
}
export interface DocumentChunk {
    id: string;
    documentId: string;
    content: string;
    pageNumber?: number;
    sectionTitle?: string;
    score: number;
}
export interface SourceReference {
    documentId: string;
    documentName: string;
    chunkId: string;
    excerpt: string;
    pageNumber?: number | undefined;
}
export interface ChatCompletionRequest {
    tenantId: string;
    sessionId?: string | undefined;
    messages: ChatMessage[];
    ragContext?: RAGContext | undefined;
    config?: Partial<AIConfig> | undefined;
}
export interface ChatCompletionResponse {
    content: string;
    tokensInput: number;
    tokensOutput: number;
    sources: SourceReference[];
    confidenceScore: number;
    confidenceFactors: Record<string, number>;
    requiresEscalation: boolean;
    escalationReason?: string | undefined;
}
export interface EmbeddingRequest {
    tenantId: string;
    texts: string[];
    model?: string | undefined;
}
export interface EmbeddingResponse {
    embeddings: number[][];
    model: string;
    tokensUsed: number;
}
export declare class AIOrchestrator {
    private tenantId;
    private config;
    constructor(tenantId: string, config?: Partial<AIConfig>);
    loadTenantConfig(): Promise<void>;
    getProviderApiKey(provider?: AIProvider): Promise<string | null>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    private buildRAGContextMessage;
    private callOpenAI;
    private callAnthropic;
    private callGemini;
    generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    private openAIEmbeddings;
    private geminiEmbeddings;
    retrieveContext(query: string, options?: {
        knowledgeBaseIds?: string[];
        maxChunks?: number;
        minScore?: number;
    }): Promise<RAGContext>;
    private calculateConfidence;
    private logQueryAudit;
    createEscalation(params: {
        messageId: string;
        sessionId: string;
        employeeId?: string;
        originalQuery: string;
        aiResponse: string;
        confidenceScore: number;
        escalationReason: string;
        category?: string;
        priority?: string;
    }): Promise<string>;
}
export declare function createAIOrchestrator(tenantId: string, config?: Partial<AIConfig>): AIOrchestrator;
export default AIOrchestrator;
//# sourceMappingURL=ai-orchestrator.d.ts.map