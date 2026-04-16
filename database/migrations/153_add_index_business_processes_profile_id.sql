-- Migration 153: Add missing index on business_processes.profile_id
-- Part of O0 Foundation Fix
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_processes_profile_id
ON business_processes (profile_id);
