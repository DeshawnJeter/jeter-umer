# Claude / Anthropic agents and checkers

Select `GAME_BUILDER_PROVIDER=anthropic` and privately supply `ANTHROPIC_API_KEY`. Workers and checkers use a job-specific Haiku 5.5 / Sonnet 5.5 mix, with Opus 5.5 reserved for a third coding repair. Claude is the only live provider; offline demo remains available. See [role model policy](role-model-policy.md) for every assignment. OpenAI credentials, endpoints and startup mode have been retired.

Start with `npm run start:anthropic` when the environment is already configured. To explicitly load the ignored local file, run:

```
node --env-file=.env/local.env scripts/start-anthropic.js
```

The dashboard identifies Claude / Anthropic, shows calls and reported tokens, and labels API usage as billed. The local key file is not part of Git, public configuration, project memory or downloadable games.

## Models and limits

Coding tools use [adaptive per-task limits](adaptive-tool-limits.md), with separate read/edit/test tracking, a reserved validation slot and progress-gated repair extensions. These allowances do not increase the call or token limits below.

`ANTHROPIC_MODEL`, `ANTHROPIC_WORKER_MODEL`, `ANTHROPIC_CHECKER_MODEL` and role overrides such as `ANTHROPIC_CODING_WORKER_MODEL` or `ANTHROPIC_UI_CHECKER_MODEL` select models. OpenAI overrides are ignored in Anthropic mode. The Claude model family was checked against [Anthropic's model catalog](https://platform.claude.com/docs/en/models/overview).

Limits use the existing harness policy: `ANTHROPIC_MAX_CALLS` (default 24, at most 40), `ANTHROPIC_MAX_TOTAL_TOKENS` (default 128000), `ANTHROPIC_MAX_OUTPUT_TOKENS` (2048), `ANTHROPIC_CODING_MAX_OUTPUT_TOKENS` (6144), `ANTHROPIC_MAX_RESPONSE_REPAIRS` (0–2, default 2) and `ANTHROPIC_TIMEOUT_MS` (60000, at most 60000). Claude's default token allowance is larger than OpenAI's 64000: the initial live build used 55613 tokens before the coding pair and hit that smaller limit. Old runs keep their original limits and evidence; they are not silently increased. Coding escalation to Opus is enabled only for the third coding-worker attempt with concrete unresolved findings, within the same run budgets. Set `ANTHROPIC_ENABLE_ESCALATION=false` to disable it. Explicit worker model overrides also disable automatic escalation.

Budget reservations use the native token-count endpoint with a conservative byte fallback. Reported input usage includes cache creation and cache reads. Unknown usage remains conservatively reserved. Dollar estimates are illustrative; unknown model rates produce an unknown estimate. Refusals, truncation, API failures and exhausted budgets do not trigger unlimited retries or count as successful work.

## Integration and retained safeguards

The adapter uses the [native Messages API](https://platform.claude.com/docs/en/api/messages/create), native `tool_use`/`tool_result` messages, and [JSON structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Numeric, string and array grammar bounds and regex constraints are moved into descriptions. Removing regex from the wire grammar resolved the initial live "Schema is too complex" rejection. Every response is still validated against the original local schema, including regex, bounds, unique choices and cross-field consistency. Only the existing allowlisted coding tools can run, within their existing round, argument, file and browser limits. No vendor-supplied shell, web or computer tools are enabled.

Plans still need human approval, each contribution needs its independent checker, and generated code must pass the existing static and browser gates. Actual memory, feedback, proposal caching and version restoration use the same persistent stores. Old runs retain their original provider/model identity and usage: they cannot silently resume with Claude. Create a new run in the same project or restore a version into a new Claude run for renewed checks and approval.

## Explicit live validation

`node scripts/live-anthropic-check.js` checks authentication only. `--full` additionally runs an isolated prompt-only game fixture with real workers/checkers and browser QA, capped at 20 generation requests. This is billed. Its plan approval comes from a clearly identified test driver, not a human approval of a workshop project. Reports and fixtures remain in ignored `.local/anthropic-validation`. Ordinary tests remove both provider credentials and use synthetic responses.

This branch builds on PR #98 and its unmerged prerequisites and targets development. No prerequisite merges are performed automatically.

## Observed live result

The successful isolated test on October 30, 2026 used real Sonnet 5.5 resolver worker/checker calls plus independent planner, UI, story, audio and coding pairs. It reached `awaiting_review` in 12 generation requests with 79,389 reported tokens, a passing generated-rules execution report and passing browser QA. Estimated generation cost for that successful run was $0.221 at the documented standard Sonnet rates, excluding earlier diagnostics and the stopped 64,000-token run. Automated test-driver plan approval applies only to this fixture; listening and final human gameplay acceptance remain separate.

## Mixed-policy validation

The follow-up Claude-only policy was tested with real Sonnet 5.5 and Haiku 5.5 calls. The isolated lantern fixture reached awaiting_review with passing browser QA in 13 generation requests, 81,375 reported tokens, and approximately $0.164 of standard-rate generation usage. One initial planner schema rejection recovered through the bounded protocol repair. No live coding tool call or Opus escalation was triggered; coding-tool handling and escalation routing passed offline tests. This is a single fixture, not a comparative quality or speed benchmark. All 279 automated regression tests passed after retiring the OpenAI runtime.
