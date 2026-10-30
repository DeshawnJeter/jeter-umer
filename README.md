# Game Workshop

Current indie workflow, branch dependencies, and limitations: [Indie workflow](docs/indie-workflow.md). Model policy: [Role models](docs/role-model-policy.md). Earlier feature descriptions below include the project’s incremental history.

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

**Demo mode is free of API calls. OpenAI mode uses real models for bounded game configuration and static review.** Template styles use trusted Phaser code. Custom mode accepts bounded model-written JavaScript rules, parses them without server execution, and runs them only in isolated browser workers. It does not provide unrestricted project or host access. Demo workers use explicit settings; real workers receive the brief and relevant task context as untrusted data.

OpenAI checkers reason independently about supplied artifacts, then deterministic role checks still run. Static integration and isolated browser checks are separate. Browser QA is enabled by default, but smoke checks do not establish complete mechanic coverage or creative quality. Human playtesting supplies the behavioral approval. Prompt files are loaded and audited; only real model workers interpret them. Tool allowlists constrain the harness interface, and the API provider exposes no file/shell tools. Trusted JavaScript worker modules are not OS-isolated.

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

See [docs/branch-plan.md](docs/branch-plan.md). Feature branches contain scoped commits and may depend on earlier unmerged branches; inspect the documented dependency order. The integration branch assembles dependencies for a runnable demo. Development remains unchanged until reviewed changes merge.

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



## Conditional specialists and project memory

The existing planner acts as game designer; gameplay, levels, UI, story and audio keep their original jobs. Seven new independently checked jobs are available:

| Specialist | Active for | Checked output used by the game |
| --- | --- | --- |
| Combat | Party RPG / front-view battles | Attack/spell power, spell MP cost and enemy damage |
| Inventory/progression | Party RPG / front-view battles | Shared potion count/healing, XP rewards and one reachable level-up |
| Enemy behavior | Stealth and scrolling combat/exploration | Patrol/chase speed, detection range/rate and projectile interval |
| Art/animation | All styles | Bounded original scenery particle counts and animation timing; UI retains theme/colors/HUD |
| Gameplay implementation | All styles | Approved runtime and capability modules compiled into data-only assembly.js |
| Integration | All styles | Hash manifest of current checked contributions |
| QA | All styles | Actual trusted level, HUD, control, combat and checkpoint rule probes, plus independent static/model review |

Each agent has its own profile, worker/checker instructions, skills, contract, tools and generation workspace. This remains a controlled module-assembly system: the implementation agent cannot execute arbitrary generated JavaScript or invent unsupported engine features. QA does not automatically drive a browser or listen to music; it reports rules-and-static scope and explicitly leaves browser testing and final approval to the human.

Routing follows a dependency graph. Combat, inventory and enemies feed gameplay; gameplay feeds level design; art/combat/inventory feed UI. Implementation waits for checked contributions, integration checks their hash manifest, and QA runs after integration. Independent ready jobs remain parallel, at concurrency three. Inapplicable roles are omitted. With VFX enabled there are 11 pairs for the original styles, 12 for stealth/shooters/exploration, and 13 for RPG/battles. Prompt-only extraction adds a separate two-call pair. Model call/token limits remain unchanged and are never automatically raised; the plan review shows minimum request counts and configured limits. An insufficient remaining call allowance stops before launching the remaining pairs. Repairs and revisions cost additional calls. The bounded orchestration step limit is now 80 to accommodate the larger graph and revisions; concurrency and context limits are unchanged.

Each run is its own isolated game project. Memory is versioned inside its atomically saved state.json record in the ignored run directory. It survives restarts and revisions, with specification/approval references, provenance-stamped human decisions, accepted artifact hashes, dependency hashes, per-agent checkpoints and ownership, handoff summaries with audit references, invalidations and test evidence. Existing request/checker files remain the detailed working record. There is no vector database or automatic cross-game memory sharing.

Only the orchestrator promotes checked contributions into accepted memory. Changes invalidate the transitive dependents and test records; stale in-flight work is discarded. Workers receive only their relevant decisions, checked dependencies, checkpoint and previous handoff. read_project_memory is a read-only local harness tool with allowlisted sections; it cannot read paths, choose another project, mutate state or approve anything. Real models receive the same focused memory in their structured input; no general file/shell/network tool access is granted. Context remains bounded and fails visibly rather than silently cutting instructions or requirements. A checkpoint restarts an unfinished worker/checker task safely; it does not resume an LLM's hidden state or accept a partial unreviewed patch.

The dashboard shows applicable agent/checker cards and an expandable project-memory history. Full memory records are available through the existing loopback-only server's run memory endpoint. Human questions remain deduplicated, decisions retain human provenance, and checked-plan and exact-build final approvals remain separate.

These branches follow RPG fixes PR #31 and target development in this order: project-memory, specialist-routing, combat-specialist, inventory-progression-specialist, enemy-behavior-specialist, art-animation-specialist, gameplay-implementation-specialist, integration-specialist, qa-specialist, memory-agent-dashboard (each prefixed codex/). Development remains at the initial scaffold until its prerequisite pull requests are merged; preserve stack ancestry or rebase after squashing.

Validation for this stack: 136 automated tests passed, followed by 36 focused tests after final memory admission/summary refinements; JavaScript syntax checks passed. All 11 local adversarial probes passed. Five live-model adversarial cases and one human quality case remain untested in this run. Demo builds and simulated OpenAI worker/checker requests were used; no new paid model calls were made for these changes.

## Reactive stealth and explicit failure states

