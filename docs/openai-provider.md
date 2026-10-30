# OpenAI model provider

## Enable live mode

Demo mode remains the default and requires no credentials. For live workers and independent model checkers, set a fresh OpenAI API key in the server environment and run:

```powershell
$env:OPENAI_API_KEY = '<fresh key entered locally>'
$env:OPENAI_MODEL = 'gpt-4.1-mini'
npm run start:openai
```

Keep keys out of chat and version control. The server reads the configured credential from its environment only; loading a local environment file is explicit.

No environment file is loaded automatically. If you choose to use the ignored `.env/local.env`, replace its old key privately, add your desired settings, then explicitly load it:

```powershell
node --env-file=.env/local.env scripts/start-openai.js
```

The dashboard labels live mode and the Build with OpenAI action. Starting a run sends its game brief, task context, selected instructions/skills, and relevant artifacts to OpenAI. API usage is billed by your API account. Your account must have billing, model access and sufficient limits.

## Model selection

The default model is `gpt-4.1-mini`. Choose a model that supports the Responses API and strict structured outputs. Overrides, in priority order:

1. `OPENAI_<ROLE>_<STAGE>_MODEL`, such as `OPENAI_GAMEPLAY_CHECKER_MODEL`.
2. `OPENAI_WORKER_MODEL` or `OPENAI_CHECKER_MODEL`.
3. `OPENAI_MODEL`.
4. The default above.

Roles are PLANNER, GAMEPLAY, LEVELS, UI, STORY and AUDIO. Stages are WORKER and CHECKER. Existing profile files define prompts, skills and limits. Server runtime selection overrides their demo defaults without writing credentials or provider secrets into those files.

## Execution and checking

Every ready worker and checker makes a separate stateless request to the fixed `https://api.openai.com/v1/responses` endpoint. Workers do not share conversations with checkers. Strict role-specific JSON schemas constrain the output. Storage is disabled via `store: false`, request truncation is disabled, response sizes are bounded, and the application validates the returned JSON again.

The models propose game configuration, not executable JavaScript. The trusted Phaser template still implements the game. A future isolated coding runner would be a separate feature. No arbitrary file, shell, network or approval tools are exposed to these model requests.

The manager remains a deterministic system harness. Missing required difficulty/story choices are handled by preflight human gates before paid generation. The independent deterministic role checker runs first and supplies its actual contract findings/evidence as `deterministicReview` to the model checker, replacing any caller-supplied record. The model still reviews the remaining task requirements, and both checks must pass. Evidence distinguishes model static reasoning from actual deterministic checks. Neither is a browser playtest or a listening test.

Domain validation failures and actual failed checks feed findings back into the existing bounded artifact-repair loop. Response-format repair is separate: a completed model response that fails JSON, schema or protocol validation may be regenerated up to twice by the same role/stage against the unchanged task/artifact. It is never accepted by trimming a summary, deleting findings, changing a verdict or inventing evidence. A valid fail or needs_human report is returned unchanged to the harness.

The model-facing worker schema includes a nonblank 1–500-character summary plus existing title/objective/story text limits. Checker output has a closed `review` envelope with a nested union: pass has no findings/question, fail requires findings and no question, and needs_human requires a question. Evidence is generated before findings and verdict, with explicit count/text bounds and examples separating successful checks from unresolved defects. Automatic music instrument selection is explicit delegation, not a missing human decision. The provider unwraps only a validated envelope; harness artifact/report formats stay the same. Local protocol validation still rejects contradictions, unsupported fields and invalid human questions.

Only fixed, allowlisted format diagnoses are sent as repair instructions. Rejected model text is never reflected into the next request, and every repair rechecks the complete context limit without truncating. Refusals, incomplete responses, oversized/invalid API envelopes, timeout/cancellation, credential and HTTP/network errors remain terminal; there is no automatic HTTP retry or demo fallback. Exhausting format repairs leaves the run unfinished with a visible role/stage error.

## Limits and usage

Defaults per run:

- `OPENAI_MAX_CALLS=24` (maximum configurable 40).
- `OPENAI_MAX_TOTAL_TOKENS=64000` for conservative usage accounting (maximum 256000).
- `OPENAI_MAX_OUTPUT_TOKENS=2048` per request (maximum 8192).
- `OPENAI_TIMEOUT_MS=30000` per request (maximum 60000).
- `OPENAI_MAX_RESPONSE_REPAIRS=2` per worker/checker invocation (0–2; zero disables format regeneration).
- Existing 40 harness-step limit, three concurrent ready roles, and three artifact-repair attempts remain enforced. Format requests are bounded by the response-repair and global API budgets; they do not create additional harness steps.

Each outbound attempt reserves one call and an input/output estimate before transmission. Concurrent reservations count toward the run budget. The estimate uses serialized UTF-8 request bytes plus output allowance and protocol overhead. This is not a provider tokenizer or a guaranteed monetary spending cap. Usage returned by OpenAI replaces the estimate. When usage is missing, the estimate is conservatively charged to the local accounting budget. Interrupted reservations are accounted for after restart.

