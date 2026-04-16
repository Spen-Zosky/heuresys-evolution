# Heuresys Evolution

[![CI](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/ci.yml)
[![Security](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/security.yml)
[![Release](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/Spen-Zosky/heuresys-evolution/actions/workflows/release.yml)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://www.conventionalcommits.org)
[![Node](https://img.shields.io/badge/node-20%20LTS-339933.svg?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)


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
