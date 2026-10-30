# Claude loop audit — October 30, 2026

The current Claude-only loop passed 281 automated regression tests and one fresh live prompt-only custom-game build. No production runtime changes were needed for the failures exercised in this audit. A coverage gap was fixed: the broad handoff matrix now uses native Anthropic messages instead of the historical provider fixture.

## Agent and checker failures

- All 15 roles reject malformed native Claude worker artifacts. Failed requests still account for usage, and a zero-repair test policy stops after exactly one request.
- All 15 native Claude checkers can return an actual failing review without a protocol retry or a false pass.
- The harness rejects malformed artifacts before consulting a checker. Independent checker rejection exhausts only the bounded three attempts and produces no accepted contribution. Coding uses valid trusted source for this rejection fixture; its empty configuration default is not a valid generated implementation.
- Existing regressions cover refusal, truncation, HTTP failures, token and call exhaustion, cancellation, tool argument/file boundaries, false evidence and approval requirements. These fault cases use controlled synthetic responses; they do not spend API credits provoking service failures.

## Handoffs

For all 13 registered game types, every required worker/checker pair runs through the real Claude request serializer, schema decoder and deterministic checker using synthetic native API responses. The tests inspect the actual serialized messages for:

- Correct per-role model choice and provider identity.
- Dependency hashes matching the independently accepted upstream artifacts.
- The complete source prompt and known story decision surviving the handoff.
- Approved acceptance criteria surviving focused context projection, except the deliberately scoped audio review, which receives the source prompt and checked-plan reference.

Additional faults reject changed memory payloads, revoked upstream approval, corrupt ancestors, dependency cycles, tampered saved handoffs after restart and contributions completed after their dependencies change.

## Live end-to-end result

The isolated `Claude Lantern Test` build used real Sonnet 5.5 and Haiku 5.5 resolver/agent/checker calls. It reached `awaiting_review` in 12 generation requests and approximately 60 seconds with passing rules execution and browser QA. The full regression suite finished before this live run began. Its fixture plan was approved by an explicitly identified test driver, not by a human playtester.

Every saved live handoff was checked against the current accepted artifact hash, its upstream hashes and the artifact actually given to its independent checker. The required planner, UI, story, audio and coding contributions all had Anthropic provenance and passing independent reports.

Six additional acceptance tests were defined independently of the model's own replay cases and executed against the actual generated rules:

| Test input | Expected result |
| --- | --- |
| Start with no action | Health 4, score 0, playing |
| Hold attack/J for ten frames | Score 1, health 4, still playing |
| Two distinct presses separated by release | Score 2, still playing |
| Three distinct presses separated by releases | Score 3, won |
| No action for 101 frames of 0.1 seconds | Health 0, score 0, lost |
| Continue movement/attack after winning | Score 3, health 4, still won |

All six passed. The rules executor also passed Start without input, its win/loss replays, terminal snapshot freezing and reset comparisons. The delivered game passed its separate browser gate. Listening and final human approval were not performed.

Local evidence remains in ignored storage:

- `.local/claude-loop-audit-focused.log` — 32 focused checks passed.
- `.local/claude-loop-audit-full.log` — all 281 regression tests passed.
- `.local/anthropic-validation/2026-10-30T17-58-23-516Z/report.json` — live model calls and build result.
- `.local/claude-loop-audit-result.json` — independently verified handoffs and additional gameplay execution.

This establishes the tested outcomes, not an absence of every possible error. The native handoff matrix covers all registered styles with synthetic responses; only the small custom lantern game received a fresh live-model playthrough in this audit. Opus escalation and failure injection were covered offline rather than triggered against the paid API. Creative quality, other live genres and long-running campaigns remain separate validation work.
