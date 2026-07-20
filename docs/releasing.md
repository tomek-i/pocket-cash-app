# Releasing

Pocket Cash uses **automated releases** — you don't hand-edit versions or the
changelog. Versioning and `CHANGELOG.md` are driven by your commit messages via
[release-please](https://github.com/googleapis/release-please), and the Windows
build is produced automatically.

## The flow

1. **Write [Conventional Commits](https://www.conventionalcommits.org/).** The
   commit _type_ decides the version bump:

   | Commit                                  | Bump      | Example                                        |
   | --------------------------------------- | --------- | ---------------------------------------------- |
   | `fix: …`                                | patch     | `fix: crash on empty CSV import`               |
   | `feat: …`                               | minor     | `feat: add tax deduction scanner`              |
   | `feat!: …` / `BREAKING CHANGE:` footer  | major     | `feat!: drop legacy mapping format`            |
   | `docs:` `refactor:` `perf:` `chore:` …  | no bump\* | `chore: bump deps`                             |

   \* still shown in the changelog where relevant (see `release-please-config.json`).

2. **Push to `main`.** The `Release` workflow opens (or updates) a **Release PR**
   titled _"chore: release X.Y.Z"_. It bumps the version in `package.json`
   (root + `apps/desktop` + `apps/web`, kept in sync) and regenerates
   `CHANGELOG.md` from the commits since the last release. It keeps updating as you
   merge more work.

3. **Merge the Release PR when you're ready to ship.** That:
   - tags `vX.Y.Z` and creates the GitHub Release with notes, then
   - builds the Windows installer / portable / zip and attaches them to the release.

That's it — no manual tagging, no manual changelog.

## Notes

- The build runs inside the same `Release` workflow (gated on a release being
  created) rather than a separate tag-triggered workflow, because tags pushed by
  the default `GITHUB_TOKEN` don't trigger other workflows. This keeps releases
  fully automatic with **no personal access token** to configure.
- The three `package.json` versions and the git tag are always identical —
  release-please updates them together.
- Config lives in `release-please-config.json`; the last released version is
  tracked in `.release-please-manifest.json`.