Run state includes call count, measured token usage, reserved tokens and unreported calls. Each format request reserves/finishes its own usage, including rejected output. `modelResponses` records role/stage, task and format attempt numbers, request hash, outcome, fixed rejection code, usage and timestamp. Recovery/rejection events appear in the dashboard activity. Audits omit rejected response text, error bodies and credentials. Keys are used only in the Authorization header. Public configuration and dashboard responses include model names and limits, not credentials.

Pause/cancel aborts in-flight requests and prevents accepting their results. A provider may already have performed billable work before cancellation; local abort does not promise zero charges. Changing provider/model settings requires a new run or a restart with the matching saved configuration, never a silent provider switch.

## Validation

```sh
npm test
npm run check
node red-team/run.js --local-only
```

The test launcher forces demo mode and removes the real API key from its child environment. Provider tests inject a synthetic token and an in-memory mock transport. The local red-team runner also forces its manager probes to demo mode. No live API request is made by these commands.

Mocked tests cover all six model worker/checker pairs, schema boundaries, instruction separation, independent deterministic disagreement, recovery from invalid summaries/JSON/contradictory reports, non-reflection of hostile output, finite exhaustion, per-attempt usage, context limits, cancellation, budgets and persistence. Bounded live validation uses complete genre fixtures and explicitly identified injected protocol faults; reports distinguish injected failures from spontaneous model failures. Neither automated tests nor model review constitute human playtesting or listening approval. Validated data can still be wrong, a checker can report a genuine defect, and budgets or external API errors can still prevent completion.

The response-recovery branch is stacked on HUD/pause-menu PR #20 and its prerequisites, targeting development. Restart the app to load the provider changes and create a new run; older saved provider configurations are not silently upgraded to a new retry policy.

Prompt-only creation adds a separate planner extraction and independent review before the normal planner pair. These calls use the same configured planner worker/checker models and share the run's budgets and format-recovery policy. They are marked `resolve_brief` in response audits. Missing choices become disclosed suggestions; supported identifiers remain schema-bound and unsupported omissions require human acknowledgement before specialists run. See [prompt-only workflow](prompt-only-workflow.md).

## Official references

- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini model support](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [API authentication](https://developers.openai.com/api/reference/overview)

Coding workers default to a 6144-token response allowance, while other workers and checkers retain 2048. Set OPENAI_CODING_MAX_OUTPUT_TOKENS to override it; an explicitly supplied OPENAI_MAX_OUTPUT_TOKENS also remains the fallback for coding. Reservations include the actual per-request allowance. The 24-call and 64000-total-token defaults are unchanged. Invalid source is retained only as a bounded private repair draft; parsing, capability checks and browser replays still precede independent model review. Exact patch misses return repair feedback without changing the file.

Interrupted coding repairs resume from matching reviewed failures without regenerating earlier rejected proposals. Large repair requests may omit optional editing-tool schemas while retaining every source byte and instruction, then submit complete source directly. UI checkers receive the checked plan once plus its dependency identity. Repair feedback identifies the no-input start() contract, invalid replay step fields and expanded step totals, and unsupported api methods. The original three coding attempts and total spending limits still apply.

Start/replay contracts: coding instructions include a minimal lifecycle reference and replay arithmetic. The isolated execution check validates source safety before execution, checks no-input Start even when replay structure is invalid, and returns all independently observed replay failures together. Invalid replays still prevent acceptance; neither frame limits nor repair-attempt limits were increased.

Live repair improvements: model replies use a structured replay array with dt/actions/repeat fields; the provider converts that array into internal input booleans. Instructions duplicated solely as focused metadata count once, while the full HTTP payload remains bounded. Large source repairs retain a hash and explicit excerpts, use bounded line windows and exact small patches, and carry the latest real tool result plus current source into each stateless model request. Replay-only repairs lock source that passed lifecycle checks. Changed repair drafts are rechecked before retry. Oversized patches can remove parsed comments while preserving executable tokens and line terminators; otherwise they return feedback without modifying the file. Trusted runtime errors identify initialization and render bounds without reflecting arbitrary thrown text.

Syntax and rendering repair: exact patches now pass source syntax and capability checks before modifying the owned file; rejected patches return findings and preserve the previous text, including when repairing an invalid proposal. The trusted pathNodes(start,end,color) helper produces at most 16 valid decorative markers, preserving both endpoints. Generated games still have a 64-node total budget, and createGame must initialize every resource read by inspect before Start.

Explicit idle-loss deadlines: when the approved prompt says "doing nothing must/should/will lose within N seconds" (N <=30), verification may continue an inconclusive all-idle loss replay until that deadline, with the existing 300-frame cap. It records original frames, added frames and observed elapsed time, and persists the actually executed effective replay with original/corrected hashes. It never extends win or active-input tests, accepts late losses, or changes game source. A saved proposal that now passes corrected verification can receive its first independent checker review without a fourth worker attempt. Rejected independent reviews cannot be repeated unchanged to obtain a different verdict. Original worker/checker audits remain saved.
