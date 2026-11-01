# Contributing to PrivacyGuard

Thank you for helping build a transparent, local-first privacy tool.

## Principles

Contributions must preserve these product rules:

- local-first storage by default;
- no mandatory account, advertising, analytics, or hidden telemetry;
- metadata-only inspection; no TLS interception;
- least privilege and explicit permission explanations;
- observed, inferred, simulated, and unknown data remain distinguishable;
- no security or privacy capability is claimed without evidence;
- safe recovery and deletion remain available.

## Development setup

```bash
git clone https://github.com/YOUR-USER/privacyguard.git
cd privacyguard
npm ci
npm run dev
```

Node.js 20.19+ is recommended.

## Before submitting a pull request

```bash
npm audit --omit=dev --audit-level=high
npm run build
```

Then run **Security Lab → Run all tests** in the built application.

## Pull-request requirements

- Explain the user problem and solution.
- List data-flow, storage, permission, and outbound-domain changes.
- Add or update tests for security-sensitive logic.
- Update `PRIVACY.md` for new stored or transmitted data.
- Update `docs/PROJECT_GUIDE.md` for architecture or deployment changes.
- Include mobile screenshots for significant UI changes.
- Keep TypeScript strict and the production build clean.
- Do not include real user logs or generated signing files.

## New network destination checklist

Any new outbound host must include:

- why it is necessary;
- when the request occurs;
- whether user action is required;
- what metadata the third party receives;
- a Security Lab telemetry-audit update;
- an offline/failure behavior;
- privacy documentation.

## New storage checklist

For a new stored field:

- justify why it is required;
- document retention;
- implement export and deletion behavior;
- avoid payloads, credentials, and stable cross-device identifiers;
- update `PRIVACY.md`.

## New permission checklist

- request only at the moment of use;
- explain the purpose before the OS prompt;
- handle denial safely;
- avoid background access unless essential;
- add a visible status and revocation guide;
- update store privacy declarations.

## Blocklist changes

Document source, maintainer, update URL, content format, and license. Lists are parsed as
data and must never execute downloaded content.

## Commit and review guidance

- Use focused commits.
- Prefer clear messages such as `fix: prevent allowlist suffix bypass`.
- Keep unrelated formatting out of security fixes.
- Expect at least one maintainer review for rule-engine, persistence, PWA, workflow, or
  privacy changes.

## Security findings

Do not submit vulnerabilities through a public pull request before coordination. Follow
`SECURITY.md`.

## Community conduct

Participation is governed by `CODE_OF_CONDUCT.md`.
