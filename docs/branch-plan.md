# Feature branches

Every feature branch starts at the same `origin/development` base. Branches are reviewable slices, not individually runnable applications. Merge prerequisites before dependants, then update dependent branches from development before opening PRs.

1. `codex/foundation`: existing scaffold, package setup, shared contracts and limits.
2. `codex/agent-harness`: shared runner and isolated artifact persistence. Requires foundation.
3. `codex/planner-agent`: demo planner and separate checker. Requires foundation.
4. `codex/gameplay-agent`: demo gameplay specialist and checker. Requires foundation.
5. `codex/levels-agent`: level generator and reachability checker. Requires foundation.
6. `codex/ui-agent`: UI specialist and contrast checker. Requires foundation.
7. `codex/story-agent`: story specialist and checker. Requires foundation.
8. `codex/audio-agent`: audio specialist and checker. Requires foundation.
9. `codex/phaser-template`: playable game, Web Audio effects, optional Tone.js music. Requires foundation.
10. `codex/routing`: allowlisted specialist/checker dispatch. Requires specialist modules.
11. `codex/integration-validation`: game assembly, delivery hashes, static integrated checks. Requires contracts, level checker, template and dependencies.
12. `codex/orchestration`: state machine, parallel batches, human questions and final approval. Requires harness, routing, all specialists and integration.
13. `codex/dashboard-api`: loopback HTTP API, preview and ZIP delivery. Requires orchestration.
14. `codex/dashboard`: local browser control center. Requires dashboard API.
15. `codex/verification`: cross-feature tests and operating guide. Requires the assembled system.

`codex/basic-integration` assembles all these changes for testing. It does not change development. The demo uses deterministic scripts and declarative game configurations; no API key, AI reasoning, or arbitrary AI-generated code execution is included.
