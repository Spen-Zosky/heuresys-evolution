# Security Policy

## Supported Versions

| Version        | Supported              |
| -------------- | ---------------------- |
| `main`         | :white_check_mark:     |
| latest release | :white_check_mark:     |
| older tags     | :x:                    |

Only the current `main` branch and the most recent tagged release receive
security fixes. Older versions are not backported.

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

Report privately via GitHub Security Advisories:

1. Go to https://github.com/Spen-Zosky/heuresys-evolution/security/advisories/new
2. Fill in affected versions, impact, reproduction steps
3. Submit — only maintainers will see the report

## Response SLA

| Stage                 | Target time |
| --------------------- | ----------- |
| Acknowledge receipt   | 72 hours    |
| Initial assessment    | 7 days      |
| Fix or mitigation     | depends on severity (critical: 7d, high: 30d, medium: 90d) |
| Public disclosure     | after patch release, coordinated with reporter |

## Scope

In scope:
- Authentication / authorization bypass (RBP framework)
- SQL injection, RLS policy bypass
- Remote code execution, path traversal
- Secret exposure, credential leakage
- Privilege escalation across tenants

Out of scope:
- Vulnerabilities in third-party services we don't control
- Social engineering, physical access
- Denial of service from unauthenticated endpoints without amplification
- Self-XSS requiring user to paste code in browser devtools
- Missing security headers without demonstrable impact

## Hardening features

This repository uses:
- GitHub Secret Scanning + Push Protection (blocks committed secrets at push time)
- Dependabot security updates + weekly version updates
- Gitleaks secret scan on every push (`.github/workflows/security.yml`)
- npm audit on every push
- Branch rulesets on `main` (required PR review, linear history, signed merges)
- CODEOWNERS review required on `/infra/`, `/.github/`, `/scripts/`

## Safe harbor

Good-faith security research performed in accordance with this policy will not
be subject to legal action. Please avoid:
- Accessing data that does not belong to you
- Disrupting production services
- Automated vulnerability scanners against production

Thank you for helping keep Heuresys and its users safe.
