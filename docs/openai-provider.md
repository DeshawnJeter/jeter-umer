# OpenAI model provider

## Enable live mode

Demo mode remains the default and requires no credentials. For live workers and independent model checkers, set a fresh OpenAI API key in the server environment and run:

```powershell
$env:OPENAI_API_KEY = '<fresh key entered locally>'
$env:OPENAI_MODEL = 'gpt-4.1-mini'
npm run start:openai
```

Do not paste keys into chat or commit them. A key previously shared in chat should be revoked and replaced. This change does not read or use the previously saved key during implementation/testing.

No environment file is loaded automatically. If you choose to use the ignored `.env/local.env`, replace its old key privately, add your desired settings, then explicitly load it:

```powershell
node --env-file=.env/local.env scripts/start-openai.js
```

The dashboard labels live mode and the Build with OpenAI action. Starting a run sends its game brief, task context, selected instructions/skills, and relevant artifacts to OpenAI. API usage is billed by your API account. Your account must have billing, model access and sufficient limits. Availability was not checked against your account in this task.

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

The manager remains a deterministic system harness. Missing required difficulty/story choices are handled by preflight human gates before paid generation. After a model checker reviews a valid artifact, the existing deterministic role checker still runs. Both must pass. Evidence distinguishes model static reasoning from actual deterministic checks. Neither is a browser playtest or a listening test.

Domain validation failures and failed checks feed findings back into bounded repair attempts. Refusals, protocol errors, timeouts, missing credentials and HTTP errors fail visibly. There is no automatic HTTP retry or silent fallback to demo generation.

## Limits and usage

Defaults per run:

- `OPENAI_MAX_CALLS=24` (maximum configurable 40).
- `OPENAI_MAX_TOTAL_TOKENS=64000` for conservative usage accounting (maximum 256000).
- `OPENAI_MAX_OUTPUT_TOKENS=2048` per request (maximum 8192).
- `OPENAI_TIMEOUT_MS=30000` per request (maximum 60000).
- Existing 40-step limit, three concurrent ready roles, and three repair attempts remain enforced.

Each outbound attempt reserves one call and an input/output estimate before transmission. Concurrent reservations count toward the run budget. The estimate uses serialized UTF-8 request bytes plus output allowance and protocol overhead. This is not a provider tokenizer or a guaranteed monetary spending cap. Usage returned by OpenAI replaces the estimate. When usage is missing, the estimate is conservatively charged to the local accounting budget. Interrupted reservations are accounted for after restart.

Run state includes call count, measured token usage, reserved tokens and unreported calls. It never stores the API key. Keys are used only in the Authorization header. Public configuration and dashboard responses include model names and limits, not credentials. Provider HTTP/network errors are sanitized rather than echoing response bodies.

Pause/cancel aborts in-flight requests and prevents accepting their results. A provider may already have performed billable work before cancellation; local abort does not promise zero charges. Changing provider/model settings requires a new run or a restart with the matching saved configuration, never a silent provider switch.

## Validation

```sh
npm test
npm run check
node red-team/run.js --local-only
```

The test launcher forces demo mode and removes the real API key from its child environment. Provider tests inject a synthetic token and an in-memory mock transport. The local red-team runner also forces its manager probes to demo mode. No live API request is made by these commands.

Mocked tests cover all six model worker/checker pairs, schema boundaries, instruction separation, usage, deterministic disagreement, repair feedback, errors/refusals, output limits, timeouts, cancellation, budgets and persistence. Real authentication, billing, current account access, production latency, live output quality and model-facing red-team cases remain unverified.

## Official references

- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini model support](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [API authentication](https://developers.openai.com/api/reference/overview)