Stealth guards now use patrol → investigate → chase → search → patrol states. Sightings trigger an immediate investigation; pursuit retains the last known position for four seconds even when sight is lost or the alert meter falls below 100%. Guards search before recovering. Patrol spawns and both endpoints are selected from the player-reachable component, with clearance-sized collision bodies and center-to-center paths. State labels, a guard-status readout and matching vision ranges make reactions observable. Contact can deplete health, and the mission countdown is visible.

All ten game styles share a lifecycle contract. Collector/maze/platformer lose on timeout; survival loses on depleted health and wins by surviving its timer; party games lose when every member is defeated; stealth loses on health or timeout; scrolling combat/exploration lose on depleted health. Turn-based combat intentionally has no idle timeout. Failure reasons and restart instructions are visible. The advanced runtime enforces health/time loss centrally, and legacy games freeze physics on terminal states and resume correctly on restart. Exported lifecycle.json and the required failure-state assembly capability are covered by the build hash.

The previous QA scope did not exercise guard reactions or all failure paths. Enemy checkers and QA now execute shared guard-state probes (investigation, latched pursuit, search/recovery and occlusion), patrol reachability and per-style failure probes, including party defeat. Stealth final acceptance additionally requires the enemyReactions human playtest checkbox; both UI and API enforce the genre-specific checklist. Automated rules checks still do not claim an automatic browser playthrough.

Validation: 141 automated tests and syntax checks passed, including actual exported shooter damage handlers for run-and-gun, jump-and-shoot and exploration. Browser observations confirmed stealth investigation/chase/search and capture loss, frozen movement after defeat, maze timeout loss, total party defeat, and restart resets. Test fixtures used demo mode without paid model calls, and no final human game approvals were submitted. Existing exported builds are immutable: rebuild a game to receive these fixes. This branch follows specialist/memory dashboard PR #41 and targets development.

## Expanded enemies, VFX and automatic browser acceptance

Enemy settings now select mixed patrollers/sentries/rushers, an attack wind-up of 500–1000 ms, cooldown of 1–2.5 seconds and a low-health retreat threshold. The trusted state machines provide idle, patrol, investigation, pursuit, attack, retreat and stuck-recovery behavior where applicable. Stealth sentries scan while idle and guards announce melee attacks before damage. Scrolling games use patrollers, stationary sentries and melee rushers; bosses enter a second phase below half health with faster bounded cooldowns and spread attacks. Projectiles aim at the position captured when the warning began, so the player can dodge; losing sight cancels the attack. Enemy spawn points require safe support. Checkers execute timing, cooldown, occlusion and recovery probes.

A separate VFX worker/checker pair is active for each style. It owns bounded effect settings, not HP, MP, inventory, enemy decisions or warning labels. An immutable gameplay-event bus carries damage, spell, shot, pickup, warning and defeat/victory notifications. The renderer provides impact flashes, spell/defeat particles, projectile-following trails and camera shake. It caps the owned pool at 96 particles, burst size at 12, emission at 24 particles/second, shake at 0.006 and shake frequency at twice/second; defaults are gentler. Effects are reused/disposed on restart and pause with the scene. The event history is capped at 64 records; listener failures cannot stop combat.

Pause/settings includes Reduced effects. It disables optional impact effects, trails and camera shake while preserving gameplay warning labels. The OS reduced-motion preference supplies the initial default. Version 1/2 saved controls/audio migrate to version 3 without losing bindings or gains. The fixed preference bridge remains limited to its validated record.

Automatic browser QA is now on by default. Install dependencies with npm ci; Windows uses the installed Microsoft Edge browser. Other systems need Playwright Chromium (npx playwright install chromium). Missing browser setup is checked before paid model work. GAME_BUILDER_BROWSER_QA=off explicitly selects manual-only browser acceptance; it is never silently treated as an automatic pass. Existing API call/token limits are unchanged: larger real-model teams can require an explicitly configured higher allowance (RPG needs at least 26 calls, or 28 with prompt extraction, before repairs). The plan displays minimum counts.

After a hashed build is produced, the system launches one isolated headless browser at a time against a temporary loopback-only asset server. It uses normal keyboard/button actions and a controlled clock, not direct gameplay-state mutation. Network requests outside that build origin are blocked and API/credential environment variables are excluded from the browser process. Checks cover boot, pause freeze, genre-specific reachable defeat, terminal freeze, resource reset, VFX caps and reduced-effects isolation; applicable games also check stealth reactions, MP spending and moving projectile trails/weapon energy. Reports are bound to the build hash, screenshots are kept outside the build, and changed bytes or failed checks block readiness/final approval. Failed builds can be explicitly revised with the observed failure evidence in context. Per-case execution is bounded at 60 seconds; browser jobs are serialized.

This is a critical-path browser smoke gate, not a claim of complete playthroughs, beatability for every generated map, musical listening or creative quality. Those remain human checks. Ordinary npm test strips API credentials and disables real browser launches. npm run test:browser exercises every style using no-cost demo fixtures; pass style IDs to select a subset. Reports are stored under ignored .local/browser-qa/latest.json and each run's browser-checks directory. Model QA remains separate rules/static evidence; browser evidence is recorded by the trusted runner.

Agent contract definitions now contribute to the system manifest hash. A changed field/range invalidates accepted memory and plan approvals even if prompt text stays the same.

Validation: 149 automated tests and syntax checks passed. Headless browser checks reached review across all ten styles; final combat checks additionally exercise moving trails, weapon energy and reduced effects. No paid API calls or final human approvals were made. The changes are separated into enemy-state-behaviors, enemy-archetypes-boss-phases, enemy-behavior-qa, gameplay-events, vfx-specialist, reduced-effects-settings, browser-qa-gate, projectile-vfx-trails, agent-contract-versioning and enemy-vfx-integration (all prefixed codex/), stacked after PR #42 and targeting development.
