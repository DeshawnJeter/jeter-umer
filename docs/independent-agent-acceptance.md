# Independent agent acceptance checks

These checks exercise each of the 15 application roles without asking a model to judge its own work. They use schema-valid faulty artifacts, trusted requirements, shipped runtime modules and an independent control replay. They run without paid API calls or real credentials.

Run `node scripts/test.js tests/agent-gameplay-acceptance.test.js`, or `npm test` for the complete regression suite. Browser checks in the full suite require a locally available supported browser.

| Role | Independent observation |
| --- | --- |
| Planner | A valid plan for the wrong collection objective is rejected. |
| Gameplay | Beginner timing is checked; nondefault speed changes actual movement. |
| Levels | A separate breadth-first search demonstrates that valid wall coordinates can trap the exit. |
| UI | The delivered interface updates visible health and MP values and meters when state changes. |
| Story | The introduction preserves an explicitly named place from the current saved human decision. |
| Audio | Requested music cannot default to disabled or zero volume; delivered audio schedules notes, honors separate music/SFX mute, pauses and disposes its nodes. |
| Combat | Actual battle actions change enemy HP, party HP and MP using nondefault settings; insufficient MP does not consume a turn. |
| Progression | Potions, healing, experience and level thresholds affect actual battle state; terminal actions cannot duplicate rewards. |
| Enemies | A real enemy waits through its windup, fires, and cancels a blocked shot. |
| Art | Explicit battle backdrop requests survive checking and select the delivered battle palette. |
| Implementation | Missing failure-state modules fail both review and assembly. |
| Integration | A valid-looking manifest cannot substitute a fabricated dependency hash. |
| QA | Self-declared passing evidence cannot hide an unreachable level. |
| VFX | The actual effect pool stays bounded during repeated events; reduced effects and disposal clear particles. |
| Coding | Holding an attack key is distinct from pressing it five times, even when the implementation passes its own win/loss replay. |

## Confirmed regressions and fixes

The initial 15-test run failed four cases: disabled requested music, an omitted saved village name, an ignored explicit battle backdrop, and the default coding example awarding repeated points while J remained held. All four were schema-valid. The fixes add deterministic intent checks, align worker/checker instructions, honor a current backdrop revision over the original prompt, and make the example count rising-edge presses. Its win replay now contains distinct presses and releases.

Two further tests cover intent precedence/negative controls and synthetic Claude checker responses that incorrectly return pass. Local story, art and audio findings still reject those responses. A coding mutant passes its own replay but fails the independent held-key case; the harness exhausts its bounded repair attempts without calling the model checker or accepting the artifact.

Validation on October 30, 2026: all 307 regression tests passed, including existing browser checks. A final focused rerun of all 17 new acceptance tests also passed after adding the mixed battle/overworld art clause case. The earlier focused run of these checks with audio, RPG, handoff and independent-acceptance regressions passed all 55 tests. Before the fixes, four of the initial 15 checks failed as described above.

## Limits

These are representative executable responsibility checks, not proof that every generated game meets every creative request. Place-name and backdrop extraction intentionally recognize narrow explicit English patterns; general natural-language interpretation still needs model and human review. The audio test observes synthesis scheduling and gains, not musical quality or audible output from speakers. UI and effects checks use lightweight DOM/scene doubles against the delivered modules. The existing regression suite supplies separate real-browser coverage. No paid live-model game generation was performed for this change. Previously built games retain their immutable output until rebuilt.
