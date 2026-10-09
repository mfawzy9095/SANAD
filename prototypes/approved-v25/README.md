# SANAD V25 — APPROVED, ISOLATED UI PROTOTYPE

**Status:** UI design approved for reference only. **NOT** an Android release, and **NOT** a production UI integration.

## Separation contract

| Layer | Location / branch | Role |
| --- | --- | --- |
| Working Android application | `feature-v9.2-ui-features` at baseline `5b4f7e26677a276c85b307ac736da0965caf5518` | Current functional development source; DO NOT modify when prototyping |
| Protected stable builds/checkpoints | `main`, `checkpoint-v9.0.10-device-stable`, `checkpoint-v9.1.0-architecture-stable` | DO NOT touch or merge |
| Approved interactive UI V25 | `prototype/v25-approved` > `prototypes/approved-v25/index.html` | Web demo / product visual source of truth |
| Android UI integration (future work) | `ui/v25-android-integration` | Separate workbench for gated Android UI port; not production |

This branch was based on the latest observed working source SHA on 2026-10-09: `5b4f7e26677a276c85b307ac736da0965caf5518`. The only intended added files on this branch are in `prototypes/approved-v25/`. Never copy prototype demo data into financial storage.

## Preview

Open `index.html` in a browser. The HTML is standalone, including embedded optimized copies of the approved original logo and splash image. The two `assets/` WebP images are separately exposed for handoff and must **not** be redrawn in SVG. Google Fonts requests Tajawal; a fallback is used offline.

## Approved behavior

- Original SANAD shield image; original promotional launch image; small loading indicator in the white bottom area.
- Tajawal UI font.
- Splash goes directly to Home. **No Google, email, or phone login.**
- Country > bank/wallet > compact horizontally scrollable accounts > cards.
- Tap different bank or account to immediately select; tap same selected item again to view read-only details.
- Horizontal account drag scrolls only; it never auto-selects.
- Card drag tracks the finger, keeps cards fully opaque, and settles with motion.
- Per-card editable colors. Edit flows in prototype only use a mock biometric/PIN gate.
- No production finance data or credential handling in this folder.

## Explicitly outside scope

No SMS reader, parser, deduplication, account reconciliation, financial posting, native biometric security, secure storage, backup, real authentication, Gradle configuration, release/APK generation, or integration into `app/` occurs on this prototype branch.

## Isolation gate

Before starting Android UI implementation, compare this prototype branch against baseline using `git diff --name-only 5b4f7e26677a276c85b307ac736da0965caf5518...prototype/v25-approved`: **only `prototypes/approved-v25/**` may differ**. The Android integration must happen **only** on its own branch, with tests and explicit approval before any merge to working or stable branches.

## Assets

- `index.html` — unmodified V25 browser preview with images embedded.
- `assets/sanad-logo-original-optimized.webp` — exact logo image bytes extracted from the V25 HTML.
- `assets/sanad-splash-original-optimized.webp` — exact splash image bytes extracted from the V25 HTML.

**No source of truth for financial behavior:** Treat this as a design baseline, not as verified finance code.
