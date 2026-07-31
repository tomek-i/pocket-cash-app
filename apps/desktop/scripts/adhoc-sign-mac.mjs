// electron-builder `afterPack` hook: apply an ad-hoc code signature on macOS.
//
// Why this is REQUIRED (not a nicety): Apple Silicon refuses to execute arm64
// code with no signature at all. Electron's prebuilt binaries ship ad-hoc signed,
// but electron-builder invalidates that signature the moment it renames the
// executable, rewrites Info.plist, and injects our resources. Ship the result
// as-is and the app dies on launch with "Pocket Cash is damaged and can't be
// opened" — the friend testing it never even sees a window.
//
// We have no paid Apple Developer certificate, so `mac.identity` is null and
// electron-builder's own signing step is a no-op (it returns early — which is
// also why this is an `afterPack` hook and not `afterSign`: electron-builder
// SKIPS the afterSign hook entirely when no signing occurred). Re-signing here
// with the ad-hoc identity `-` produces a valid, launchable bundle.
//
// This does NOT make the app notarized. Gatekeeper still quarantines it on
// download; the first launch needs right-click → Open (see docs/releasing.md).
//
// Ordering: electron-builder runs doPack (files + extraResources copied) →
// afterPack (here) → its own sign step (no-op) → dmg/zip targets. So the
// signature covers the complete bundle and survives into the artifacts.

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export default async function afterPack(context) {
  // Only for macOS output, and only when running ON macOS (codesign is an Apple
  // tool — it doesn't exist on the Windows/Linux runners).
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') return

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  try {
    // --deep signs the nested frameworks/helpers too. It's deprecated for real
    // distribution signing, but it's the correct and standard tool for a
    // blanket ad-hoc pass over an Electron bundle.
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
    execFileSync('codesign', ['--verify', '--deep', appPath], { stdio: 'inherit' })
    console.log(`✅ [adhoc-sign] ad-hoc signed ${appPath}`)
  } catch (error) {
    // Don't fail the build — a packaged-but-unlaunchable artifact is still worth
    // inspecting, and this must be loud rather than fatal.
    console.warn(
      `⚠️  [adhoc-sign] codesign failed for ${appPath}: ${error instanceof Error ? error.message : error}\n` +
        '   The resulting app will likely NOT launch on Apple Silicon.',
    )
  }
}
