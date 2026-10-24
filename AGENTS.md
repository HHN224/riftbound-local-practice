# Workspace guidance

- This repository publishes only the current Fuxuan local practice version under `community/`.
- `original/`, when present, is an ignored local archive of the retired Nakamabound project. Do not publish it or depend on its files, dependencies, or launchers.
- `community/upstream/` and `community/mobile/` are captured third-party artifacts. Do not hand-edit them; place adaptations in separate files.
- User values the community author's rule correctness, not just the UI. Do not substitute the old engine and call it a recovered Fuxuan implementation.
- The supplied APK contains a local rules host and AI. The website uses a remote rules service. Keep version and verification limits explicit.
- User watches matches while work runs: do not maximize, activate, or take over foreground apps without a new explicit request. Prefer background analysis and tests.
- Keep independent work in focused Git commits. The user authorized publishing the current Fuxuan version to `HHN224/riftbound-local-practice` on `main`. Do not push archived branches or old tags with full-workspace history.
- Read START-HERE.md and community/research/FINDINGS.md before continuing.
