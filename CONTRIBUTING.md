# Contributing to Heuresys Evolution

## Branch Strategy (GitHub Flow adattato)

- `main` — production. Protected. Only updated via release PRs from `develop`.
- `develop` — integration branch for experimental work. Rebases onto `main`.
- `feature/<slug>`, `fix/<slug>`, `chore/<slug>` — short-lived, open PR into `develop`.

## Commit Convention

Heuresys uses [Conventional Commits](https://www.conventionalcommits.org/)
enforced by `commitlint` + `husky` on `commit-msg` hook.

Format:

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer(s)>
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`,
`build`, `ci`, `style`, `revert`.

Examples:

```
feat(api): add endpoint for tenant capability snapshot
fix(rbp): handle null scope on SUPERUSER impersonation
chore(deps): bump pg to 8.13.1
```

Breaking changes: append `!` after type (`feat!:`) or include
`BREAKING CHANGE:` in footer. `release-please` uses these to compute semver
bumps.

## Pull Requests

1. Fork/branch from `develop` (or `main` for hotfixes).
2. Keep PRs small and focused — one concern per PR.
3. Fill in the PR template (what / why / how to test).
4. CI must be green (lint + typecheck + test + security).
5. At least 1 approving review is required on `main`.
6. Squash merge is the default strategy.

## Local Development

See `docs/developer/README.md` for environment setup.

## Security

Never commit secrets, tokens, or `.env` files. All secrets live in:
- `/home/ubuntu/heuresys.com.evo/.env` on VM (gitignored)
- GitHub Actions Secrets for CI/CD

Report security issues privately to `spen.zosky@gmail.com`.
