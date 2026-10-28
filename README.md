# Game Workshop

A local, no-key demonstration of a hub-and-spoke game builder. A planner and five specialists propose structured game settings. Independent checkers validate each proposal. An orchestrator runs independent tasks in parallel, integrates accepted artifacts, and serves a playable Phaser star-collector game for human review.

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

## What this version does

- Runs six deterministic specialist/checker pairs with isolated persisted artifacts.
- Routes tasks by role and runs ready specialists with a concurrency limit of three.
- Retries failed proposals, preserves checker evidence, and stops at a global step budget.
- Saves human difficulty answers, supports pause/resume/cancel, and restores interrupted runs as paused.
- Builds one supported game template with configurable difficulty, title, colors, story, audio, and optional music.
- Requires explicit human playtest attestations and approval of the exact build hash before completion.
- Loads master/shared instructions, separate role/checker prompts, validated agent profiles, and selected application skills.
- Saves separate worker/checker request audits, context sizes, instruction hashes, and tool-call names.
- Queues structured choice or free-text questions, combines equivalent requests, saves decisions, and resumes only affected roles.
- Requires human approval of the checked plan and invalidates stale results when requirements or instruction versions change.
- Provides a local dashboard, sandboxed preview, saved run history, and game ZIP downloads.

## Boundaries

**This is scripted demo mode, not an AI coding system yet.** It never calls OpenAI, reads an API key, or generates arbitrary JavaScript. The free-text brief is retained as context; the scripted agents use the explicit title, difficulty, and music settings. The reusable Phaser template supplies the game code.

Specialist checkers perform contract and domain checks. Integration checks are static. They do not claim to automatically play the game or judge creative quality. Human playtesting supplies the behavioral approval. A later model adapter can replace workers while retaining task contracts, independent checkers, and limits. Prompt files are loaded and audited, but scripted workers do not interpret natural-language instructions. Tool allowlists constrain the harness interface; trusted JavaScript worker modules are not OS-isolated.

Runtime state lives in ignored `.local/runs/`. The existing `.env/` directory stays ignored. Do not commit secrets. This server binds only to loopback and is a development tool without multi-user authentication. Do not expose it publicly.

## Branches

See [docs/branch-plan.md](docs/branch-plan.md). Each feature branch starts from development and contains one scoped slice. The integration branch assembles dependencies for a runnable demo. Development remains unchanged until reviewed changes merge.

The prompt/human-loop update uses new scoped branches based on the working `codex/basic-integration` prerequisite, which already descends from development. `codex/prompt-loop-integration` assembles these new branches. See [docs/prompt-system.md](docs/prompt-system.md) for configuration and boundaries.

Phaser and Tone.js retain their original licenses in downloaded builds. Their libraries are free to use under their respective MIT terms. AI services and hosting, if added later, have separate costs.
