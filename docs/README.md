# Pocket Cash — Documentation

Design and reference docs for Pocket Cash — a local-only, offline-first personal
finance **desktop** app (Turborepo monorepo: Next.js 15 + React 19, embedded PGlite
+ Drizzle, Tailwind v4, Biome; web + Electron share one UI, single-user, no cloud).

| Doc                                | What it is                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | How web + Electron share one UI/codebase over an embedded PGlite database; the layers, key decisions, and desktop specifics. |
| [csv-import-plan.md](csv-import-plan.md) | The bank/account/transaction model and the per-institution CSV import engine (dedup + testing strategy). |
| [releasing.md](releasing.md)       | How versions and Windows builds are cut — automated via release-please + Conventional Commits.                               |

The root [`README.md`](../README.md) is the product overview; `CHANGELOG.md` is the
release history.
