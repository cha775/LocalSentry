# Privacy Policy

Last updated: March 2026

PrivacyGuard is designed as a local-first application. This policy describes the
unmodified open-source project in this repository. A person or organization that forks,
hosts, or redistributes modified code is responsible for documenting its own changes.

## Summary

- No mandatory account.
- No project-operated analytics.
- No advertising SDK.
- No application telemetry.
- No project-operated cloud log storage.
- Connection metadata, rules, settings, and reports remain in local device storage.
- HTTPS payloads, prompts, passwords, tokens, files, images, and camera frames are not
  captured or stored.

## Local data

PrivacyGuard may store the following on the user's device:

- connection metadata: application label, destination domain/IP, port, protocol,
  timestamp, metadata byte counts, and allow/block decision;
- DNS metadata: domain, record type, answer, selected provider, latency, cache state,
  and filtering decision;
- user settings, blocklists, allowlists, denylists, firewall rules, and automation;
- local notifications, counters, generated reports, and test results.

The PWA edition uses IndexedDB, localStorage, and Cache Storage scoped to the deployment
origin. The Capacitor wrapper uses the embedded web view's local storage unless a native
storage implementation is added.

## Data not collected

The unmodified project does not collect or store:

- decrypted network payloads;
- passwords, authentication tokens, cookies, or authorization headers;
- AI prompts, conversation text, source file contents, or image contents;
- camera frames, microphone audio, contacts, or clipboard contents;
- a cross-device user account or advertising identifier.

## Outbound requests

PrivacyGuard can make these documented requests:

- DNS-over-HTTPS lookups to the provider selected by the user;
- a user-triggered blocklist download from the documented public source;
- an optional connectivity check;
- web-font downloads when fonts are not yet cached;
- user-triggered probes to a local AI endpoint.

These requests are made directly from the user's device. PrivacyGuard does not proxy
them through a project-operated server.

## Data Monitor classifications

Data Monitor describes what an endpoint is designed to receive. It does not claim to
read encrypted request contents. Every classification is labeled `declared`, `inferred`,
or `unknown`.

## Permissions

Camera testing requests a real camera stream only after a user action. The stream is
stopped automatically and frames are not saved or transmitted. Other permission states
are queried through browser APIs where available.

Native packages must explain every additional OS permission and update this policy if
they add VPN, network-extension, camera, microphone, location, or background access.

## Retention and control

Users can choose retention, clear logs, delete local data, and export metadata. Clearing
browser site data or uninstalling the application may also remove local data.

Exports can contain sensitive metadata. Once exported, the file is controlled by the
user and is no longer protected by application-origin storage.

## Third-party providers

DNS resolvers, blocklist hosts, web-font hosts, GitHub Pages, and any chosen hosting
provider apply their own policies to direct requests they receive. A self-hosted edition
can bundle fonts and blocklists to reduce third-party requests.

The website host necessarily receives ordinary HTTP request metadata needed to deliver
the application, such as an IP address, timestamp, requested path, and browser user
agent. This is separate from PrivacyGuard's local network database: the unmodified app
does not transmit connection history, rules, reports, or Security Lab results to the
host. GitHub Pages users should review GitHub's own privacy statement.

## Forks and hosted copies

Open-source code can be modified. Before trusting a hosted copy:

1. confirm who controls the domain;
2. compare its source and deployed commit;
3. inspect browser network requests;
4. review its privacy policy;
5. prefer a reproducible build from a tagged release.

## Security reports

Do not publish personal logs or suspected vulnerabilities in a public issue. Follow
[`SECURITY.md`](SECURITY.md) and use GitHub private vulnerability reporting.

## Changes

Material privacy changes should be made in a reviewed pull request, noted in release
notes, and reflected in app-store privacy declarations before release.
