# Changelog

All notable changes to Pocket Cash are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
New entries below are generated automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commit](https://www.conventionalcommits.org/) messages when a release
is cut — see [docs/releasing.md](./docs/releasing.md).

## [Unreleased]

## [0.1.0] - 2026-07-17

Initial release — a clean, standalone, **local-only desktop** build.

### Added
- Offline-first desktop app (Electron shell around a Next.js standalone server),
  packaged for Windows as an installer, portable `.exe`, and `.zip`.
- Embedded in-process database (PGlite) — no external Postgres, no setup.
- Multi-institution finance model: banks, branches, and accounts.
- CSV statement import with per-institution column mapping and row-level
  deduplication.
- Transactions, categories, tags, and recurring subscriptions.
- Financial-year reports, including a tax summary with CSV export.
- Opt-in, bring-your-own-key AI features (auto-categorise, insights, tax
  deduction scan). The key is stored in the OS keychain via the app settings.
- On-disk logging with an in-app "Open logs" action for easy bug reports.
- Data export/import (backup and restore) from the app settings.

### Changed
- Converted from the original SaaS-template monorepo into a single, local-only
  desktop target: removed all cloud auth, billing, background jobs, email,
  object storage, analytics, and error-telemetry infrastructure. Nothing phones
  home.

[Unreleased]: https://github.com/tomek-i/pocket-cash-app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tomek-i/pocket-cash-app/releases/tag/v0.1.0
