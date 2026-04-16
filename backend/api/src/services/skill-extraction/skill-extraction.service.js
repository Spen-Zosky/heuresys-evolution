/**
 * Skill Extraction Service
 * LLM-powered skill extraction from unstructured text with ontology mapping
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-07 (Skill Extraction Service)
 * Created: 2025-12-22
 */
import { pool } from '../../config/database.js';
import { getProviderFactory } from '../ai-providers/index.js';
import { logger } from '../../config/logger.js';
// =============================================================================
// PROMPT TEMPLATES
// =============================================================================
const EXTRACTION_PROMPTS = {
    en: {
        system: `You are an expert HR analyst specialized in skill extraction and classification.
Your task is to extract professional skills, knowledge areas, and competencies from text.

Guidelines:
- Extract ONLY actual skills, not job requirements like "3 years experience"
- Classify each as: skill (practical ability), knowledge (theoretical understanding), or competence (behavioral trait)
- Include the EXACT context where each skill appears in the text
- Estimate proficiency level when indicated: basic, intermediate, advanced, expert
- Mark skills as required (true) or preferred (false) based on context

Output format: JSON array with objects containing:
{
  "name": "skill name in English",
  "type": "skill|knowledge|competence",
  "context": "exact phrase from text where skill is mentioned",
  "isRequired": true/false,
  "proficiencyLevel": "basic|intermediate|advanced|expert" (if mentioned)
}`,
        user: (text) => `Extract all skills, knowledge areas, and competencies from the following text. Return ONLY a valid JSON array.

Text:
"""
${text}
"""`,
    },
    it: {
        system: `Sei un esperto analista HR specializzato nell'estrazione e classificazione delle competenze.
Il tuo compito e' estrarre competenze professionali, aree di conoscenza e soft skills dal testo.

Linee guida:
- Estrai SOLO competenze effettive, non requisiti come "3 anni di esperienza"
- Classifica ogni voce come: skill (abilita' pratica), knowledge (conoscenza teorica), o competence (tratto comportamentale)
- Includi il contesto ESATTO dove ogni competenza appare nel testo
- Stima il livello di competenza quando indicato: base, intermedio, avanzato, esperto
- Indica se le competenze sono richieste (true) o preferite (false)

Formato output: Array JSON con oggetti contenenti:
{
  "name": "nome competenza in italiano",
  "type": "skill|knowledge|competence",
  "context": "frase esatta dal testo dove la competenza e' menzionata",
  "isRequired": true/false,
  "proficiencyLevel": "basic|intermediate|advanced|expert" (se menzionato)
}`,
        user: (text) => `Estrai tutte le competenze, aree di conoscenza e soft skills dal seguente testo. Restituisci SOLO un array JSON valido.

Testo:
"""
${text}
"""`,
    },
};
// =============================================================================
// SKILL EXTRACTION SERVICE
// =============================================================================
export class SkillExtractionService {
    // ---------------------------------------------------------------------------
    // MAIN EXTRACTION METHOD
    // ---------------------------------------------------------------------------
    async extractSkills(text, options = {}) {
        const startTime = Date.now();
        const language = options.language === 'auto' ? this.detectLanguage(text) : options.language || 'en';
        // Create extraction job
        const jobId = await this.createExtractionJob({
            tenantId: options.tenantId,
            sourceType: options.sourceType || 'general',
            sourceText: text,
        });
        try {
            // Step 1: Extract skills using LLM
            const extractedSkills = await this.llmExtractSkills(text, language);
            // Step 2: Map to ESCO ontology
            const { mapped, unmapped } = await this.mapToOntology(extractedSkills, language, options.minConfidence || 0.5);
            // Step 3: Generate highlighted text if requested
            const highlightedText = options.includeHighlights
                ? this.generateHighlightedText(text, extractedSkills)
                : undefined;
            const processingTimeMs = Date.now() - startTime;
            // Calculate statistics
            const avgConfidence = mapped.length > 0
                ? mapped.reduce((sum, s) => sum + s.matchConfidence, 0) / mapped.length
                : 0;
            const result = {
                jobId,
                status: unmapped.length === 0 ? 'completed' : 'partial',
                sourceType: options.sourceType || 'general',
                language,
                extractedSkills,
                mappedSkills: mapped,
                unmappedSkills: unmapped,
                statistics: {
                    totalExtracted: extractedSkills.length,
                    totalMapped: mapped.length,
                    totalUnmapped: unmapped.length,
                    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
                    processingTimeMs,
                },
                highlightedText,
            };
            // Update job with results
            await this.updateExtractionJob(jobId, result);
            return result;
        }
        catch (error) {
            await this.updateExtractionJob(jobId, null, error);
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // LLM EXTRACTION
    // ---------------------------------------------------------------------------
    async llmExtractSkills(text, language) {
        const prompts = EXTRACTION_PROMPTS[language];
        // Use OpenAI for chat completion
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            signal: AbortSignal.timeout(30000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: prompts.system },
                    { role: 'user', content: prompts.user(text) },
                ],
                temperature: 0.3,
                max_tokens: 2000,
                response_format: { type: 'json_object' },
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }
        const data = (await response.json());
        const content = data.choices[0]?.message?.content || '{"skills":[]}';
        // Log AI usage
        await this.logAIUsage('openai', 'gpt-4o-mini', 'extraction', data.usage?.total_tokens || 0);
        // Parse and validate
        return this.parseExtractionResponse(content);
    }
    parseExtractionResponse(content) {
        try {
            const parsed = JSON.parse(content);
            // Handle both array and object with skills property
            const skills = Array.isArray(parsed) ? parsed : parsed.skills || [];
            return skills
                .map((s) => ({
                name: String(s.name || '').trim(),
                type: this.normalizeSkillType(String(s.type || 'skill')),
                context: String(s.context || '').trim(),
                isRequired: s.isRequired === true,
                proficiencyLevel: this.normalizeProficiency(String(s.proficiencyLevel || '')),
            }))
                .filter((s) => s.name.length > 0);
        }
        catch {
            logger.error(`Failed to parse LLM response: ${String(content)}`);
            return [];
        }
    }
    normalizeSkillType(type) {
        const normalized = type.toLowerCase().trim();
        if (normalized === 'knowledge')
            return 'knowledge';
        if (normalized === 'competence')
            return 'competence';
        return 'skill';
    }
    normalizeProficiency(level) {
        const normalized = level.toLowerCase().trim();
        if (['basic', 'base', 'beginner', 'junior'].includes(normalized))
            return 'basic';
        if (['intermediate', 'intermedio', 'mid', 'middle'].includes(normalized))
            return 'intermediate';
        if (['advanced', 'avanzato', 'senior'].includes(normalized))
            return 'advanced';
        if (['expert', 'esperto', 'master'].includes(normalized))
            return 'expert';
        return undefined;
    }
    // ---------------------------------------------------------------------------
    // ONTOLOGY MAPPING
    // ---------------------------------------------------------------------------
    async mapToOntology(skills, language, minConfidence) {
        const mapped = [];
        const unmapped = [];
        for (const skill of skills) {
            const match = await this.findBestMatch(skill.name, language, minConfidence);
            if (match) {
                mapped.push({
                    rawSkill: skill,
                    ...match,
                });
            }
            else {
                unmapped.push(skill);
                mapped.push({
                    rawSkill: skill,
                    escoSkillId: null,
                    escoSkillUri: null,
                    escoSkillLabel: null,
                    escoSkillType: null,
                    matchConfidence: 0,
                    matchMethod: 'none',
                });
            }
        }
        return { mapped, unmapped };
    }
    async findBestMatch(skillName, language, minConfidence) {
        // Step 1: Try exact match
        const exactMatch = await this.findExactMatch(skillName, language);
        if (exactMatch) {
            return {
                ...exactMatch,
                matchConfidence: 1.0,
                matchMethod: 'exact',
            };
        }
        // Step 2: Try semantic match using embeddings
        const semanticMatch = await this.findSemanticMatch(skillName, language, minConfidence);
        if (semanticMatch) {
            return semanticMatch;
        }
        // Step 3: Try partial text match
        const partialMatch = await this.findPartialMatch(skillName, language, minConfidence);
        if (partialMatch) {
            return partialMatch;
        }
        return null;
    }
    async findExactMatch(skillName, language) {
        const labelColumn = language === 'it' ? 'preferred_label_it' : 'preferred_label_en';
        const result = await pool.query(`
      SELECT id, uri, ${labelColumn} as label, skill_type
      FROM esco_skills
      WHERE LOWER(${labelColumn}) = LOWER($1)
         OR LOWER(preferred_label_en) = LOWER($1)
         OR alt_labels @> $2::jsonb
      LIMIT 1
    `, [skillName, JSON.stringify([skillName.toLowerCase()])]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            escoSkillId: row.id,
            escoSkillUri: row.uri,
            escoSkillLabel: row.label,
            escoSkillType: row.skill_type,
        };
    }
    async findSemanticMatch(skillName, language, minConfidence) {
        try {
            // Generate embedding for the skill name
            const factory = getProviderFactory();
            const result = await factory.generateEmbedding(skillName);
            const embedding = result.embedding;
            // Format embedding as pgvector string
            const embeddingStr = `[${embedding.join(',')}]`;
            const embeddingColumn = language === 'it' ? 'embedding_it' : 'embedding_en';
            const labelColumn = language === 'it' ? 'preferred_label_it' : 'preferred_label_en';
            // Find nearest skills using cosine similarity
            const searchResult = await pool.query(`
        SELECT
          id,
          uri,
          ${labelColumn} as label,
          skill_type,
          1 - (${embeddingColumn} <=> $1::vector) as similarity
        FROM esco_skills
        WHERE ${embeddingColumn} IS NOT NULL
        ORDER BY ${embeddingColumn} <=> $1::vector
        LIMIT 5
      `, [embeddingStr]);
            if (searchResult.rows.length === 0)
                return null;
            const topMatch = searchResult.rows[0];
            const similarity = parseFloat(topMatch.similarity);
            if (similarity < minConfidence)
                return null;
            // Get alternative matches
            const alternatives = searchResult.rows
                .slice(1)
                .map((row) => ({
                escoSkillId: row.id,
                escoSkillLabel: row.label,
                confidence: parseFloat(row.similarity),
            }))
                .filter((alt) => alt.confidence >= minConfidence * 0.8);
            return {
                escoSkillId: topMatch.id,
                escoSkillUri: topMatch.uri,
                escoSkillLabel: topMatch.label,
                escoSkillType: topMatch.skill_type,
                matchConfidence: similarity,
                matchMethod: 'semantic',
                alternativeMatches: alternatives.length > 0 ? alternatives : undefined,
            };
        }
        catch (error) {
            logger.error({ err: error }, 'Semantic match failed:');
            return null;
        }
    }
    async findPartialMatch(skillName, language, minConfidence) {
        const labelColumn = language === 'it' ? 'preferred_label_it' : 'preferred_label_en';
        // Use trigram similarity for partial matching
        const result = await pool.query(`
      SELECT
        id,
        uri,
        ${labelColumn} as label,
        skill_type,
        similarity(LOWER(${labelColumn}), LOWER($1)) as sim_score
      FROM esco_skills
      WHERE similarity(LOWER(${labelColumn}), LOWER($1)) > $2
         OR LOWER(${labelColumn}) LIKE '%' || LOWER($1) || '%'
      ORDER BY sim_score DESC
      LIMIT 3
    `, [skillName, minConfidence * 0.6]);
        if (result.rows.length === 0)
            return null;
        const topMatch = result.rows[0];
        const confidence = parseFloat(topMatch.sim_score) || 0.5;
        if (confidence < minConfidence)
            return null;
        return {
            escoSkillId: topMatch.id,
            escoSkillUri: topMatch.uri,
            escoSkillLabel: topMatch.label,
            escoSkillType: topMatch.skill_type,
            matchConfidence: confidence,
            matchMethod: 'partial',
            alternativeMatches: result.rows.slice(1).map((row) => ({
                escoSkillId: row.id,
                escoSkillLabel: row.label,
                confidence: parseFloat(row.sim_score) || 0.4,
            })),
        };
    }
    // ---------------------------------------------------------------------------
    // TEXT HIGHLIGHTING
    // ---------------------------------------------------------------------------
    generateHighlightedText(text, skills) {
        let highlighted = text;
        // Sort by context length (longest first) to avoid overlapping replacements
        const sortedSkills = [...skills].sort((a, b) => (b.context?.length || 0) - (a.context?.length || 0));
        for (const skill of sortedSkills) {
            if (skill.context && skill.context.length > 3) {
                const escapedContext = skill.context.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedContext})`, 'gi');
                highlighted = highlighted.replace(regex, `<mark data-skill="${skill.name}" data-type="${skill.type}">$1</mark>`);
            }
        }
        return highlighted;
    }
    // ---------------------------------------------------------------------------
    // LANGUAGE DETECTION
    // ---------------------------------------------------------------------------
    detectLanguage(text) {
        // Simple heuristic based on common Italian words
        const italianIndicators = [
            'il',
            'la',
            'di',
            'che',
            'e',
            'un',
            'una',
            'per',
            'con',
            'sono',
            'competenze',
            'esperienza',
            'conoscenza',
            'capacita',
            'gestione',
            'sviluppo',
            'lavoro',
            'anni',
            'requisiti',
            'preferibile',
        ];
        const words = text.toLowerCase().split(/\s+/);
        const italianCount = words.filter((w) => italianIndicators.includes(w)).length;
        return italianCount > words.length * 0.1 ? 'it' : 'en';
    }
    // ---------------------------------------------------------------------------
    // JOB MANAGEMENT
    // ---------------------------------------------------------------------------
    async createExtractionJob(params) {
        const result = await pool.query(`
      INSERT INTO skill_extraction_jobs (
        tenant_id, job_type, source_type, source_text, status
      ) VALUES ($1, 'extraction', $2, $3, 'processing')
      RETURNING id
    `, [params.tenantId || null, params.sourceType, params.sourceText]);
        return result.rows[0].id;
    }
    async updateExtractionJob(jobId, result, error) {
        if (error) {
            await pool.query(`
        UPDATE skill_extraction_jobs
        SET status = 'failed',
            error_message = $2,
            completed_at = NOW()
        WHERE id = $1
      `, [jobId, error.message]);
        }
        else if (result) {
            await pool.query(`
        UPDATE skill_extraction_jobs
        SET status = $2,
            extracted_skills = $3,
            mapped_skills = $4,
            unmapped_skills = $5,
            processing_time_ms = $6,
            completed_at = NOW()
        WHERE id = $1
      `, [
                jobId,
                result.status,
                JSON.stringify(result.extractedSkills),
                JSON.stringify(result.mappedSkills),
                JSON.stringify(result.unmappedSkills),
                result.statistics.processingTimeMs,
            ]);
        }
    }
    // ---------------------------------------------------------------------------
    // AI USAGE LOGGING
    // ---------------------------------------------------------------------------
    async logAIUsage(provider, model, operation, tokens) {
        try {
            await pool.query(`
        SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7)
      `, [provider, model, operation, tokens, 0.0001 * tokens, 0, true]);
        }
        catch (error) {
            logger.error({ err: error }, 'Failed to log AI usage:');
        }
    }
}
// =============================================================================
// SINGLETON INSTANCE
// =============================================================================
let serviceInstance = null;
export function getSkillExtractionService() {
    if (!serviceInstance) {
        serviceInstance = new SkillExtractionService();
    }
    return serviceInstance;
}
export default SkillExtractionService;
//# sourceMappingURL=skill-extraction.service.js.map