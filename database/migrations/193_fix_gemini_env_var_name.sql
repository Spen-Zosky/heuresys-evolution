-- Migration 193: Fix Gemini provider api_key_env_ref
-- Migration 179 seeded api_key_env_ref='GOOGLE_API_KEY' but env.ts reads GEMINI_API_KEY
BEGIN;

UPDATE enrichment_llm_providers
   SET api_key_env_ref = 'GEMINI_API_KEY', updated_at = NOW()
 WHERE code = 'gemini';

COMMIT;
