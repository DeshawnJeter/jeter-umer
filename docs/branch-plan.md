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

## Prompt and human-loop update

These new branches share the tested `codex/basic-integration` prerequisite, which descends from development. Earlier branches and development remain unchanged. Their diffs against that prerequisite contain only their scoped changes.

1. `codex/master-prompts`: orchestrator and shared instructions.
2. `codex/agent-profiles`: per-role/checker configuration and role prompt contracts.
3. `codex/application-skills`: project-owned skill library and allowlisted loader.
4. `codex/human-question-contracts`: validated question/answer formats and optional story-context setting.
5. `codex/context-harness`: task contracts, complete instruction envelopes, narrow tool interfaces, context limits and audits. Requires 1–4.
6. `codex/human-context-loop`: task blocking, shared decisions, plan approval, instruction provenance and example specialist questions. Requires 1–5.
7. `codex/human-review-dashboard`: plan review and choice/free-text question forms. Requires 6.
8. `codex/prompt-loop-verification`: updated regressions and operating documentation. Requires the assembled changes.

`codex/prompt-loop-integration` combines the new changes for running and review. None of these branches enables paid API calls.

## OpenAI provider

`codex/openai-provider` adds optional real model workers/checkers, strict structured outputs, deterministic verification, usage/cancellation limits, provider-aware dashboard labels and mocked tests. It is based on the tested local combination of PR #10 (prompt loop), #11 (adversarial fixes) and #12 (red-team suite). Development remains unchanged. See openai-provider.md for setup. Tests and the local red-team suite never make paid calls.
