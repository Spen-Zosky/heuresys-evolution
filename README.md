# Heuresys Evolution

**Organizational Intelligence & Workforce Orchestration Platform**

Multi-tenant enterprise platform that governs organizational capability as a
measurable construct — processes, structure, roles, competencies, and performance
unified in a single semantic graph.

---

## Stack

| Layer          | Technology                                          |
|----------------|-----------------------------------------------------|
| Runtime        | Node.js 20 LTS                                      |
| API Gateway    | Express 5, TypeScript                               |
| Frontend       | Next.js 16 (App Router, standalone)                 |
| Database       | PostgreSQL 16 + pgvector + RLS                      |
| Cache / Queue  | Redis 7                                             |
| Observability  | Prometheus, Grafana, Loki, Promtail, Alertmanager   |
| Backup         | pgBackRest (incremental + full)                     |
| Deployment     | systemd bare-metal + Docker Compose                 |

## Repository Layout

Monorepo (npm workspaces):

```
backend/
  api/           # API Gateway (port 3000)
  enrichment/    # Enrichment engine (port 8020)
frontend/        # Next.js app (port 3012)
infra/           # Infrastructure scripts, compose files, runbooks
scripts/         # CLI tools and maintenance scripts
```

> **Note on documentation**: architecture docs, governance source-of-truth,
> plans, runbooks and internal deliverables are maintained in a separate
> internal documentation store and are not mirrored in this repository.

## Branches

- `main` — production, protected, release-please auto-tags
- `develop` — experimental integration, rebases onto main
- `feature/*`, `fix/*`, `chore/*` — short-lived, PR into `develop`

## E2E testing

End-to-end tests read base URLs from environment variables:

```bash
export E2E_BASE_URL=http://localhost:3012
export E2E_API_URL=http://localhost:8012
npm test -w frontend
```

Defaults to localhost if unset. See `.env.example`.

## License

Proprietary. See [`LICENSE`](LICENSE). All Rights Reserved.
