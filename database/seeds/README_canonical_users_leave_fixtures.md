# `canonical_users_leave_fixtures.sql` — Seed idempotente per demo leave requests

**File:** `db/seeds/canonical_users_leave_fixtures.sql`
**Created:** 2026-04-15
**Status:** Production-ready, committed
**Commit:** `b176c74`

---

## Scopo

Popolare richieste di ferie/permessi (`leave_requests`) demo per gli **8 utenti canonical** del sistema, così che ogni login canonical mostri dati realistici nel tab "Ferie e Permessi" invece di una pagina vuota. Risolve F-031 / FE-024 del QA report originale (time-off=0 per utenti canonical post-dedupe).

---

## Prerequisiti

1. **Schema DB aggiornato**: migration 196 applicata (tabella `canonical_demo_users`)
2. **Canonical users presenti**: `bash scripts/apply-canonical-users.sh` eseguito
3. **Dedupe canonical completato** (2026-04-15): i 6 employee canonical duplicati sono stati eliminati e gli user re-linkati ai record OLD con UUID reali. Le UUID usate nel seed sono quelle dei record OLD — vedere `docs/DEMO_CREDENTIALS.md` per la mappatura completa.

---

## Cosa fa

Inserisce **21 richieste di ferie/permessi** distribuite tra gli 8 utenti canonical (2-4 per utente), con mix realistico di:

| Campo | Valori |
|-------|--------|
| `leave_type` | `annual`, `sick`, `personal`, `parental` |
| `status` | `approved` (~60%), `pending` (~40%) |
| `reason` | Testo EN neutro (`Annual leave`, `Flu`, `Medical appointment`, ecc.) |
| `start_date` | Date relative calcolate a runtime (passate e future) |
| `days_requested` | 1-8 giorni |

### Distribuzione per utente

| Canonical user | Ruolo | # richieste | Tipi |
|----------------|-------|-------------|------|
| Federica Marchetti | TENANT_OWNER | 2 | annual, personal |
| Marco De Santis | IT_ADMIN | 3 | annual, sick, personal |
| Valentina Conti | HR_DIRECTOR | 3 | annual, sick, parental |
| Maria Colombo | HR_MANAGER | 2 | annual, personal |
| Paolo Caputo | DEPT_HEAD | 2 | annual, sick |
| Giuseppe Ferri | LINE_MANAGER | 3 | annual, sick, personal |
| Francesca Gallo | EMPLOYEE | 3 | annual, sick, personal |
| Pietro Barbieri | (non-canonical) | 3 | annual, sick, parental |

---

## Idempotenza

Il seed è **idempotente**: rieseguirlo 10 volte produce lo stesso risultato di una sola esecuzione, senza creare duplicati.

### Meccanismo di guard

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM leave_requests lr
  WHERE lr.employee_id = emp
    AND lr.start_date  = sdate::date
    AND lr.leave_type  = ltype
);
```

Prima di ogni INSERT, la query verifica se esiste già una riga con la stessa combinazione `(employee_id, start_date, leave_type)`. Se esiste → skip. Se non esiste → insert.

### Rationale

- **Non** usa `UNIQUE CONSTRAINT` sul DB (richiederebbe migration dedicata)
- **Non** usa `ON CONFLICT DO NOTHING` (richiederebbe constraint esplicito)
- **Usa** check applicativo `NOT EXISTS`: più lightweight, tollerante, non modifica schema

### Comportamento in scenari tipici

| Scenario | Risultato |
|----------|-----------|
| Prima esecuzione su DB pulito | INSERT 21 righe |
| Seconda esecuzione consecutiva | INSERT 0 righe |
| Dopo `DELETE` di 5 righe + riesecuzione | INSERT 5 righe (solo le mancanti) |
| Esecuzione su DB con INSERT manuali preesistenti | Conserva le righe esistenti, aggiunge solo quelle mancanti |

---

## Perché reason in inglese

I campi `reason` contengono **testo libero utente**. L'audit forense (`scripts/e2e-forensic-audit-francesca.mjs`) scansiona il DOM cercando "stringhe italiane visibili in modalità EN". Se inserissi `reason='Ferie estive'` (IT), l'audit produrrebbe un **falso positivo** quando l'utente vede il portale in EN — pur essendo dato utente reale, non bug i18n.

Soluzione: uso stringhe EN neutre (`Annual leave`, `Flu`, `Medical appointment`, `Short illness`, `Parental leave`, `Personal day`, `Annual holiday`) che:
- Leggono bene in UI EN
- Non sono parsabili come "leftover IT" dall'audit
- Sono accettabili visualmente anche in UI IT (molti HRMS italiani usano termini inglesi)

---

## Come eseguirlo

### Manualmente in locale
```bash
docker exec -i heuresys_evo_platform_db \
  psql -U heuresys -d heuresys_platform -v ON_ERROR_STOP=1 \
  < db/seeds/canonical_users_leave_fixtures.sql
```

### Da script composito (raccomandato)
```bash
# Flusso completo di bootstrap demo:
bash scripts/apply-canonical-users.sh        # 1. Canonical users da .env
docker exec -i heuresys_evo_platform_db \
  psql -U heuresys -d heuresys_platform \
  < db/seeds/canonical_users_leave_fixtures.sql   # 2. Leave requests
