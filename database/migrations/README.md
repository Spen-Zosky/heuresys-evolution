# Database Migrations

## Naming Convention

All new migrations MUST follow this format:

```
{NNN}_{descriptive_name}.sql
```

Where:
- `NNN` = 3-digit sequential number (e.g., 041, 042, 055)
- `descriptive_name` = snake_case description

### Examples
- ✅ `055_consolidate_checkins_cleanup.sql`
- ✅ `056_add_employee_preferences.sql`
- ❌ `0055_...` (4 digits)
- ❌ `55_...` (2 digits)
- ❌ `055a_...` (alpha suffix)

## Current Sequence

The next available migration number is: **056**

## Historical Notes

Legacy migrations (0001-0006a) exist from early development with 4-digit format.
These are preserved for backwards compatibility but should NOT be used as a template.

## Migration Tracking

All migrations MUST record themselves in `schema_migrations`:

```sql
INSERT INTO schema_migrations (version, applied_at)
VALUES ('NNN_name', NOW())
ON CONFLICT DO NOTHING;
```

## Running Migrations

```bash
# Single migration
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_platform -f db/migrations/NNN_name.sql

# Check applied migrations
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_platform -c "SELECT * FROM schema_migrations ORDER BY version"
```

## Best Practices

1. Always wrap in `BEGIN;...COMMIT;`
2. Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
3. Add `ON CONFLICT DO NOTHING` for schema_migrations insert
4. Test on development before production
5. Create backups before running migrations
