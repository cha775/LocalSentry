# Third-Party Notices

PrivacyGuard uses open-source packages distributed through npm. Exact versions and
resolved dependency metadata are recorded in `package-lock.json`.

Important direct dependencies include:

- React and React DOM — MIT License;
- Zustand — MIT License;
- Lucide — ISC License;
- Tailwind CSS — MIT License;
- Vite — MIT License;
- Capacitor — MIT License;
- clsx and tailwind-merge — MIT License.

The UI references Space Grotesk and JetBrains Mono from Google Fonts. The fonts are
distributed under the SIL Open Font License. Production deployments may self-host them.

Bundled blocklist snapshots and remote list options identify their source in
`src/lib/catalog.ts` and the Ad Blocking UI. Blocklist licenses and redistribution terms
vary. Maintainers must verify source terms before each public release and preserve
required attribution. Domain names themselves may be facts, but curated list selection
and formatting can be protected; do not remove source credits.

This notice is informational and does not replace the license text supplied by each
dependency or data source.