bash scripts/verify-canonical-users.sh       # 3. Smoke-test login
```

### In CI/CD
Potenzialmente integrabile in `.github/workflows/governance.yml` dopo `apply_canonical_users.sql`. **NOTA**: gli UUID nel seed sono quelli di produzione (OLD records post-dedupe 2026-04-15). In CI il DB è fresco e NON contiene questi UUID, quindi il seed NON farebbe INSERT (WHERE NOT EXISTS matcha nulla perché `employee_id` non esiste → constraint foreign key fallirebbe). **Non eseguire in CI senza prima mappare gli UUID ai record CI `e2000xxx`.**

---

## Come verificare il risultato

```bash
docker exec heuresys_evo_platform_db psql -U heuresys -d heuresys_platform -c "
SELECT
  (SELECT first_name || ' ' || last_name FROM employees WHERE id = employee_id) AS emp,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved
FROM leave_requests
WHERE employee_id IN (
  '5c50a8cc-da3c-4a4e-a8f9-96f221f299fe',  -- Federica
  'bd9be51b-a4d4-4c2a-be8c-065806ce0c79',  -- Marco
  '282dfaaf-5489-401f-a898-c055d10c6b0b',  -- Valentina
  'c550cecf-0a3d-4b06-9578-39594c3a7229',  -- Maria
  '3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d',  -- Paolo
  'bff71948-22ba-4c44-a9ac-b340c5afa423',  -- Giuseppe
  '665df87e-584e-4a82-aec8-2102037ddf9f',  -- Francesca
  '78a646d5-5766-4da3-9f54-678528718bc3'   -- Pietro
)
GROUP BY employee_id
ORDER BY total_requests DESC;"
```

Atteso: ogni canonical con almeno 2 richieste, mix pending/approved.

---

## Limitazioni conosciute

1. **Date relative rigenerate a runtime**: `CURRENT_DATE + 30` calcolato al momento dell'INSERT. Ciò significa:
   - Le date storiche (`CURRENT_DATE - 90`) cadranno sempre ~90 giorni fa indipendentemente da quando giri il seed → demo resta temporalmente "recente"
   - Però l'idempotency guard usa `start_date = sdate::date` → se il seed gira a distanza di giorni, le nuove date non matchano quelle vecchie e potrebbe creare duplicati su esecuzioni multiple distanti nel tempo
   - **Workaround**: eseguire una sola volta dopo ogni reset DB; evitare rerun quotidiani

2. **Non include `employee_time_off_requests`** — schema separato con campi estesi (half_day_start/end, cancellation_requested, ecc.). Per seed analogo su quella tabella serve file dedicato.

3. **UUID hardcoded prod-only** — vedere nota CI sopra. Divergenza prod↔CI è documentata in `db/seeds/ci_test_seed.sql`.

4. **Non copre workflow completo**: le richieste hanno `status='approved'` o `'pending'` ma non impostano `approver_id`, `approved_at`, `rejection_reason`. Sono approvate/pendenti "al volo" senza storia audit. Per test di workflow di approvazione completo serve esteso.

5. **Pietro Barbieri NON è più canonical** (post-dedupe 2026-04-15) — EMPLOYEE canonical è Francesca Gallo. Pietro è un utente normale con hash password legacy. Il seed include comunque dati per Pietro perché il suo record `78a646d5` ha storia (15 enrollments, ecc.) ed è utile per demo cross-user senza login Pietro.

---

## Quando rieseguirlo

- ✅ Dopo `docker compose down -v` (perdita volume DB) + restore da dump vecchio
- ✅ Dopo reset manuale del DB in dev
- ✅ Quando aggiungi nuovi ruoli canonical e vuoi dati demo (→ estendere il VALUES clause)
- ❌ NON eseguire ripetutamente senza motivo — il guard previene duplicati ma è uno spreco di cicli DB
- ❌ NON eseguire in CI senza prima adattare UUID ai seed `e2000xxx`

---

## Relazioni con altri seed

| File | Scopo | Relazione con questo seed |
|------|-------|---------------------------|
| `db/seeds/ci_test_seed.sql` | Seed CI/CD (GitHub Actions) | Complementare — questo seed NON gira in CI |
| `db/scripts/apply_canonical_users.sql` | Canonical users da .env | **Prerequisito**: deve girare PRIMA |
| `scripts/apply-canonical-users.sh` | Wrapper bash per quanto sopra | Stesso prerequisito |
| `scripts/verify-canonical-users.sh` | Smoke-test 8 canonical login | Complementare — verifica dopo questo seed |

---

## Estensione futura

Per aggiungere nuovi tipi di dati demo seguendo lo stesso pattern idempotente:

```sql
-- Esempio per goals fixtures
INSERT INTO goals (id, tenant_id, employee_id, title, goal_type, status, ...)
SELECT gen_random_uuid(), e.tenant, emp, goal_title, ...
FROM e, (VALUES
  ('francesca', 'Complete FRM certification', 'individual', 'in_progress', ...),
  -- ...
) AS v(emp_key, goal_title, goal_type, status, ...)
JOIN LATERAL (CASE emp_key ... END AS emp) x ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM goals g
  WHERE g.employee_id = emp AND g.title = goal_title
);
```

Pattern comune:
1. CTE `e` con mappa nomi → UUID
2. `VALUES` con tuple dati
3. `LATERAL CASE` per risolvere `emp_key` → UUID
4. `WHERE NOT EXISTS` guard con chiave naturale applicativa

---

## Artefatti correlati

- **Codice**: `db/seeds/canonical_users_leave_fixtures.sql` (66 righe)
- **Documentazione**: questo file
- **Source of truth UUID**: `docs/DEMO_CREDENTIALS.md`
- **Audit script**: `scripts/e2e-forensic-audit-francesca.mjs`
- **Remediation context**: `docs/agent_reports/qa_audits/francesca_20260415/REMEDIATION_SUMMARY.md`
- **Commit**: `b176c74` (feat(seed): canonical users leave_requests fixtures)

---

*Documento 2026-04-15 — aggiornare se si modifica il seed.*
