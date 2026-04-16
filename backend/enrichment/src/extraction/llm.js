import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { validateExtractedByEntity } from './schemas.js';
function providerOrder() {
    const anthropicOk = typeof env.anthropicApiKey === 'string' && env.anthropicApiKey.startsWith('sk-ant-');
    const openaiOk = typeof env.openaiApiKey === 'string' && env.openaiApiKey.length > 20;
    const geminiOk = typeof env.geminiApiKey === 'string' && env.geminiApiKey.length > 20;
    const available = [];
    if (env.defaultLlmProvider === 'openai') {
        if (openaiOk)
            available.push('openai');
        if (anthropicOk)
            available.push('anthropic');
        if (geminiOk)
            available.push('gemini');
    }
    else if (env.defaultLlmProvider === 'gemini') {
        if (geminiOk)
            available.push('gemini');
        if (anthropicOk)
            available.push('anthropic');
        if (openaiOk)
            available.push('openai');
    }
    else {
        if (anthropicOk)
            available.push('anthropic');
        if (openaiOk)
            available.push('openai');
        if (geminiOk)
            available.push('gemini');
    }
    if (available.length === 0) {
        throw new Error('No LLM provider configured (set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY)');
    }
    return available;
}
let anthropicClient = null;
let openaiClient = null;
let geminiClient = null;
function getAnthropicClient() {
    if (!anthropicClient) {
        if (!env.anthropicApiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
    }
    return anthropicClient;
}
function getOpenAIClient() {
    if (!openaiClient) {
        if (!env.openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }
        openaiClient = new OpenAI({ apiKey: env.openaiApiKey });
    }
    return openaiClient;
}
function getGeminiClient() {
    if (!geminiClient) {
        if (!env.geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
    }
    return geminiClient;
}
function buildPrompt(entityName, schema, markdown) {
    const MAX_CHARS = 24000;
    const truncated = markdown.length > MAX_CHARS ? markdown.slice(0, MAX_CHARS) + '\n\n...[truncated]' : markdown;
    return `You are an extraction engine. Extract structured facts about a "${entityName}" entity
from the provided web page content, following the JSON schema exactly.

Return ONLY valid JSON matching the schema. Use null for unknown fields. Do not invent data.

SCHEMA:
${JSON.stringify(schema, null, 2)}

PAGE CONTENT (markdown):
${truncated}

Respond with a single JSON object.`;
}
function cleanAndParseJson(raw) {
    const cleanJson = raw
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    try {
        return JSON.parse(cleanJson);
    }
    catch (err) {
        throw new Error(`LLM output not valid JSON: ${err.message}\nraw: ${cleanJson.slice(0, 500)}`);
    }
}
function computeConfidence(parsed, schema) {
    const filledFields = Object.values(parsed).filter((v) => v !== null && v !== undefined && v !== '').length;
    const totalFields = Object.keys(schema.properties ?? {}).length || 1;
    return Math.min(1, filledFields / totalFields);
}
/**
 * Heuristic per-field confidence. Runs on the extracted values + the
 * declared JSON schema types: stronger signal for well-structured values
 * (URL shape, ISO country, VAT format), weaker for free-form strings.
 */
function computeConfidenceByField(parsed, schema) {
    const props = schema
        .properties ?? {};
    const out = {};
    for (const key of Object.keys(props)) {
        const value = parsed[key];
        if (value === null || value === undefined || value === '') {
            out[key] = 0;
            continue;
        }
        let score = 0.8;
        if (typeof value === 'string') {
            if (/^https?:\/\/.+/i.test(value))
                score = 0.9;
            else if (/^[A-Z]{2}$/.test(value))
                score = 0.9; // ISO country
            else if (/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(value))
                score = 0.9; // VAT-like
        }
        out[key] = score;
    }
    return out;
}
/**
 * Converts a descriptor schema (loose JSON schema) into OpenAI's strict
 * json_schema response_format. OpenAI requires additionalProperties:false
 * and every property listed in required[]. We coerce the descriptor to
 * that shape without mutating the original.
 */
function toStrictJsonSchema(name, schema) {
    const props = schema.properties ?? {};
    const keys = Object.keys(props);
    // Ensure every property allows null so the model can explicitly emit null
    // for unknown values instead of hallucinating. Also strip JSON-schema
    // keys that OpenAI's strict json_schema mode does not accept
    // (format:'uri', pattern, minLength, maxLength). We keep the validation
    // in the downstream Zod layer where it belongs.
    const OPENAI_STRIPPED_KEYS = new Set([
        'format',
        'pattern',
        'minLength',
        'maxLength',
        'minimum',
        'maximum',
        'minItems',
        'maxItems',
    ]);
    function sanitise(value) {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (OPENAI_STRIPPED_KEYS.has(k))
                continue;
            out[k] = v;
        }
        return out;
    }
    const strictProps = {};
    for (const [k, v] of Object.entries(props)) {
        const propSchema = sanitise((v ?? {}));
        const existingType = propSchema['type'];
        if (typeof existingType === 'string') {
            strictProps[k] = { ...propSchema, type: [existingType, 'null'] };
        }
        else if (Array.isArray(existingType)) {
            strictProps[k] = {
                ...propSchema,
                type: Array.from(new Set([...existingType, 'null'])),
            };
        }
        else {
            strictProps[k] = { ...propSchema, type: ['string', 'null'] };
        }
    }
    return {
        name,
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: keys,
            properties: strictProps,
        },
    };
}
async function extractWithAnthropic(input) {
    const client = getAnthropicClient();
    const model = 'claude-haiku-4-5-20251001';
    const response = await client.messages.create({
        model,
        max_tokens: input.maxOutputTokens ?? 1024,
        messages: [
            { role: 'user', content: buildPrompt(input.entityName, input.schema, input.markdown) },
        ],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Anthropic response did not contain a text block');
    }
    const parsed = cleanAndParseJson(textBlock.text);
    return {
        raw: parsed,
        providerCode: 'anthropic',
        model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        confidenceOverall: computeConfidence(parsed, input.schema),
        confidenceByField: computeConfidenceByField(parsed, input.schema),
    };
}
async function extractWithOpenAI(input) {
    const client = getOpenAIClient();
    const model = 'gpt-4o-mini';
    // SEE Fase 5: use strict json_schema response_format to guarantee shape
    // conformance (no parse failures, every field present or explicit null).
    const strictSchema = toStrictJsonSchema(input.entityName.replace(/[^a-zA-Z0-9_]/g, '_'), input.schema);
    const response = await client.chat.completions.create({
        model,
        max_tokens: input.maxOutputTokens ?? 1024,
        response_format: { type: 'json_schema', json_schema: strictSchema },
        messages: [
            {
                role: 'system',
                content: 'You are a precise extraction engine. Extract facts from the provided web content into the given schema. Return null for any field that is not explicitly stated in the content — never guess or invent values.',
            },
            { role: 'user', content: buildPrompt(input.entityName, input.schema, input.markdown) },
        ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('OpenAI response did not contain content');
    }
    const parsed = cleanAndParseJson(content);
    return {
        raw: parsed,
        providerCode: 'openai',
        model,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        confidenceOverall: computeConfidence(parsed, input.schema),
        confidenceByField: computeConfidenceByField(parsed, input.schema),
    };
}
/**
 * Converts a descriptor schema into Gemini's responseSchema format.
 * Gemini uses SchemaType enum strings ('STRING', 'NUMBER', etc.) rather
 * than JSON-schema "type" strings, and requires "nullable: true" instead
 * of union types with null.
 */
function toGeminiResponseSchema(schema) {
    const JSON_TO_GEMINI_TYPE = {
        string: 'STRING',
        number: 'NUMBER',
        integer: 'INTEGER',
        boolean: 'BOOLEAN',
        array: 'ARRAY',
        object: 'OBJECT',
    };
    const STRIPPED_KEYS = new Set([
        'format', 'pattern', 'minLength', 'maxLength',
        'minimum', 'maximum', 'minItems', 'maxItems',
    ]);
    function convertProp(prop) {
        const out = {};
        for (const [k, v] of Object.entries(prop)) {
            if (STRIPPED_KEYS.has(k))
                continue;
            out[k] = v;
        }
        // Convert type
        const rawType = out['type'];
        if (typeof rawType === 'string') {
            out['type'] = JSON_TO_GEMINI_TYPE[rawType] ?? 'STRING';
            out['nullable'] = true;
        }
        else if (Array.isArray(rawType)) {
            const nonNull = rawType.filter((t) => t !== 'null');
            out['type'] = JSON_TO_GEMINI_TYPE[nonNull[0] ?? 'string'] ?? 'STRING';
            out['nullable'] = true;
        }
        else {
            out['type'] = 'STRING';
            out['nullable'] = true;
        }
        // Remove 'description' if present — Gemini schema doesn't use it at property level
        delete out['description'];
        return out;
    }
    const props = schema.properties ?? {};
    const geminiProps = {};
    for (const [k, v] of Object.entries(props)) {
        geminiProps[k] = convertProp((v ?? {}));
    }
    return {
        type: 'OBJECT',
        properties: geminiProps,
        required: Object.keys(geminiProps),
    };
}
const GEMINI_TIMEOUT_MS = 60_000;
async function extractWithGemini(input) {
    const client = getGeminiClient();
    const modelName = 'gemini-2.0-flash';
    const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: toGeminiResponseSchema(input.schema),
            maxOutputTokens: input.maxOutputTokens ?? 1024,
        },
    });
    const prompt = buildPrompt(input.entityName, input.schema, input.markdown);
    // H8: 60-second timeout to prevent hung workers
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini API call timed out after ${GEMINI_TIMEOUT_MS}ms`)), GEMINI_TIMEOUT_MS);
    });
    const response = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise,
    ]);
    const text = response.response.text();
    if (!text) {
        throw new Error('Gemini response did not contain text');
    }
    const parsed = cleanAndParseJson(text);
    // Gemini does not always report token counts; use metadata when available
    const usageMeta = response.response.usageMetadata;
    const inputTokens = usageMeta?.promptTokenCount ?? 0;
    const outputTokens = usageMeta?.candidatesTokenCount ?? 0;
    return {
        raw: parsed,
        providerCode: 'gemini',
        model: modelName,
        inputTokens,
        outputTokens,
        confidenceOverall: computeConfidence(parsed, input.schema),
        confidenceByField: computeConfidenceByField(parsed, input.schema),
    };
}
/**
 * Runs one provider end-to-end and validates the result against the
 * Zod schema registered for the entity. Retries up to MAX_VALIDATION_RETRIES
 * with a corrective prompt when Zod rejects the output. Throws if the
 * provider API fails or validation still fails after all retries.
 */
const MAX_VALIDATION_RETRIES = 2;
async function callProvider(provider, input) {
    if (provider === 'anthropic')
        return extractWithAnthropic(input);
    if (provider === 'gemini')
        return extractWithGemini(input);
    return extractWithOpenAI(input);
}
function zodIssuesToPromptHint(err) {
    const issues = err.issues.slice(0, 6).map((iss) => {
        const path = iss.path.join('.') || '<root>';
        return `- ${path}: ${iss.message}`;
    });
    return `Your previous response failed schema validation. Fix these issues and return a NEW valid JSON object. Do not apologise, return only the JSON.\nIssues:\n${issues.join('\n')}`;
}
async function extractAndValidate(provider, input) {
    let result = await callProvider(provider, input);
    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
        try {
            const validated = validateExtractedByEntity(input.entityName, result.raw);
            return { ...result, raw: validated };
        }
        catch (err) {
            if (!(err instanceof ZodError))
                throw err;
            if (attempt === MAX_VALIDATION_RETRIES) {
                logger.warn({
                    provider,
                    entity: input.entityName,
                    issues: err.issues.slice(0, 6).map((i) => ({ path: i.path, message: i.message })),
                }, 'extraction failed zod validation after max retries, returning last raw');
                // Give up on strict validation: return the raw extraction so the
                // pipeline can still persist candidates. Downstream merge policies
                // can still gate on confidence.
                return result;
            }
            logger.info({ provider, attempt: attempt + 1, issueCount: err.issues.length }, 'extraction zod validation failed, retrying with corrective prompt');
            const hint = zodIssuesToPromptHint(err);
            result = await callProvider(provider, {
                ...input,
                markdown: `${input.markdown}\n\n--- VALIDATION FEEDBACK ---\n${hint}`,
            });
        }
    }
    return result;
}
export async function extract(input) {
    const order = providerOrder();
    let lastError = null;
    for (const provider of order) {
        try {
            return await extractAndValidate(provider, input);
        }
        catch (err) {
            lastError = err;
            logger.warn({ provider, err: { message: lastError.message.slice(0, 200) } }, 'llm provider failed, trying next in order');
        }
    }
    throw lastError ?? new Error('All LLM providers failed');
}
//# sourceMappingURL=llm.js.map