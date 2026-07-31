# Releasing

Pocket Cash uses **automated releases** — you don't hand-edit versions or the
changelog. Versioning and `CHANGELOG.md` are driven by your commit messages via
[release-please](https://github.com/googleapis/release-please), and the Windows
and macOS builds are produced automatically.

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
   - builds the desktop apps for **Windows and macOS in parallel** and attaches
     them to the release.

That's it — no manual tagging, no manual changelog.

## Artifacts

| Platform                      | Files                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Windows (x64)                 | `PocketCash-Setup-<v>.exe` (installer), `PocketCash.exe` (portable), `PocketCash-<v>.zip` |
| macOS (Apple Silicon / arm64) | `PocketCash-<v>-mac-arm64.dmg`, `PocketCash-<v>-mac-arm64.zip`                     |

The two platforms build as a matrix with `fail-fast: false`, so a broken build on
one still ships the other. Each job uploads only its own file globs, and the
Windows and macOS zips have distinct names, so they don't clobber each other.

**macOS is Apple Silicon only.** `macos-latest` runners are M-series, so it's a
native arm64 build — no Rosetta, no cross-compilation. Intel Macs are not covered;
to add them, put `- x64` alongside `- arm64` in each `mac.target` entry in
`apps/desktop/electron-builder.yml`. That roughly doubles the mac build time.

## macOS: unsigned builds and Gatekeeper

This project has **no paid Apple Developer certificate**, so the mac app cannot be
signed with a real identity or notarized. Two consequences:

1. **It is ad-hoc signed at build time** (`apps/desktop/scripts/adhoc-sign-mac.mjs`,
   wired in as electron-builder's `afterPack` hook). This is not cosmetic — Apple
   Silicon refuses to run arm64 code with no signature at all, and electron-builder
   invalidates Electron's own signature while packaging. Without this step the app
   dies on launch with _"Pocket Cash is damaged and can't be opened"_.

2. **Gatekeeper still quarantines the download**, because ad-hoc ≠ notarized. The
   first launch needs an explicit override. Tell testers:

   - **macOS 15 (Sequoia) and later** — double-click the app, let it be blocked,
     then go to **System Settings → Privacy & Security**, scroll to the message
     about Pocket Cash, and click **Open Anyway**. (Sequoia removed the old
     Control-click shortcut.)
   - **macOS 14 and earlier** — Control-click (right-click) the app in
     `/Applications` → **Open** → **Open**.
   - **Either version, from a terminal** — the reliable one-liner:

     ```bash
     xattr -dr com.apple.quarantine "/Applications/Pocket Cash.app"
     ```

   This is a one-time step per install, not per launch.

If the project ever gets an Apple Developer account, replace `identity: null` in
the `mac` block with the real identity, drop `hardenedRuntime: false` and
`notarize: false`, remove the `afterPack` hook, and add the signing secrets to the
workflow — the quarantine prompt then disappears entirely.

## Notes

- The builds run inside the same `Release` workflow (gated on a release being
  created) rather than a separate tag-triggered workflow, because tags pushed by
  the default `GITHUB_TOKEN` don't trigger other workflows. This keeps releases
  fully automatic with **no personal access token** to configure.
- The `workflow_dispatch` path rebuilds **both** platforms from the current branch
  and attaches them to an existing tag — use it when an in-line build failed and
  the fix landed after the tag was cut.
- The desktop icon is generated at build time from `apps/web/public/logo.png` by
  `apps/desktop/scripts/prepare-icon.mjs`, which letterboxes it onto a square
  1024×1024 canvas. macOS `.icns` generation **rejects** a non-square source, so
  don't bypass this step — edit the master logo instead.
- The three `package.json` versions and the git tag are always identical —
  release-please updates them together.
- Config lives in `release-please-config.json`; the last released version is
  tracked in `.release-please-manifest.json`.
