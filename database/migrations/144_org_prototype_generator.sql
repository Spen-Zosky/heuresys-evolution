-- Migration 144: Org Prototype Generator Function
-- Generates a prototypal org structure (departments, job templates, skill requirements)
-- from tenant's NACE code + company size using the ESCO knowledge graph.
--
-- Usage:
--   SELECT fn_generate_org_prototype('<tenant_id>', true);   -- dry run
--   SELECT fn_generate_org_prototype('<tenant_id>', false);  -- apply

BEGIN;

CREATE OR REPLACE FUNCTION fn_generate_org_prototype(
    p_tenant_id UUID,
    p_dry_run BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_tenant RECORD;
    v_rule RECORD;
    v_nace_primary VARCHAR(10);
    v_nace_section VARCHAR(5);
    v_result JSONB := '{}';
    v_departments JSONB := '[]';
    v_positions JSONB := '[]';
    v_dept_count INT := 0;
    v_pos_count INT := 0;
    v_skill_count INT := 0;
    v_dept_rec RECORD;
    v_occ_rec RECORD;
    v_dept_id UUID;
    v_pos_id UUID;
    v_dept_code VARCHAR(20);
    v_positions_per_dept INT;
    v_dept_idx INT := 0;
    v_profile_id UUID;
BEGIN
    -- ========================================================================
    -- Step 1: Load tenant ontological profile
    -- ========================================================================
    SELECT t.id, t.code, t.name, t.nace_primary, t.nace_code, t.company_size,
           t.employee_count, t.industry_type
    INTO v_tenant
    FROM tenants t WHERE t.id = p_tenant_id;

    IF v_tenant.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Tenant not found');
    END IF;

    v_nace_primary := COALESCE(v_tenant.nace_primary, v_tenant.nace_code);
    IF v_nace_primary IS NULL THEN
        RETURN jsonb_build_object('error', 'Tenant has no NACE code configured');
    END IF;

    -- Extract NACE section letter (first char if letter, otherwise lookup)
    IF v_nace_primary ~ '^[A-Z]' THEN
        v_nace_section := LEFT(v_nace_primary, 1);
    ELSE
        -- Numeric NACE code: find section via nace_divisions/nace_sections
        SELECT nd.section_code INTO v_nace_section
        FROM nace_divisions nd
        WHERE nd.code = LEFT(v_nace_primary, 2)
        LIMIT 1;
        -- Fallback: derive from industry_type
        IF v_nace_section IS NULL THEN
            v_nace_section := LEFT(v_nace_primary, 1);
        END IF;
    END IF;

    -- ========================================================================
    -- Step 2: Load prototype rules for company size
    -- ========================================================================
    -- Try section-specific rule first, then generic
    SELECT * INTO v_rule
    FROM org_prototype_rules
    WHERE company_size = COALESCE(v_tenant.company_size, 'SMALL')
      AND nace_section = v_nace_section;

    IF v_rule.id IS NULL THEN
        SELECT * INTO v_rule
        FROM org_prototype_rules
        WHERE company_size = COALESCE(v_tenant.company_size, 'SMALL')
          AND nace_section IS NULL;
    END IF;

    IF v_rule.id IS NULL THEN
        RETURN jsonb_build_object('error', 'No prototype rule for size: ' || COALESCE(v_tenant.company_size, 'NULL'));
    END IF;

    -- ========================================================================
    -- Step 3: Find ESCO occupations relevant to tenant's NACE
    -- Uses cascading fallback: exact class → group → division → section
    -- ========================================================================
    DROP TABLE IF EXISTS _proto_occupations;
    CREATE TEMP TABLE _proto_occupations (
        occ_id UUID,
        uri VARCHAR(500),
        label_en VARCHAR(500),
        label_it VARCHAR(500),
        isco_code VARCHAR(10),
        isco_major VARCHAR(2),
        relevance INT  -- 1=exact, 2=group, 3=division, 4=section
    ) ON COMMIT DROP;

    -- NACE codes in esco_occupations.nace_codes are URIs like:
    -- 'http://data.europa.eu/ux2/nace2.1/6419' (sometimes with trailing comma)
    -- We extract the numeric code and match against the tenant's nace_primary.
    -- v_nace_primary is e.g. '64.19' — ESCO uses '6419' (no dot).

    -- Helper: normalize nace_primary to ESCO format (remove dots)
    DECLARE
        v_nace_nodot VARCHAR(10) := replace(v_nace_primary, '.', '');
        v_nace_div VARCHAR(4) := LEFT(replace(v_nace_primary, '.', ''), 2);
        v_nace_uri_prefix VARCHAR(100) := 'http://data.europa.eu/ux2/nace2.1/';
    BEGIN

    -- Level 1: Exact NACE class (e.g., URI ends with '6419')
    INSERT INTO _proto_occupations
    SELECT o.id, o.uri, o.preferred_label_en, o.preferred_label_it,
           o.isco_code, LEFT(o.isco_code, 1), 1
    FROM esco_occupations o
    WHERE EXISTS (
        SELECT 1 FROM unnest(o.nace_codes) nc
        WHERE replace(nc, ',', '') = v_nace_uri_prefix || v_nace_nodot
    );

    -- Level 2: NACE group (e.g., URI contains '641' — first 3 digits)
    IF (SELECT count(*) FROM _proto_occupations) < 10 THEN
        INSERT INTO _proto_occupations
        SELECT o.id, o.uri, o.preferred_label_en, o.preferred_label_it,
               o.isco_code, LEFT(o.isco_code, 1), 2
        FROM esco_occupations o
        WHERE EXISTS (
            SELECT 1 FROM unnest(o.nace_codes) nc
            WHERE replace(nc, ',', '') LIKE v_nace_uri_prefix || LEFT(v_nace_nodot, 3) || '%'
        )
        AND o.id NOT IN (SELECT occ_id FROM _proto_occupations);
    END IF;

    -- Level 3: NACE division (e.g., URI contains '64' — first 2 digits)
    IF (SELECT count(*) FROM _proto_occupations) < 10 THEN
        INSERT INTO _proto_occupations
        SELECT o.id, o.uri, o.preferred_label_en, o.preferred_label_it,
               o.isco_code, LEFT(o.isco_code, 1), 3
        FROM esco_occupations o
        WHERE EXISTS (
            SELECT 1 FROM unnest(o.nace_codes) nc
            WHERE replace(nc, ',', '') LIKE v_nace_uri_prefix || v_nace_div || '%'
        )
        AND o.id NOT IN (SELECT occ_id FROM _proto_occupations);
    END IF;

    -- Level 4: Fallback — use embedding similarity to tenant's industry
    -- Find occupations whose embedding is closest to the NACE section description
    IF (SELECT count(*) FROM _proto_occupations) < 10 THEN
        INSERT INTO _proto_occupations
        SELECT o.id, o.uri, o.preferred_label_en, o.preferred_label_it,
               o.isco_code, LEFT(o.isco_code, 1), 4
        FROM esco_occupations o
        WHERE o.embedding_en IS NOT NULL
          AND o.id NOT IN (SELECT occ_id FROM _proto_occupations)
        ORDER BY o.embedding_en <=> (
            SELECT ns.embedding_en FROM nace_sections ns WHERE ns.code = v_nace_section LIMIT 1
        )
        LIMIT 30;
    END IF;

    END; -- end of DECLARE block

    -- ========================================================================
    -- Step 4: Group occupations by ISCO major group → departments
    -- Use org_prototype_templates to map ISCO groups to department names
    -- ========================================================================
    DROP TABLE IF EXISTS _proto_departments;
    CREATE TEMP TABLE _proto_departments (
        dept_name_en VARCHAR(100),
        dept_name_it VARCHAR(100),
        function_type VARCHAR(20),
        isco_groups TEXT[],
        occupation_count INT,
        dept_code VARCHAR(20)
    ) ON COMMIT DROP;

    INSERT INTO _proto_departments (dept_name_en, dept_name_it, function_type, isco_groups, occupation_count, dept_code)
    SELECT
        t.department_name_en,
        t.department_name_it,
        t.function_type,
        array_agg(DISTINCT t.isco_major_group),
        COALESCE(sum(occ_cnt), 0)::INT,
        'DEPT-' || row_number() OVER (ORDER BY t.function_type, t.department_name_en)
    FROM org_prototype_templates t
    LEFT JOIN (
        SELECT isco_major, count(*) AS occ_cnt
        FROM _proto_occupations
        GROUP BY isco_major
    ) po ON po.isco_major = t.isco_major_group
    WHERE t.rule_id = v_rule.id
    GROUP BY t.department_name_en, t.department_name_it, t.function_type
    HAVING COALESCE(sum(occ_cnt), 0) > 0
        OR t.function_type = 'MANAGEMENT'  -- always include management
    ORDER BY t.function_type, t.department_name_en;

    -- Ensure we have at least min_departments by including empty core depts
    IF (SELECT count(*) FROM _proto_departments) < v_rule.min_departments THEN
        INSERT INTO _proto_departments (dept_name_en, dept_name_it, function_type, isco_groups, occupation_count, dept_code)
        SELECT t.department_name_en, t.department_name_it, t.function_type,
               ARRAY[t.isco_major_group], 0,
               'DEPT-' || (SELECT count(*) + 1 FROM _proto_departments)
        FROM org_prototype_templates t
        WHERE t.rule_id = v_rule.id
          AND t.department_name_en NOT IN (SELECT dept_name_en FROM _proto_departments)
        LIMIT (v_rule.min_departments - (SELECT count(*) FROM _proto_departments));
    END IF;

    -- ========================================================================
    -- Step 5: Generate the structure (dry-run → JSONB, apply → INSERT)
    -- ========================================================================

    -- Create org_template as parent container for job_templates (required by ck_job_has_parent)
    IF NOT p_dry_run THEN
        v_profile_id := gen_random_uuid();
        INSERT INTO org_templates (
            id, nace_section_code, nace_division_code,
            company_size_min, company_size_max,
            template_name, description,
            org_structure, recommended_roles
        ) VALUES (
            v_profile_id,
            COALESCE(v_nace_section, 'X'),
            LEFT(replace(v_nace_primary, '.', ''), 2),
            COALESCE(v_tenant.employee_count, 1),
            COALESCE(v_tenant.employee_count, 100) * 2,
            'Prototype: ' || v_tenant.name || ' (' || v_nace_primary || ')',
            'Auto-generated org prototype for ' || v_tenant.name,
            '{}', '[]'
        );
    ELSE
        v_profile_id := gen_random_uuid(); -- placeholder for dry-run
    END IF;

    v_dept_idx := 0;
    FOR v_dept_rec IN
        SELECT * FROM _proto_departments ORDER BY function_type, dept_name_en
    LOOP
        v_dept_idx := v_dept_idx + 1;
        v_dept_code := 'PROTO-' || v_dept_idx;
        v_dept_id := gen_random_uuid();

        -- Calculate positions per department
        v_positions_per_dept := GREATEST(1,
            CEIL(v_dept_rec.occupation_count * v_rule.role_specialization_factor)
        );

        -- Build positions JSONB for this department
        DECLARE
            v_dept_positions JSONB := '[]';
            v_pos_idx INT := 0;
        BEGIN
            FOR v_occ_rec IN
                SELECT po.occ_id, po.uri, po.label_en, po.label_it, po.isco_code
                FROM _proto_occupations po
                WHERE po.isco_major = ANY(v_dept_rec.isco_groups)
                ORDER BY po.relevance, po.label_en
                LIMIT v_positions_per_dept
            LOOP
                v_pos_idx := v_pos_idx + 1;
                v_pos_id := gen_random_uuid();
                v_pos_count := v_pos_count + 1;

                -- Count essential skills for this occupation
                DECLARE
                    v_essential_count INT;
                BEGIN
                    SELECT count(*) INTO v_essential_count
                    FROM esco_occupation_skills os
                    WHERE os.occupation_id = v_occ_rec.occ_id
                      AND os.relation_type = 'essential';

                    v_skill_count := v_skill_count + v_essential_count;

                    v_dept_positions := v_dept_positions || jsonb_build_object(
                        'id', v_pos_id,
                        'title_en', v_occ_rec.label_en,
                        'title_it', COALESCE(v_occ_rec.label_it, v_occ_rec.label_en),
                        'esco_occupation_uri', v_occ_rec.uri,
                        'isco_code', v_occ_rec.isco_code,
                        'essential_skills', v_essential_count
                    );

                    -- If not dry-run, INSERT the position
                    IF NOT p_dry_run THEN
                        INSERT INTO job_templates (
                            id, profile_id, tenant_id, job_code,
                            title_it, title_en,
                            esco_occupation_uri, esco_occupation_code,
                            esco_occupation_title,
                            is_management, is_prototype_generated, is_active, created_at
                        ) VALUES (
                            v_pos_id, v_profile_id, p_tenant_id,
                            v_dept_code || '-' || v_pos_idx,
                            COALESCE(v_occ_rec.label_it, v_occ_rec.label_en),
                            v_occ_rec.label_en,
                            v_occ_rec.uri,
                            v_occ_rec.isco_code,
                            v_occ_rec.label_en,
                            (LEFT(v_occ_rec.isco_code, 1) = '1'),
                            true, true, NOW()
                        );

                        -- Insert essential skill requirements
                        INSERT INTO position_skill_requirements (
                            tenant_id, position_id, position_name,
                            esco_skill_id, requirement_type, minimum_proficiency, weight
                        )
                        SELECT
                            p_tenant_id, v_pos_id, v_occ_rec.label_en,
                            os.skill_id, 'essential', 3, 1.0
                        FROM esco_occupation_skills os
                        WHERE os.occupation_id = v_occ_rec.occ_id
                          AND os.relation_type = 'essential';
                    END IF;
                END;
            END LOOP;

            -- Build department in output
            v_dept_count := v_dept_count + 1;
            v_departments := v_departments || jsonb_build_object(
                'id', v_dept_id,
                'code', v_dept_code,
                'name_en', v_dept_rec.dept_name_en,
                'name_it', v_dept_rec.dept_name_it,
                'function_type', v_dept_rec.function_type,
                'occupation_count', v_dept_rec.occupation_count,
                'positions_generated', v_pos_idx,
                'positions', v_dept_positions
            );

            -- If not dry-run, INSERT department
            IF NOT p_dry_run THEN
                INSERT INTO departments (
                    id, tenant_id, code, name, name_en, description,
                    is_active, created_at
                ) VALUES (
                    v_dept_id, p_tenant_id, v_dept_code,
                    v_dept_rec.dept_name_en, v_dept_rec.dept_name_en,
                    'Auto-generated from NACE ' || v_nace_primary || ' (' || v_dept_rec.function_type || ')',
                    true, NOW()
                )
                ON CONFLICT DO NOTHING;
            END IF;
        END;
    END LOOP;

    -- ========================================================================
    -- Step 6: Save onboarding profile snapshot
    -- ========================================================================
    v_result := jsonb_build_object(
        'tenant', jsonb_build_object(
            'id', v_tenant.id,
            'code', v_tenant.code,
            'name', v_tenant.name,
            'nace_primary', v_nace_primary,
            'nace_section', v_nace_section,
            'company_size', v_tenant.company_size,
            'industry_type', v_tenant.industry_type
        ),
        'rule', jsonb_build_object(
            'company_size', v_rule.company_size,
            'specialization_factor', v_rule.role_specialization_factor,
            'max_hierarchy_levels', v_rule.max_hierarchy_levels,
            'merge_support', v_rule.merge_support_functions
        ),
        'occupations_found', (SELECT count(*) FROM _proto_occupations),
        'departments', v_departments,
        'summary', jsonb_build_object(
            'departments_generated', v_dept_count,
            'positions_generated', v_pos_count,
            'skill_requirements_generated', v_skill_count,
            'dry_run', p_dry_run
        )
    );

    IF NOT p_dry_run THEN
        INSERT INTO tenant_onboarding_profiles (
            tenant_id, nace_occupations_snapshot, size_modifiers, prototype_config,
            departments_generated, positions_generated, skill_requirements_generated
        ) VALUES (
            p_tenant_id,
            (SELECT jsonb_agg(jsonb_build_object('uri', uri, 'label', label_en, 'isco', isco_code, 'relevance', relevance))
             FROM _proto_occupations),
            jsonb_build_object('company_size', v_rule.company_size, 'factor', v_rule.role_specialization_factor),
            v_result->'rule',
            v_dept_count, v_pos_count, v_skill_count
        );

        -- Mark onboarding completed
        UPDATE tenants SET onboarding_completed_at = NOW() WHERE id = p_tenant_id;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('144') ON CONFLICT DO NOTHING;

COMMIT;
