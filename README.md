# Game Workshop

A local hub-and-spoke game builder with a no-key demo and an opt-in OpenAI provider. A planner and five specialists propose structured game settings. Independent checkers validate each proposal. An orchestrator runs independent tasks in parallel, integrates accepted artifacts, and serves a playable Phaser game for human review. Choose from ten game styles, including six small RPG, stealth, battle, shooter and exploration templates.

## Run

Node.js 22 or later is required.

```sh
npm ci
npm start
```

Open http://127.0.0.1:3000. Choose a game type, art theme, music style and brief. Answer the planner's difficulty question if necessary, then approve the checked plan before specialists begin. Select “Ask me for story direction” to exercise a free-text specialist question while independent tasks continue. Follow the generated preview's displayed controls and objective: the platformer adds jumping, and survival wins when time expires. Start audio with the Start button. Downloaded ZIPs include the game and engine files; extract and serve with a local HTTP server rather than opening HTML directly from disk.

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
- Builds ten supported game types with configurable difficulty, title, colors, story, audio, and optional music. Platformer uses gravity and jumping; survival uses chasing enemies, shields and a timer-based win; maze escape makes collectibles optional.
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

Choose the game type in the creation form or enable prompt-only settings. Changing it through revision invalidates the plan, accepted role artifacts, build and approval. The selected type is supplied to every real worker/checker and preserved in config.json. Platform levels undergo conservative jump/support checks; other levels use flood-fill checks, with minimum evasion space for survival. These static checks do not prove the game is fun or that every physical route plays as intended. Test the selected controls and objective in the browser. Builds ship their own rules, and hashes cover every delivered file.

Choose Astral voyage, Moonlit forest or Neon city artwork. The UI agent supplies a checked palette and the selected theme. Original local canvas artwork provides animated explorers, drones, glowing pickups, portals, textured tiles, layered scenery and ambient motion. No image-generation service, external downloads or additional API charges are involved. This is procedural art, not a claim to generate arbitrary bespoke illustrations. ZIPs include the renderer, theme catalog, provenance manifest and MIT artwork license; all are covered by the build hash.

For isolated playtest sessions, set `GAME_BUILDER_RUNS_DIR` to a different local run directory and optionally set `PORT`. This keeps test builds separate from existing run history. These are trusted server environment settings, not agent-controlled values.

The audio specialist can compose calm, adventure or arcade scores as validated musical data: tempo, instrument waveform, melody notes, bass notes and a rhythm toggle. Its independent model checker and deterministic checker review that data. Tone.js schedules separate melody, bass and percussion layers through a limited, low-volume mix. Audio starts after a gesture, stops at round end, pauses when hidden, and reuses/disposes its owned resources rather than adding loops on every restart. Games include music-score.json and the playback code. No recorded songs, vocal generation or remote samples are produced. Human listening is still required; automatic checks establish safe ranges and scheduling behavior, not musical quality.

Expanded music adds chiptune, lo-fi, mysterious, cinematic and dance, for eight styles total. Choose a lead instrument or let the agent choose: classic synth, piano-like keys, FM bells, plucked synth, warm pad, organ-like synth or FM lead. These seven instruments use bounded synthesized presets, not sampled acoustic recordings. Styles vary in tempo range, phrasing, melodic pacing and rhythm; explicit instrument choices are preserved by the worker and checker. Calm and mysterious music do not use drums. Both creation and revision menus load their choices from the same server catalog used by validation and model schemas. Existing exported scores without an instrument remain playable through the original synth. New games/revisions export the concrete instrument identifier with their score. Structured selectors take precedence over conflicting music instructions in free text; malformed model reports still stop safely rather than bypassing validation.

