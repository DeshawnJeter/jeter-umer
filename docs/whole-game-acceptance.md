# Whole-game acceptance

Agent approval alone does not finish a game. With browser QA enabled (the default), the orchestrator now requires a current-build browser report containing every required check for that game style. Empty reports, missing checks, failed/duplicate entries, stale build hashes and unexecuted browser claims block delivery and approval. Saving a previously validated delivery and restoring an older version use the same gate. Restore also checks that the tested historical bytes did not change.

## What runs automatically

Every supported style checks boot, Start without extra input, visible HUD resource values, pause freeze, changing audio settings, control remapping/reset, separate music/SFX playback gains, restart and script errors. Tests use normal buttons, keyboard input and setting controls in a fresh browser context. They do not move players or grant resources through a privileged testing API. Playback scheduling/gains are evidence of wiring, not proof of music quality or sound from speakers.

| Styles | Additional observations | Automatic victory |
| --- | --- | --- |
| Collector, maze | Reach the objective, observe victory and defeat, check terminal freeze | Yes |
| RPG, front-view battles | Potion use/healing, configured spell cost, live HP/MP HUD, paused battle actions, all encounters, battle transitions and resource preservation | Yes |
| Campaign, roguelike | The RPG checks plus every room exit and persistent party resources | Yes |
| Platformer | Actual movement/jump, timeout loss, restart | Human playthrough required |
| Survival | Enemy-caused loss, terminal freeze, restart | Human playthrough required |
| Stealth | Patrol movement, guard reaction, damage and defeat | Human playthrough required |
| Run-and-gun, jump shooter, metroidvania | Moving projectiles, applicable weapon-energy cost, defeat and restart | Human playthrough required |
| Custom rules | Delivered preview/HUD/settings plus isolated worker win/loss replays and every saved independent project acceptance case | Delivered UI win/loss playthrough required |

The existing static checks, role checkers and deterministic gameplay rules remain in place. Independent custom acceptance cases are forwarded into the browser gate, including when restoring versions. A successful isolated worker replay is never labeled a delivered-game full playthrough.

`fullPlaythrough` is derived from executed browser victory evidence plus the complete required check set. It describes one bounded route through the objective, not exhaustive exploration or proof of arbitrary prompt semantics. Missing automatic victory coverage is shown explicitly in the workshop. It does not prevent opening a preview for human testing. Final completion still requires a human to attest to victory, requested mechanics, defeat/restart, pause/settings, audio and presentation for this exact build. There is no automatic human approval. Explicit manual-only browser mode remains available and reports its missing browser evidence.

## Confirmed runtime fix

The new collector/maze victory replay exposed pending Arcade Physics body deltas at an overlap-triggered victory. The reported player position moved on the following terminal frame. Ending the game now resets pending body deltas and captures final player/enemy positions immediately; advanced runtimes also capture the current player position on ending.

## Verification and reproduction

- `node scripts/test.js tests/whole-game-acceptance.test.js tests/whole-game-browser.test.js tests/browser-gate.test.js tests/version-delivery-recovery.test.js tests/project-restore.test.js`
- `node scripts/whole-game-tests.js` builds and tests all supported styles without agents, credentials or paid requests. Pass genre names to select a subset. Reports/screenshots go to a new timestamped directory under `.local/whole-game-qa/`.
- `node scripts/browser-tests.js collector` exercises the demo-agent orchestration and browser gate together.
- `npm test` runs the complete regression suite.

Regression tests deliberately break visible collection values and audio settings wiring while leaving the JavaScript valid. The delivered-browser checks reject both. Separate gate tests verify that incomplete reports cannot deliver, approve, retry saving or restore a build. Scene/DOM doubles are not used by these browser regressions. Historical immutable games require rebuilding for the runtime fix; restored versions retain their historical bytes and must pass fresh checks.

October 30, 2026 validation: all 317 regression tests passed with no failures or skips. All 13 genre fixtures passed their required browser checks across the broad run and final collector/maze/custom reruns after the fix. Six styles demonstrated automatic victory; seven retained explicit manual playthrough requirements. An earlier focused run passed 15 gate, browser, restore and storage tests. No paid model requests or real credentials were used.
