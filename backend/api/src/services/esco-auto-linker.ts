/**
 * ESCO Auto-Linker Service
 * Generates embeddings for imported skill texts and matches them to ESCO skills
 * via pgvector cosine similarity.
 * Horizon O2.2
 */

import { PoolClient } from 'pg';
import { logger } from '../config/logger.js';

// === TYPES ===

export interface MatchResult {
  escoSkillId: string;
  preferredLabel: string;
  similarity: number;
  skillType: string;
}

export interface AutoLinkResult {
  inputText: string;
  matches: MatchResult[];
  bestMatch: MatchResult | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export interface LinkingSummary {
  total: number;
  linked: number;
  unlinked: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

// === CONFIDENCE THRESHOLDS ===

const THRESHOLD_HIGH = 0.85;
const THRESHOLD_MEDIUM = 0.7;
const THRESHOLD_LOW = 0.5;

function classifyConfidence(similarity: number): 'high' | 'medium' | 'low' | 'none' {
  if (similarity >= THRESHOLD_HIGH) return 'high';
  if (similarity >= THRESHOLD_MEDIUM) return 'medium';
  if (similarity >= THRESHOLD_LOW) return 'low';
  return 'none';
}

// === OpenAI EMBEDDING ===

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface OpenAIErrorResponse {
  error: { message: string; type: string; code: string };
}

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20;

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY not configured. Set the environment variable in the api-gateway container.'
    );
  }
  return key;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_EMBEDDING_URL, {
    signal: AbortSignal.timeout(30000),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as OpenAIErrorResponse;
    throw new Error(
      `OpenAI API error (${response.status}): ${errorData.error?.message ?? 'Unknown'}`
    );
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;
  const embedding = data.data[0]?.embedding;
  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API');
  }

  return embedding;
}

