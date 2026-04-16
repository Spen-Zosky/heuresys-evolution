-- Migration 112: Populate Italian national holidays 2025-2027
-- Date: 2026-03-18
-- Sprint: R2 (Data Integrity)
--
-- Populates the holidays table with Italian national fixed holidays
-- and Easter-dependent movable holidays for years 2025-2027.
-- Each holiday is inserted for all existing tenants.

-- Helper: insert holidays for all tenants
DO $$
DECLARE
  t_id UUID;
  -- Easter dates (pre-calculated)
  -- 2025: April 20, 2026: April 5, 2027: March 28
  easter_dates DATE[] := ARRAY['2025-04-20'::DATE, '2026-04-05'::DATE, '2027-03-28'::DATE];
  yr INT;
  easter DATE;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    FOR yr IN 2025..2027 LOOP
      easter := easter_dates[yr - 2024];

      -- Fixed national holidays
      INSERT INTO holidays (id, tenant_id, date, name, name_en, holiday_type, country_code, is_recurring, is_active)
      VALUES
        (gen_random_uuid(), t_id, make_date(yr, 1, 1),   'Capodanno',              'New Year''s Day',        'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 1, 6),   'Epifania',               'Epiphany',               'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 4, 25),  'Festa della Liberazione','Liberation Day',         'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 5, 1),   'Festa dei Lavoratori',   'Labour Day',             'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 6, 2),   'Festa della Repubblica', 'Republic Day',           'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 8, 15),  'Ferragosto',             'Assumption of Mary',     'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 11, 1),  'Tutti i Santi',          'All Saints'' Day',       'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 12, 8),  'Immacolata Concezione',  'Immaculate Conception',  'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 12, 25), 'Natale',                 'Christmas Day',          'national', 'IT', true, true),
        (gen_random_uuid(), t_id, make_date(yr, 12, 26), 'Santo Stefano',          'St. Stephen''s Day',     'national', 'IT', true, true)
      ON CONFLICT DO NOTHING;

      -- Easter-dependent movable holidays
      -- Easter Monday (Pasquetta) = Easter + 1 day
      INSERT INTO holidays (id, tenant_id, date, name, name_en, holiday_type, country_code, is_recurring, is_active)
      VALUES
        (gen_random_uuid(), t_id, easter,     'Pasqua',    'Easter Sunday', 'national', 'IT', false, true),
        (gen_random_uuid(), t_id, easter + 1, 'Pasquetta', 'Easter Monday', 'national', 'IT', false, true)
      ON CONFLICT DO NOTHING;

    END LOOP;
  END LOOP;
END;
$$;

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('112_populate_italian_holidays', NOW())
ON CONFLICT DO NOTHING;
