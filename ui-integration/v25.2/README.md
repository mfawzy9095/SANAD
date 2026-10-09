# SANAD V25.2 — Android integration sandbox (in progress)

## Current state: foundation only, NOT V25.2 UI

**Source:** functional SHA `5b4f7e26677a276c85b307ac736da0965caf5518` from `feature-v9.2-ui-features`. On 2026-10-09 its functional CI and emulator gates succeeded. The independent `ui/v25.2-android-integration` branch is the only destination for changes. Do not merge it without explicit approval.

**Missing dependency:** `SANAD_V25_2_Icons_Restored_Interactive.html`, the final V25.2 visual/interaction reference, has not been supplied to this workbench or located in the checked repository. `prototype/v25-approved` contains V25, **not V25.2**. No visual replacement is justified until the real reference and its fonts/icons/assets are reviewed. Do not substitute the V25 demo for an approved V25.2 build.

## Safe sandbox APK

The `v25UiPreview` Gradle build type creates an isolated QA package:

- Package: `com.sanad.v9test.v25uipreview`
- Existing functional package: `com.sanad.v9test`
- Version: `9.2.14-financial-qa-v25-ui-preview` / code `92014` (baseline functionality, **not a finished V25.2 UI version**)
- `debug` signature, not the release or forensic-QA signature.
- Dedicated Android application data/sandbox; NO automatic migration/import from the installed SANAD app.
- It can coexist with the original package. Its ephemeral CI debug signing key may change between workflows; never use this disposable preview for irreplaceable financial data or rely on in-place preview upgrades.

The integration workflow builds `assembleV25UiPreview`, validates the package identifier and archive, runs existing JS/browser/JVM/lint suites and Android 35 emulator smoke tests, and uploads the isolated preview APK with an evidence file. This verifies regression compatibility of the **unmodified functional UI** only; it does not constitute a V25.2 acceptance test.

## Baseline protection

For now, existing financial core JS, Android SMS service and the WebView bridge are unchanged. The repository currently contains its real business UI in `app/src/main/assets/index.html` inside Android WebView; it is **not** a native View/Compose UI. Do not claim that merely copying prototype HTML into the asset creates native screens.

Next implementation work must port V25.2 into Android components where feasible, preserve a single authoritative financial state machine and build a contract-tested native presentation bridge rather than a second financial ledger. Native screens must never use synthetic prototype PIN/data. Reuse existing authentic visual assets only where their source is verified.

## Release gates before considering any real V25.2 APK

1. Receive and visually verify final V25.2 HTML/reference, image/icon assets, and Tajawal license/asset provenance.
2. Map all current finance and SMS UI/actions to a stable typed interface. Prefer read-only adapters initially; gate mutations by established security checks.
3. Implement screen-by-screen with live account/provider/card state and exact selection/drag behavior.
4. Connect import overlay to real scanned, parsed, deduplicated, reviewed, and committed counts; indeterminate state where a phase has no computable total.
5. Test no loss of existing finance/import/review/backup access, no mixed-currency balances, and no duplicate posting.
6. Confirm accessibility, RTL, orientation, reboot/upgrade, performance, biometric and actual SMS behaviors. Hardware-specific checks require a real device.
7. Only after verified APK + complete results: request approval for any merge, signing changes or original app updates.

## Rollback

Delete/uninstall **only** the separately identified `com.sanad.v9test.v25uipreview` preview package if necessary. Never uninstall or clear data of `com.sanad.v9test` as part of this integration. Source rollback: return to `feature-v9.2-ui-features` at the recorded baseline; stable branches have not been modified.