async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = getApiKey();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(OPENAI_EMBEDDING_URL, {
      signal: AbortSignal.timeout(60000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as OpenAIErrorResponse;
      throw new Error(
        `OpenAI API error (${response.status}): ${errorData.error?.message ?? 'Unknown'}`
      );
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    const sorted = data.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }

    // Rate limiting pause between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return allEmbeddings;
}

// === SERVICE CLASS ===

export class EscoAutoLinkerService {
  constructor(private dbClient: PoolClient) {}

  async findSimilarSkills(
    text: string,
    topN: number = 5,
    threshold: number = THRESHOLD_LOW
  ): Promise<MatchResult[]> {
    const embedding = await generateEmbedding(text);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const result = await this.dbClient.query(
      `SELECT id, preferred_label, skill_type,
              1 - (embedding_en <=> $1::vector) AS similarity
       FROM esco_skills
       WHERE embedding_en IS NOT NULL
       ORDER BY embedding_en <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, topN]
    );

    return result.rows
      .filter((row: any) => parseFloat(row.similarity) >= threshold)
      .map((row: any) => ({
        escoSkillId: row.id,
        preferredLabel: row.preferred_label,
        similarity: parseFloat(parseFloat(row.similarity).toFixed(4)),
        skillType: row.skill_type,
      }));
  }

  async autoLinkBatch(skillTexts: string[], _tenantId: string): Promise<AutoLinkResult[]> {
    if (skillTexts.length === 0) return [];

    // Deduplicate
    const uniqueTexts = [...new Set(skillTexts.map((t) => t.trim()).filter(Boolean))];
    const embeddings = await generateBatchEmbeddings(uniqueTexts);

    const results: AutoLinkResult[] = [];

    for (let i = 0; i < uniqueTexts.length; i++) {
      const text = uniqueTexts[i]!;
      const embedding = embeddings[i]!;
      const vectorLiteral = `[${embedding.join(',')}]`;

      const queryResult = await this.dbClient.query(
        `SELECT id, preferred_label, skill_type,
                1 - (embedding_en <=> $1::vector) AS similarity
         FROM esco_skills
         WHERE embedding_en IS NOT NULL
         ORDER BY embedding_en <=> $1::vector
         LIMIT 5`,
        [vectorLiteral]
      );

      const matches: MatchResult[] = queryResult.rows
        .filter((row: any) => parseFloat(row.similarity) >= THRESHOLD_LOW)
        .map((row: any) => ({
          escoSkillId: row.id,
          preferredLabel: row.preferred_label,
          similarity: parseFloat(parseFloat(row.similarity).toFixed(4)),
          skillType: row.skill_type,
        }));

      const bestMatch = matches.length > 0 ? matches[0]! : null;
      const confidence = bestMatch ? classifyConfidence(bestMatch.similarity) : 'none';

      results.push({ inputText: text, matches, bestMatch, confidence });
    }

    // Map back to original order (including duplicates)
    const resultMap = new Map(results.map((r) => [r.inputText, r]));
    return skillTexts.map((text) => {
      const trimmed = text.trim();
      return (
        resultMap.get(trimmed) ?? {
          inputText: trimmed,
          matches: [],
          bestMatch: null,
          confidence: 'none' as const,
        }
      );
    });
  }

  async linkImportedSkills(importJobId: string, tenantId: string): Promise<LinkingSummary> {
    // Load import job and extract skill texts from preview_data
    const jobResult = await this.dbClient.query(
      'SELECT import_type, preview_data, status FROM import_jobs WHERE id = $1',
      [importJobId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Import job ${importJobId} not found`);
    }

    const job = jobResult.rows[0];
    if (job.status !== 'completed' && job.status !== 'partial') {
      throw new Error(`Import job status is '${job.status}' — must be 'completed' or 'partial'`);
    }

    const previewData = job.preview_data;
    if (!Array.isArray(previewData) || previewData.length === 0) {
      return {
        total: 0,
        linked: 0,
        unlinked: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      };
    }

    // Extract skill texts based on import type
    const skillTexts = this.extractSkillTexts(previewData, job.import_type);
    if (skillTexts.length === 0) {
      return {
        total: 0,
        linked: 0,
        unlinked: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      };
    }

    logger.info({ importJobId, skillCount: skillTexts.length }, 'ESCO auto-linking started');

    const linkResults = await this.autoLinkBatch(skillTexts, tenantId);

    // Save results to import_skill_links
    const summary: LinkingSummary = {
      total: linkResults.length,
      linked: 0,
      unlinked: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
    };

    for (const result of linkResults) {
      const escoSkillId = result.bestMatch?.escoSkillId ?? null;
      const similarity = result.bestMatch?.similarity ?? null;

      await this.dbClient.query(
        `INSERT INTO import_skill_links
          (import_job_id, tenant_id, input_text, esco_skill_id, similarity, confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [importJobId, tenantId, result.inputText, escoSkillId, similarity, result.confidence]
      );

      if (result.confidence !== 'none') {
        summary.linked++;
        if (result.confidence === 'high') summary.highConfidence++;
        else if (result.confidence === 'medium') summary.mediumConfidence++;
        else if (result.confidence === 'low') summary.lowConfidence++;
      } else {
        summary.unlinked++;
      }
    }

    logger.info({ importJobId, ...summary }, 'ESCO auto-linking completed');
    return summary;
  }

  private extractSkillTexts(previewData: Record<string, unknown>[], importType: string): string[] {
    const texts: string[] = [];

    if (importType === 'skills') {
      // For skills import: use name_en or name_it as search text
      for (const row of previewData) {
        const nameEn = row.name_en as string | undefined;
        const nameIt = row.name_it as string | undefined;
        const text = nameEn || nameIt;
        if (text && typeof text === 'string' && text.trim()) {
          texts.push(text.trim());
        }
      }
    } else if (importType === 'employees') {
      // For employees import: extract job_title as skill proxy
      for (const row of previewData) {
        const jobTitle = row.job_title as string | undefined;
        if (jobTitle && typeof jobTitle === 'string' && jobTitle.trim()) {
          texts.push(jobTitle.trim());
        }
      }
    }

    return texts;
  }
}
