# SANAD V3.6 — Review Entry Point

The current workspace also contains an **experimental hybrid voice path**. See
`HYBRID_VOICE_TRIAL.md` for setup, behavior, and validation limits. The V3.6
handoff below describes the original offline-only baseline.

Current release: **3.6-critical-stabilization** (`versionCode 36`).

Start with:
1. `HANDOFF_V36.md`
2. `qa/test-v36-critical.js`
3. `.github/workflows/build-v36.yml`

V3.6 focuses only on critical stabilization: optimized native Whisper builds, AudioRecord stop ownership, encrypted-state fail-closed recovery, three encrypted state snapshots, removal of Web Speech/fake voice fallbacks, a voice finalization watchdog, and unified release identity.

Historical V2.x/V3.x patch files and workflows remain in the repository for traceability and are not the active V3.6 runtime.
