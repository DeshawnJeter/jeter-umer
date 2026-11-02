# Game Workshop

A local hub-and-spoke game builder with a no-key demo and an opt-in OpenAI provider. A planner and five specialists propose structured game settings. Independent checkers validate each proposal. An orchestrator runs independent tasks in parallel, integrates accepted artifacts, and serves a playable Phaser game for human review. Choose star collector, maze escape, platform adventure, or survival arena.

## Run

Node.js 22 or later is required.

```sh
npm ci
npm start
```

Open http://127.0.0.1:3000. Create a game, answer the planner's difficulty question if necessary, then approve the checked plan before specialists begin. Select “Ask me for story direction” to exercise a free-text specialist question while independent tasks continue. Play the generated preview. Use arrow keys or WASD, collect stars, then reach the purple exit. Start audio with the Start button. Optional music uses Tone.js. Downloaded ZIPs include the game and engine files; extract and serve with a local HTTP server rather than opening HTML directly from disk.

```sh
npm test
npm run check
```

For real model workers/checkers, privately set a fresh `OPENAI_API_KEY` in the server environment and run `npm run start:openai`. See [docs/openai-provider.md](docs/openai-provider.md) for model overrides, limits and optional explicit environment-file loading. The dashboard clearly labels billed OpenAI mode. Normal tests strip real credentials and never make paid calls.

## What this version does

- Runs six specialist/checker pairs with isolated persisted artifacts, using scripted demo workers or separate OpenAI model calls.
- Routes tasks by role and runs ready specialists with a concurrency limit of three.
- Retries failed proposals, preserves checker evidence, and stops at a global step budget.
- Saves human difficulty answers, supports pause/resume/cancel, and restores interrupted runs as paused.
- Builds four supported game types with configurable difficulty, title, colors, story, audio, and optional music. Platformer uses gravity and jumping; survival uses chasing enemies, shields and a timer-based win; maze escape makes collectibles optional.
- Requires explicit human playtest attestations and approval of the exact build hash before completion.
- Loads master/shared instructions, separate role/checker prompts, validated agent profiles, and selected application skills.
- Saves separate worker/checker request audits, context sizes, instruction hashes, and tool-call names.
- Queues structured choice or free-text questions, combines equivalent requests, saves decisions, and resumes only affected roles.
- Requires human approval of the checked plan and invalidates stale results when requirements or instruction versions change.
- Provides a local dashboard, sandboxed preview, saved run history, and game ZIP downloads.

## Boundaries

**Demo mode is free of API calls. OpenAI mode uses real models for bounded game configuration and static review.** Neither mode executes arbitrary model-generated JavaScript. The reusable Phaser template supplies the game code. Demo workers use explicit settings; real workers receive the brief and relevant task context as untrusted data.

OpenAI checkers reason independently about supplied artifacts, then deterministic role checks still run. Integration checks are static. They do not claim to automatically play the game or judge creative quality. Human playtesting supplies the behavioral approval. Prompt files are loaded and audited; only real model workers interpret them. Tool allowlists constrain the harness interface, and the API provider exposes no file/shell tools. Trusted JavaScript worker modules are not OS-isolated.

Runtime state lives in ignored `.local/runs/`. The existing `.env/` directory stays ignored. Do not commit secrets. This server binds only to loopback and is a development tool without multi-user authentication. Do not expose it publicly.

Choose the game type explicitly in the creation form. Changing it through revision invalidates the plan, accepted role artifacts, build and approval. The selected type is supplied to every real worker/checker and preserved in config.json. Platform levels undergo conservative jump/support checks; other levels use flood-fill checks, with minimum evasion space for survival. These static checks do not prove the game is fun or that every physical route plays as intended. Test the selected controls and objective in the browser. Builds ship their own rules, and hashes cover every delivered file.

Choose Astral voyage, Moonlit forest or Neon city artwork. The UI agent supplies a checked palette and the selected theme. Original local canvas artwork provides animated explorers, drones, glowing pickups, portals, textured tiles, layered scenery and ambient motion. No image-generation service, external downloads or additional API charges are involved. This is procedural art, not a claim to generate arbitrary bespoke illustrations. ZIPs include the renderer, theme catalog, provenance manifest and MIT artwork license; all are covered by the build hash.

For isolated playtest sessions, set `GAME_BUILDER_RUNS_DIR` to a different local run directory and optionally set `PORT`. This keeps test builds separate from existing run history. These are trusted server environment settings, not agent-controlled values.

## Branches

See [docs/branch-plan.md](docs/branch-plan.md). Each feature branch starts from development and contains one scoped slice. The integration branch assembles dependencies for a runnable demo. Development remains unchanged until reviewed changes merge.

The prompt/human-loop update uses new scoped branches based on the working `codex/basic-integration` prerequisite, which already descends from development. `codex/prompt-loop-integration` assembles these new branches. See [docs/prompt-system.md](docs/prompt-system.md) for configuration and boundaries.

Phaser and Tone.js retain their original licenses in downloaded builds. Their libraries are free to use under their respective MIT terms. Live API usage and hosting have separate costs.
