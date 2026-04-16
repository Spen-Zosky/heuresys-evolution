/**
 * AI Orchestrator Service
 * Multi-provider AI service with RAG support
 * Epic 5: AI HR Assistant
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// PROVIDER CONFIGURATIONS
// =============================================================================

const PROVIDER_CONFIGS: Record<AIProvider, { defaultModel: string; embeddingModel: string }> = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  },
  anthropic: {
    defaultModel: 'claude-3-haiku-20240307',
    embeddingModel: 'voyage-3', // Uses Voyage AI for embeddings
  },
  gemini: {
    defaultModel: 'gemini-1.5-flash',
    embeddingModel: 'text-embedding-004',
  },
  azure_openai: {
    defaultModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  },
};

// HR System prompt for Italian labor context
const HR_SYSTEM_PROMPT = `Sei un assistente HR specializzato per il contesto lavorativo italiano.
Le tue responsabilità:
1. Rispondere a domande su ferie, permessi, malattia e altri aspetti HR
2. Fornire informazioni accurate basate sui CCNL (Contratti Collettivi Nazionali di Lavoro)
3. Guidare i dipendenti attraverso le procedure aziendali
4. Escalare a risorse umane quando necessario

Regole:
- Rispondi sempre in italiano, a meno che non sia richiesto diversamente
- Cita sempre le fonti quando fornisci informazioni da documenti
- Se non sei sicuro, indica chiaramente il livello di incertezza
- Per questioni legali complesse, suggerisci sempre di consultare HR
- Rispetta la privacy e non condividere informazioni sensibili di altri dipendenti`;

// =============================================================================
// AI ORCHESTRATOR CLASS
// =============================================================================

export class AIOrchestrator {
  private tenantId: string;
  private config: AIConfig;

  constructor(tenantId: string, config?: Partial<AIConfig>) {
    this.tenantId = tenantId;
    this.config = {
      provider: config?.provider || 'openai',
      model: config?.model || PROVIDER_CONFIGS[config?.provider || 'openai'].defaultModel,
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2048,
      ...config,
    };
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  async loadTenantConfig(): Promise<void> {
    const result = await pool.query(`SELECT * FROM ai_tenant_config WHERE tenant_id = $1`, [
      this.tenantId,
    ]);

    if (result.rows.length > 0) {
      const tenantConfig = result.rows[0];
      this.config.provider = tenantConfig.default_provider as AIProvider;
      this.config.model = tenantConfig.default_chat_model;
    }
  }

  async getProviderApiKey(provider?: AIProvider): Promise<string | null> {
    const targetProvider = provider || this.config.provider;

    const result = await pool.query(
      `SELECT api_key_encrypted FROM rag_provider_keys
       WHERE tenant_id = $1 AND provider = $2 AND is_valid = true`,
      [this.tenantId, targetProvider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Note: In production, decrypt the API key here
    return result.rows[0].api_key_encrypted;
  }

  // ---------------------------------------------------------------------------
  // CHAT COMPLETION
  // ---------------------------------------------------------------------------

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    // Build messages with system prompt
    const messages: ChatMessage[] = [
      { role: 'system', content: HR_SYSTEM_PROMPT },
      ...request.messages,
    ];

    // Add RAG context if available
    if (request.ragContext && request.ragContext.chunks.length > 0) {
      const contextMessage = this.buildRAGContextMessage(request.ragContext);
      messages.splice(1, 0, { role: 'system', content: contextMessage });
    }

    // Get API key
    const apiKey = await this.getProviderApiKey();
    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${this.config.provider}`);
    }

    // Call provider
    let response: { content: string; tokensInput: number; tokensOutput: number };

    switch (this.config.provider) {
      case 'openai':
      case 'azure_openai':
        response = await this.callOpenAI(messages, apiKey);
        break;
      case 'anthropic':
        response = await this.callAnthropic(messages, apiKey);
        break;
      case 'gemini':
        response = await this.callGemini(messages, apiKey);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    // Calculate confidence
    const { score, factors, requiresEscalation, escalationReason } = this.calculateConfidence(
      response.content,
      request.ragContext
    );

    // Log to audit
    const responseTimeMs = Date.now() - startTime;
    await this.logQueryAudit({
      sessionId: request.sessionId,
      queryText: request.messages[request.messages.length - 1]?.content || '',
      queryType: 'chat',
      responseText: response.content,
      responseTimeMs,
      tokensInput: response.tokensInput,
      tokensOutput: response.tokensOutput,
      provider: this.config.provider,
      model: this.config.model,
      sourcesUsed: request.ragContext?.sources || [],
      confidenceScore: score,
      wasEscalated: requiresEscalation,
    });

    return {
      content: response.content,
      tokensInput: response.tokensInput,
      tokensOutput: response.tokensOutput,
      sources: request.ragContext?.sources || [],
      confidenceScore: score,
      confidenceFactors: factors,
      requiresEscalation,
      escalationReason,
    };
  }

  private buildRAGContextMessage(ragContext: RAGContext): string {
    const contextParts: string[] = ['Contesto dai documenti aziendali:\n'];

    for (const chunk of ragContext.chunks.slice(0, 5)) {
      contextParts.push(
        `---\n[Fonte: ${chunk.sectionTitle || 'Documento'}${chunk.pageNumber ? `, Pagina ${chunk.pageNumber}` : ''}]\n${chunk.content}\n`
      );
    }

    contextParts.push(
      '\nUsa queste informazioni per rispondere alla domanda. Cita le fonti quando appropriato.'
    );

    return contextParts.join('');
  }

  // ---------------------------------------------------------------------------
  // PROVIDER IMPLEMENTATIONS
  // ---------------------------------------------------------------------------

  private async callOpenAI(
    messages: ChatMessage[],
    apiKey: string
  ): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      tokensInput: data.usage?.prompt_tokens || 0,
      tokensOutput: data.usage?.completion_tokens || 0,
    };
  }

  private async callAnthropic(
    messages: ChatMessage[],
    apiKey: string
  ): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemMessage,
        messages: userMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text || '',
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
    };
  }

  private async callGemini(
    messages: ChatMessage[],
    apiKey: string
  ): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
    // Convert messages to Gemini format
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`,
      {
        signal: AbortSignal.timeout(30000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };

    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      tokensInput: data.usageMetadata?.promptTokenCount || 0,
      tokensOutput: data.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // EMBEDDINGS
  // ---------------------------------------------------------------------------

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const apiKey = await this.getProviderApiKey();
    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${this.config.provider}`);
    }

    const model = request.model || PROVIDER_CONFIGS[this.config.provider].embeddingModel;

    switch (this.config.provider) {
      case 'openai':
      case 'azure_openai':
        return this.openAIEmbeddings(request.texts, model, apiKey);
      case 'gemini':
        return this.geminiEmbeddings(request.texts, model, apiKey);
      default:
        throw new Error(`Embeddings not supported for provider: ${this.config.provider}`);
    }
  }

  private async openAIEmbeddings(
    texts: string[],
    model: string,
    apiKey: string
  ): Promise<EmbeddingResponse> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings API error: ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };

    return {
      embeddings: data.data.map((d) => d.embedding),
      model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  private async geminiEmbeddings(
    texts: string[],
    model: string,
    apiKey: string
  ): Promise<EmbeddingResponse> {
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of texts) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          signal: AbortSignal.timeout(30000),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini Embeddings API error: ${error}`);
      }

      const data = (await response.json()) as {
        embedding: { values: number[] };
      };

      embeddings.push(data.embedding.values);
      totalTokens += Math.ceil(text.length / 4); // Approximate
    }

    return { embeddings, model, tokensUsed: totalTokens };
  }

  // ---------------------------------------------------------------------------
  // RAG RETRIEVAL
  // ---------------------------------------------------------------------------

  async retrieveContext(
    query: string,
    options?: {
      knowledgeBaseIds?: string[];
      maxChunks?: number;
      minScore?: number;
    }
  ): Promise<RAGContext> {
    const maxChunks = options?.maxChunks || 5;

    // Generate query embedding
    const { embeddings } = await this.generateEmbeddings({
      tenantId: this.tenantId,
      texts: [query],
    });
    const queryEmbedding = embeddings[0];

    if (!queryEmbedding) {
      return { chunks: [], sources: [], retrievalScore: 0 };
    }

    // For now, use simple text similarity since pgvector isn't available
    // In production with pgvector, use vector similarity search
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.document_id,
        c.content,
        c.page_number,
        c.section_title,
        d.original_name as document_name,
        -- Simple text matching score (would use vector similarity with pgvector)
        CASE
          WHEN c.content ILIKE '%' || $2 || '%' THEN 0.9
          WHEN c.content ILIKE '%' || split_part($2, ' ', 1) || '%' THEN 0.6
          ELSE 0.3
        END as score
      FROM rag_document_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      WHERE c.tenant_id = $1
        AND d.status = 'completed'
        ${options?.knowledgeBaseIds?.length ? 'AND d.knowledge_base_id = ANY($4)' : ''}
      ORDER BY score DESC
      LIMIT $3
    `,
      options?.knowledgeBaseIds?.length
        ? [this.tenantId, query, maxChunks, options.knowledgeBaseIds]
        : [this.tenantId, query, maxChunks]
    );

    const chunks: DocumentChunk[] = result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      pageNumber: row.page_number,
      sectionTitle: row.section_title,
      score: parseFloat(row.score),
    }));

    const sources: SourceReference[] = chunks.map((chunk) => {
      const row = result.rows.find((r) => r.id === chunk.id);
      return {
        documentId: chunk.documentId,
        documentName: row?.document_name || 'Unknown',
        chunkId: chunk.id,
        excerpt: chunk.content.substring(0, 200) + '...',
        pageNumber: chunk.pageNumber,
      };
    });

    const avgScore =
      chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length : 0;

    return { chunks, sources, retrievalScore: avgScore };
  }

  // ---------------------------------------------------------------------------
  // CONFIDENCE SCORING
  // ---------------------------------------------------------------------------

  private calculateConfidence(
    response: string,
    ragContext?: RAGContext | undefined
  ): {
    score: number;
    factors: Record<string, number>;
    requiresEscalation: boolean;
    escalationReason?: string | undefined;
  } {
    const factors: Record<string, number> = {};

    // Factor 1: RAG retrieval quality
    factors.retrievalScore = ragContext?.retrievalScore || 0.3;

    // Factor 2: Source coverage
    const sourcesCount = ragContext?.sources.length || 0;
    factors.sourceCoverage = Math.min(sourcesCount / 3, 1);

    // Factor 3: Response completeness
    factors.responseCompleteness = response.length > 100 ? 0.8 : response.length > 50 ? 0.5 : 0.2;

    // Factor 4: Citation presence
    const hasCitation = /\[.*\]|fonte:|documento:/i.test(response);
    factors.citationPresence = hasCitation ? 1 : 0.3;

    // Factor 5: Uncertainty indicators
    const uncertaintyPhrases = [
      'non sono sicuro',
      'potrebbe',
      'probabilmente',
      'dovresti verificare',
      'contatta HR',
    ];
    const hasUncertainty = uncertaintyPhrases.some((phrase) =>
      response.toLowerCase().includes(phrase)
    );
    factors.certaintyLevel = hasUncertainty ? 0.4 : 0.8;

    // Calculate weighted score
    const weights = {
      retrievalScore: 0.3,
      sourceCoverage: 0.25,
      responseCompleteness: 0.15,
      citationPresence: 0.15,
      certaintyLevel: 0.15,
    };

    let score = 0;
    for (const [factor, value] of Object.entries(factors)) {
      score += value * (weights[factor as keyof typeof weights] || 0);
    }

    // Determine escalation
    let requiresEscalation = false;
    let escalationReason: string | undefined;

    if (score < 0.3) {
      requiresEscalation = true;
      escalationReason = 'Low confidence score';
    } else if (sourcesCount === 0 && /legale|contratto|licenziamento|causa/i.test(response)) {
      requiresEscalation = true;
      escalationReason = 'Legal topic without source verification';
    } else if (/non posso|non sono in grado|impossibile/i.test(response)) {
      requiresEscalation = true;
      escalationReason = 'AI unable to provide adequate response';
    }

    return {
      score: Math.round(score * 10000) / 10000,
      factors,
      requiresEscalation,
      escalationReason,
    };
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGGING
  // ---------------------------------------------------------------------------

  private async logQueryAudit(params: {
    sessionId?: string | undefined;
    queryText: string;
    queryType: string;
    responseText: string;
    responseTimeMs: number;
    tokensInput: number;
    tokensOutput: number;
    provider: string;
    model: string;
    sourcesUsed: SourceReference[];
    confidenceScore: number;
    wasEscalated: boolean;
    error?: string | undefined;
  }): Promise<void> {
    try {
      await pool.query(
        `
        INSERT INTO ai_query_audit (
          tenant_id, session_id, query_text, query_type,
          response_text, response_time_ms, tokens_input, tokens_output,
          provider, model, sources_used, chunks_retrieved,
          confidence_score, was_escalated, had_error, error_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      `,
        [
          this.tenantId,
          params.sessionId || null,
          params.queryText,
          params.queryType,
          params.responseText,
          params.responseTimeMs,
          params.tokensInput,
          params.tokensOutput,
          params.provider,
          params.model,
          JSON.stringify(params.sourcesUsed),
          params.sourcesUsed.length,
          params.confidenceScore,
          params.wasEscalated,
          !!params.error,
          params.error || null,
        ]
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to log query audit:');
    }
  }

  // ---------------------------------------------------------------------------
  // ESCALATION
  // ---------------------------------------------------------------------------

  async createEscalation(params: {
    messageId: string;
    sessionId: string;
    employeeId?: string;
    originalQuery: string;
    aiResponse: string;
    confidenceScore: number;
    escalationReason: string;
    category?: string;
    priority?: string;
  }): Promise<string> {
    const result = await pool.query(
      `
      INSERT INTO ai_escalation_queue (
        tenant_id, message_id, session_id, employee_id,
        original_query, ai_response, confidence_score,
        escalation_reason, category, priority, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW(), NOW())
      RETURNING id
    `,
      [
        this.tenantId,
        params.messageId,
        params.sessionId,
        params.employeeId || null,
        params.originalQuery,
        params.aiResponse,
        params.confidenceScore,
        params.escalationReason,
        params.category || 'low_confidence',
        params.priority || 'normal',
      ]
    );

    return result.rows[0].id;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAIOrchestrator(tenantId: string, config?: Partial<AIConfig>): AIOrchestrator {
  return new AIOrchestrator(tenantId, config);
}

export default AIOrchestrator;
