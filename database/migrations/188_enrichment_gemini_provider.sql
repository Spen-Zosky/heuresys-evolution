-- Activate the Gemini LLM provider (seeded inactive in migration 179).
BEGIN;
UPDATE enrichment_llm_providers SET is_active = true, updated_at = NOW() WHERE code = 'gemini';
COMMIT;
