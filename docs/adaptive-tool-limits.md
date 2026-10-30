# Adaptive coding-tool limits

The coding worker receives a deterministic allowance from the task context. The model cannot declare its own complexity or increase its allowance through its response or tool arguments.

| Task context | Edit/test actions | Separate read calls |
| --- | --- | --- |
| Existing source, no repair findings or feature request | Up to 4 | Up to 4 |
| New mechanic or version-based feature change | Up to 6 | Up to 4 |
| Existing source with repair findings or unresolved feedback | 6 initially; up to 8 after progress | Up to 4 |

Component inspection, source reads and source searches share the read allowance. Patches and rule checks consume the action allowance. Thus the maximum is 8 total tool calls for a small change, 10 for a new mechanic or feature, and 12 for an extended repair. These are ceilings, not targets. The worker may submit its complete candidate immediately without calling tools.

The last action slot is reserved for a rule check: an edit cannot consume it, even if checks were already run earlier. Reads cannot exhaust the editing/testing allowance. The existing run call and token budgets still apply to every model request, including tool continuations and final submission, and can stop work before a remaining tool slot is used. No budgets are automatically increased.

## Progress and stopping

Only trusted tool results count as progress:

- A syntactically accepted patch changes the actual owned source to a hash not already seen during the attempt.
- The number of failing checks falls for the same serialized test suite. Changing or removing tests does not earn progress.

At the initial repair boundary, current progress can earn two extra action slots, once, up to eight. Earlier progress followed by no-op/cyclic edits cannot earn this extension. A successful patch demonstrates an accepted source change, not proof that the requested behavior works; runtime checks and the independent checker remain required.

Two repeated identical failures stop tool use. Intervening source edits do not erase repeated failed-test evidence. A rule check reporting success must include nonempty, consistent test evidence before it can trigger early finalization.

Passing tool checks ends tool use and locks the final submission to that exact owned source. Hitting an allowance or repeated-failure stop permits a complete candidate for independent verification or a blocking human question if context is missing. It never marks the game finished. An empty or unfinished owned file is not forced into the final response merely because a tool allowance ended.

The existing three task attempts and up to two protocol repairs remain unchanged. Tool limits apply per worker attempt; saved run call/token counters remain cumulative across retries and restarts.

## Tracking and evidence

The dashboard displays model-requested read, edit and test counts separately. Internal file reads used to verify source hashes are not model tool calls. Counts, progress signals, chosen allowance and stop reasons are saved in the request audit and run state. Tool arguments and source text are not added to these counters.

Regression coverage includes native Claude continuations beyond four total tools, separate read limits, reserved validation slots, progress-gated extension, unchanged/cyclic source, incomparable or incomplete tests, repeated failures, finalization without a checked file, persistence and unchanged global budgets. The normal code execution, independent checker and human approval gates remain in place.

Validation: the full 290-test regression suite passed. After the final test-coverage comparison refinement, 37 focused tests passed; syntax checks passed. A fresh real Sonnet/Haiku lantern build reached review in 13 generation requests with passing browser QA. That live fixture did not use coding tools; the multi-tool path and conditional extension were exercised with native Claude protocol fixtures and trusted synthetic tool results. The fixture's plan approval came from a test driver, not a human playtester.

This branch builds on PR #99 and its unmerged prerequisites and targets development.
