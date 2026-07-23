# Changelog

All notable changes to Pocket Cash are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
New entries below are generated automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commit](https://www.conventionalcommits.org/) messages when a release
is cut — see [docs/releasing.md](./docs/releasing.md).

## [0.2.0](https://github.com/tomek-i/pocket-cash-app/compare/v0.1.0...v0.2.0) (2026-07-23)


### Features

* add Open logs + Report an issue to the global error screen ([2288293](https://github.com/tomek-i/pocket-cash-app/commit/228829336f7a9f21461068cd99514fbc1a030e3b))


### Bug Fixes

* don't let electron-builder publish (workflow uploads artifacts itself) ([cf5c4e3](https://github.com/tomek-i/pocket-cash-app/commit/cf5c4e3284ff07e75f1d1e1dd99ba4ab57177a4f))
* resolve pglite from apps/web in the desktop build (unbreaks Windows build) ([bef1270](https://github.com/tomek-i/pocket-cash-app/commit/bef1270ef4ce9fd61ccb66da256679f9ea9c1fd2))

## 0.1.0 (2026-07-23)


### Features

* initial public release of Pocket Cash ([8d350c2](https://github.com/tomek-i/pocket-cash-app/commit/8d350c292e2dad0bd3a9ecc92f8e9b54fbb013e2))


### Documentation

* add AGENTS.md contributor guide + skip release job on docs-only pushes ([74933ac](https://github.com/tomek-i/pocket-cash-app/commit/74933ac48df60ffe106f0d441889e95ad9465397))
* add AGENTS.md contributor guide for AI agents ([a261cd1](https://github.com/tomek-i/pocket-cash-app/commit/a261cd15976af0d8c8e683e2802168f0f915da95))


### Miscellaneous

* pin the first release to v0.1.0 ([ba2aa59](https://github.com/tomek-i/pocket-cash-app/commit/ba2aa598cfb84fa568757b17a181b3b75d25e320))

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
