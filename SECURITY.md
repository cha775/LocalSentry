# Security Policy

## Supported versions

Security fixes are provided for the latest release on the `main` branch. Older tags may
not receive fixes unless a maintainer explicitly announces backport support.

## Report a vulnerability privately

**Do not open a public issue for a vulnerability. Do not attach real network logs,
credentials, keystores, certificates, or personal data to an issue.**

Preferred reporting method:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Submit a private GitHub Security Advisory report.

Before launch, the repository owner must enable **Settings → Code security and analysis
→ Private vulnerability reporting**.

If private reporting is unavailable, open a minimal public issue asking for a private
security contact. Do not include exploit details in that issue.

## Include in the report

- affected version or commit;
- affected platform and browser/OS;
- impact and attack prerequisites;
- minimal reproduction steps or proof of concept;
- whether personal data or signing material may be exposed;
- suggested remediation, if known;
- whether the issue has been shared elsewhere.

Redact unrelated domains, usernames, process paths, IP addresses, and all credentials.

## Response targets

Maintainers aim to:

- acknowledge a report within 3 business days;
- provide an initial severity assessment within 7 business days;
- coordinate remediation and disclosure based on impact;
- credit good-faith reporters unless they request anonymity.

These are goals, not a service-level guarantee for an unpaid open-source project.

## Scope

Examples in scope:

- remote code execution or script injection;
- bypass of a documented blocking decision;
- unexpected transmission of local logs, rules, or reports;
- service-worker cache poisoning within the application's threat model;
- unauthorized camera/microphone capture by PrivacyGuard;
- secret exposure in builds or workflows;
- malicious dependency or update behavior;
- phishing scanner bypasses with meaningful user impact.

Usually out of scope:

- traffic the browser or OS does not expose to a web application;
- claims that DNS blocking cannot remove same-origin ads;
- social engineering with no product flaw;
- attacks requiring a previously compromised/unlocked device and no additional boundary
  bypass;
- automated scanner output without a reproducible impact;
- denial of service from extreme local input with no security boundary crossed.

## Good-faith research

- Test only accounts and devices you own or are authorized to test.
- Do not access, retain, alter, or publish other people's data.
- Avoid disrupting public deployments.
- Stop and report if you encounter personal data.
- Allow a reasonable remediation period before disclosure.

## Maintainer release process

For a confirmed vulnerability:

1. reproduce privately;
2. assign severity and affected versions;
3. prepare the smallest safe fix and regression test;
4. run build, audit, and Security Lab;
5. issue a GitHub Security Advisory and patched release;
6. rotate any exposed secret or signing material;
7. document user actions clearly.
