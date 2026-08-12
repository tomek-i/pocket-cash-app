<div align="center">

<img src="./apps/web/public/logo.png" alt="" width="76" />

# Pocket Cash

**Finally understand where your money goes.**

Turn messy bank CSV exports into a calm, organised view of your spending. Import,
auto-dedupe, categorise, and run financial-year and tax reports. It all runs on
your own machine, with no account, no cloud and no telemetry.

[![Latest release](https://img.shields.io/github/v/release/tomek-i/pocket-cash-app?label=download&color=e5e52e)](https://github.com/tomek-i/pocket-cash-app/releases/latest)
[![CI](https://github.com/tomek-i/pocket-cash-app/actions/workflows/ci.yml/badge.svg)](https://github.com/tomek-i/pocket-cash-app/actions/workflows/ci.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-blue)](./LICENSE)

[**Download**](https://github.com/tomek-i/pocket-cash-app/releases/latest) ·
[Website](https://tomek.au/pocket-cash-app/) ·
[Docs](./docs) ·
[Changelog](./CHANGELOG.md) ·
[Report an issue](https://github.com/tomek-i/pocket-cash-app/issues)

![The Pocket Cash dashboard: total net worth across two accounts, a spending-by-category donut, income and spending for the month, recent activity and upcoming subscriptions.](./docs/assets/dashboard.png)

</div>

## Why

- **Your data never leaves your device.** The database sits in the app's own
  folder. There is no sign-in, no server and no analytics. Nothing phones home.
- **Works with any bank.** If it exports CSV, it works. You map the columns once,
  and that mapping becomes a reusable importer for every future statement.
- **Nothing gets double-counted.** Re-import the same file safely. Each account
  fingerprints its rows, so duplicates are skipped.
- **Built for tax time.** Financial-year summaries, net-worth trends, and a tax
  report you can export to CSV.
- **AI, only if you want it.** Auto-categorising, insights and a deduction scan.
  Off by default, and it can run fully offline against a local model.

## See it in action

| Categorised transactions | Financial-year report | CSV column mapping |
| :----------------------: | :-------------------: | :----------------: |
| [![Transactions list with coloured category chips per row.](./docs/assets/transactions.png)](./docs/assets/transactions.png) | [![Financial-year report: income, spending, net, spending breakdown and a tax helper.](./docs/assets/fy-report.png)](./docs/assets/fy-report.png) | [![CSV import screen mapping statement columns, with a live parsed preview.](./docs/assets/csv-mapping.png)](./docs/assets/csv-mapping.png) |

## Download

Grab the latest build from [**Releases**](https://github.com/tomek-i/pocket-cash-app/releases/latest).

| Platform                      | What you get                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| **Windows 10/11**             | Installer (`PocketCash-Setup-<v>.exe`), a portable `.exe`, or a `.zip` |
| **macOS 11+** (Apple Silicon) | `PocketCash-<v>-mac-arm64.dmg` or a `.zip`                            |

The download is around 100 to 120 MB. There is no Intel Mac or Linux build.

The builds are **unsigned**, because this project has no paid Microsoft or Apple
certificates. Windows SmartScreen will warn about an unknown publisher, and macOS
needs a [one-time Gatekeeper override](./docs/releasing.md#macos-unsigned-builds-and-gatekeeper)
the first time you open it.

## Built with

[Next.js](https://nextjs.org) (App Router) · [React](https://react.dev) ·
[Electron](https://electronjs.org) · [PGlite](https://pglite.dev) +
[Drizzle](https://orm.drizzle.team) · [Tailwind](https://tailwindcss.com) ·
[Turborepo](https://turbo.build)

The desktop app is a thin Electron shell that boots the same Next.js server
in-process, so web and desktop share one UI and one codebase.

## Documentation

| Doc                                       | What it covers                                                        |
| ----------------------------------------- | --------------------------------------------------------------------- |
| [development.md](./docs/development.md)   | Run it locally, repo layout, scripts, testing, building the installer  |
| [architecture.md](./docs/architecture.md) | How web and Electron share one UI over an embedded database            |
| [releasing.md](./docs/releasing.md)       | How versions and builds are cut, plus the macOS Gatekeeper step        |

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE). You can use, fork, modify and
share it for **noncommercial purposes**. Personal use, hobby projects, study and
contributions are all welcome. Commercial use is not permitted. This is a
source-available licence, not an OSI "open source" one.

Copyright © 2026 Tomek Iwainski.
