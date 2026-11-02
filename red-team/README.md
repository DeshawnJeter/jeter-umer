# Local red-team suite

This suite probes the existing no-key game builder with synthetic data. It includes a reviewer prompt, a 17-case JSON catalog, fixed local drivers and timestamped evidence reports. It does not invoke a model, load an API key, read the actual .env, use the network, run arbitrary case code, or judge game/audio quality.

Run from the repository root after `npm ci`:

```sh
npm test
node red-team/run.js --local-only
```

Reports go to ignored `.local/red-team/` with unique names. Probe workspaces use newly generated `game-redteam-*` temporary directories. Reports include observations and evidence without exposing the synthetic canary's value. Temporary fixture artifacts remain available for inspection. No existing project, run or build is modified.

## Result and exit semantics

- `pass`: the local probe observed the required application-boundary behavior.
- `fail`: behavior differed from expectations, or probe execution failed. Execution errors have an explicit limitation and need investigation before calling them vulnerabilities.
- `not_tested`: no model adapter exists, or a human listening/playtest step did not occur. These never count as successful defenses.

Exit 1 means at least one probe failed. Exit 2 means no local probe failed but model/manual cases remain untested. `--local-only` allows exit 0 when local probes pass, while the report still says `overall: incomplete` and includes every untested case. Unknown flags reject. Overall status is never full pass when cases remain untested.

The 11 local probes cover artifact metadata, ambiguous questions, narrow tools, forged specialist approval, context overflow, stale plans, competing answers, budget exhaustion, cancellation, missing evidence and envelope separation. Five model-facing attacks and one human-quality checklist are explicitly untested.

## Dependencies and known baseline failures

This branch is based on `codex/prompt-loop-integration` (PR #10). The independent `codex/adversarial-tests` branch supplies the contract fixes found during testing. Merge that branch before expecting the local probes to pass.

On the unmodified prompt-loop baseline, LOCAL-01 and LOCAL-02 fail, nine local probes pass, and six cases remain untested. This is an intentional, visible finding, not a failure suppressed by the runner. The runner's unit tests verify reporting independently and can pass while real application probes report gaps. Run both commands above as separate validation gates.

## Adding cases

Treat all payload strings as hostile data. Select a registered driver by name; never dynamically import modules, evaluate payloads, execute shell commands, or enable network access from a fixture. New local drivers must observe resulting application state or artifacts. Provide a regression test for confirmed findings. Keep model/manual cases untested until an explicitly authorized adapter or reviewer actually exercises them.

Start an independent review using `prompts/reviewer.md`. Consumers can validate report files against `report.schema.json`.

## Limits

Scripted worker probes do not establish model resistance to injection. Tool allowlists do not constrain trusted Node modules at the OS level. A checker with a nonempty evidence string can still lie about what it inspected. Human attestation fields cannot prove that a human actually played or listened. Those are documented review boundaries, not passing security claims.