The expanded styles/instruments branch depends on composed music (#18) and its prerequisites, and also targets development. Merge that stack first or rebase this branch onto the updated development branch.

New game builds include a checked, genre-specific player HUD. The UI specialist chooses a cards or compact layout and the order of three supported stats. Survival shows actual health/shields, the survival countdown and healing stars. Collector/platformer show star progress, time and the portal requirement; maze labels its stars as optional bonuses. The party RPG and front-view battle templates show real party HP and MP; the jump-and-shoot template shows weapon energy. Stealth shows detection, and exploration shows acquired abilities. The role checker and integration checks reject unsupported or missing metrics. Old exported configurations without HUD metadata use a safe genre-specific fallback.

Pause/settings (or Escape) freezes the Phaser scene, including physics, enemies, animations and the timer. The menu remaps keyboard movement/jump actions, rejects duplicate keys, reserves Escape, resets controls, and adjusts master, music and sound-effect levels with independent channel mutes. Restart returns to the ready state. Backgrounding the game pauses it until the player resumes. Touch movement and jumping remain available. Preferences are versioned and saved per browser/device, shared across games from the same origin. The opaque website preview uses a source-checked message bridge that reads/writes only a fixed validated preference record; it does not grant games general storage access or weaken iframe isolation. If storage is unavailable, the game keeps session preferences and says so. Exports include the complete menu and settings code. Downloaded games should be served over HTTP, as before.

The HUD/pause-menu branch is stacked on music styles/instruments (#19), also targeting development. Existing saved build bytes and approvals are not rewritten: create a new game or revision to receive these features. Automated checks and model reviews are separate from the human playtest approval.

Real-model generation now places summary/report bounds and consistent checker verdict shapes in the strict output schema. Completed malformed responses receive up to two format-repair requests against the unchanged task/artifact. Each request counts against the existing call/token budgets and gets a safe audit/activity entry. Invalid output is never silently accepted or echoed into repair instructions. Refusals, API errors, incomplete responses and exhausted budgets still stop visibly. See [OpenAI provider](docs/openai-provider.md) for `OPENAI_MAX_RESPONSE_REPAIRS` (0–2, default 2), audit details and limitations. This branch is stacked on HUD/pause-menu PR #20 and targets development; new runs use the updated provider policy after restarting the app.

Enable **Get settings from my prompt** to describe the title, game type, art, difficulty and music in one prompt. Manual fields are hidden/disabled and are not sent or applied in this mode. A planner resolver and separate checker propose supported settings, disclose assumptions and unsupported requests, then the ordinary checked-plan review lets you edit any setting before approving. Unsupported omissions require explicit acknowledgement in the UI and API. Disabling the option restores manual control, whose values keep priority. Demo resolution recognizes labels/keywords; real mode interprets natural language with the configured planner models. Both use the current game catalog, three art themes and the music catalog. See [prompt-only workflow](docs/prompt-only-workflow.md). The branch is stacked on response-recovery PR #21 and targets development.

The feature pull requests are stacked for review, all targeting development: merge the existing OpenAI provider (#13), validation fixes (#14), game types (#15), artwork (#16), Windows state recovery (#17), then composed music. Each new branch contains its feature commit on the preceding tested prerequisite. Development remains unchanged until those requests are reviewed and merged.

Use merge commits to preserve this stack’s ancestry. If you squash a prerequisite instead, rebase the remaining branches onto the updated development branch before merging them; this avoids duplicate prerequisite diffs and add/add conflicts.

## Branches

See [docs/branch-plan.md](docs/branch-plan.md). Each feature branch starts from development and contains one scoped slice. The integration branch assembles dependencies for a runnable demo. Development remains unchanged until reviewed changes merge.

The prompt/human-loop update uses new scoped branches based on the working `codex/basic-integration` prerequisite, which already descends from development. `codex/prompt-loop-integration` assembles these new branches. See [docs/prompt-system.md](docs/prompt-system.md) for configuration and boundaries.

Phaser and Tone.js retain their original licenses in downloaded builds. Their libraries are free to use under their respective MIT terms. Live API usage and hosting have separate costs.

## Expanded playable game styles

The agents configure bounded Phaser templates. They do not write arbitrary new game engines or recreate complete commercial games. Manual selection and prompt-only extraction use the same catalog, schemas, checker rules and HUD profiles.

| Style | Playable starter scope |
| --- | --- |
| Party RPG | Grid exploration, two party members, encounters, targets, attacks/guard, MP spells, three shared potions and one level-up. |
| Front-view battles | Three enemy-facing encounters with the same party/resource system and battle menus. No first-person exploration. |
| Stealth | Patrols, wall-blocked vision cones, detection, quiet movement, hiding cover, alarms, pursuit, intel and extraction. |
| Run-and-gun | Three scrolling sectors, movement/jump, aimed projectiles, enemy groups and a final boss. |
| Jump-and-shoot | Three scrolling stages, normal/powered shots, weapon energy, pickups, bosses and boss gates. |
| Ability-gated exploration | Three connected rooms, combat, double jump/dash unlocks and gates, visited-room map, relic objective and checkpoint save codes. |

Use J to attack, K for the style's ability/spell, and E for party potions. Battle buttons support target selection and guard. The pause menu shows applicable controls; inactive style bindings remain editable under the shared-controls disclosure. Existing movement preferences migrate without losing remaps. All games retain pause, sound/music settings, touch controls and restart.

Exploration checkpoint codes accept only a bounded version/room/ability record. They cannot load code, paths or arbitrary game state. Direct HTTP previews can store checkpoints locally. Opaque sandbox previews use a portable copy/paste code; the preference bridge is not expanded to arbitrary storage. Continue becomes available on defeat and restores health and the last checkpoint.

Examples: “Game type: rpg; Title: Lantern Party; Art: forest; Difficulty: beginner; Music: adventure.” Or “Make a stealth mission called Quiet Signal with neon art, beginner difficulty and mysterious music.” Review extracted settings and any unsupported requests before approving the plan. Hybrids, crafting, multiplayer, arbitrary inventory/quests and unlimited worlds remain outside these starter templates.

Validation: 124 automated tests passed; the expanded regression suite checks shipped runtime modules, catalog/schema/HUD consistency and unsupported hybrids. Six fresh prompt-only OpenAI builds passed all worker/checker stages (84 model calls total), reaching human review. Browser spot checks covered party combat through victory, RPG encounters, stealth controls, shooter attacks, HP/energy, exploration ability pickup, invalid checkpoint codes and defeat recovery. These checks do not replace a complete human playthrough, musical review or difficulty balancing for each generated level. No final human approval was submitted for test builds.

The new feature branches are stacked after prompt-only PR #22, all targeting development, in this merge order: advanced-game-foundation → turn-based-rpg → front-view-battles → stealth-games → scrolling-shooter → jump-shooter → metroidvania-games → expanded-game-validation (all prefixed codex/). Preserve ancestry with merge commits, or rebase downstream branches if prerequisites are squashed. Existing exported builds and their approvals remain unchanged; create a fresh game to receive the new runtimes.

RPG playtest fixes: battle button hints now follow saved attack/spell/potion key bindings and refresh immediately after remapping or resetting controls. Rejected actions do not play a successful action sound, spend resources or advance a turn. Attack/spell targets must be integer enemy indices, so malformed or prototype-key targets are rejected. Browser testing completed all three encounters and the final portal, potion depletion/full-health rejection, zero-MP rejection, targeting, level-up, party defeat and restart. A fresh real-model build passed all six agent/checker pairs; the full regression suite passes 127 tests. The fixes branch is stacked on expanded-game-validation PR #30. Human approval remains separate from these tests.


