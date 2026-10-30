# In-game HUD

New builds include a compact HTML HUD inside the Phaser play area. It uses the same live state as the external status cards. It does not simulate gameplay, store a second score, decrement a second timer, or make model requests. The existing accessible status panel remains available. The overlay has no live announcements or flashing effects, and its stats let pointer input pass through. Its Pause button calls the existing pause/settings flow.

## Resource selection

The UI agent still returns the existing closed `hud.layout` / `hud.stats` contract. Its validated stats and the game profile select the overlay. Worker/checker instructions describe the shared-state display and prohibit fabricated resources.

| Game | Overlay |
| --- | --- |
| Collector, maze, platformer | Stars and remaining time |
| Survival | HP, remaining time and healing-star count |
| RPG, front-view RPG, campaign, roguelike | HP, MP and cleared encounter count |
| Stealth | HP, detection and mission time |
| Run-and-gun | HP and stage |
| Jump shooter | HP and weapon energy |
| Metroidvania | HP and abilities |
| Custom | HP and score; timer and MP only when published by the game rules |

HP/MP zero values remain visible. Low health, empty MP and short remaining time receive a contrasting border/text treatment. The responsive overlay stays inside the canvas on narrow screens. Important game nodes should remain clear of its compact top inset (roughly 40 pixels); arbitrary custom scenes can still place objects behind that area, so visual review remains necessary.

## Custom rules

`inspect()` may now include these optional bounded pairs, initialized before Start and reset by a fresh game:

- `remaining` and `timeLimit`: finite seconds, `0 <= remaining <= timeLimit`, with `1 <= timeLimit <= 3600`.
- `mana` and `maxMana`: finite numbers, `0 <= mana <= maxMana <= 100`. A zero maximum hides MP.

Both members of each pair are required together. Invalid, incomplete, negative or nonfinite values fail worker snapshot validation. The values pass through the worker into the existing game state; HUD updates occur as each snapshot arrives. The default example publishes its actual countdown. Coding worker/checker instructions and API catalogs describe this contract.

Old custom rules remain valid without these fields. The HUD does not infer time or MP from objective text and does not show the framework's unused placeholder timer. Existing custom games with text-only countdowns need a code revision publishing these fields before their timer can appear in the overlay.

## Acceptance and saved versions

Current-build browser acceptance now requires an in-game HUD check. It independently compares the rendered values with actual HP, MP, score and time, and checks that the overlay is inside the canvas. Browser regressions exercise real battle actions, custom worker messages, pause/resume, restart and mobile layout. The previous HUD tests continue checking the external cards.

Existing immutable previews are not rewritten. Restore recognizes a verified historical build that predates the HUD module and tests its original external display. That exception is bound to the exact historical hash and first restore generation; any revised build requires the new overlay checks. A real-browser regression restores a historical presentation, verifies exact bytes, and confirms fresh gameplay checks without inventing overlay evidence or human approval.

Run `node scripts/test.js tests/in-game-hud.test.js tests/in-game-hud-browser.test.js tests/in-game-hud-restore.test.js` for targeted checks and `npm test` for the full suite. `node scripts/whole-game-tests.js` exercises every supported genre without paid API calls. Review screenshots are saved under ignored `.local/in-game-hud/`.

October 30, 2026 validation: all 326 regression tests passed with zero failures/skips using `node scripts/test.js --test-concurrency=4 'tests/*.test.js'`. The targeted HUD/whole-game acceptance run passed 13 tests; UI/code regressions passed 35; the dashboard, project workspace and imported-assets integration rerun passed all three tests. The initial full run exposed the missing workshop `/lifecycle.js` route after the shared UI module began importing it; the server now serves that exact public module. Desktop and 360-pixel viewport screenshots were visually reviewed. Validation made no paid model calls.
