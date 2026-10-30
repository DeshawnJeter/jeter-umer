> Historical validation record: model names and measurements below describe earlier OpenAI runs. Current live generation uses the [Claude role policy](role-model-policy.md); OpenAI commands are retired.

# Real-model project workflow validation

Validated October 30, 2026 with the configured local API credential, Node 24 and
Edge. Final clean report: `.local/live-project-validation/2026-10-30T06-11-30-213Z/workflow.json`.
The credential and raw local reports are not committed.

## Result

The clean workflow passed in 23 billed generation requests, with no diagnostic
resume or failed phase. The standard-rate estimate from reported tokens was
$0.2364 before cache discounts. Including earlier debugging, conservative
accounting (including one unknown-usage network request) remained below the
authorized $2.50 cap. These are estimates, not a billing receipt.

Actual model roles exercised:

- GPT-6.1 Sol: planner worker/checker, coding worker/checker.
- GPT-6.1 Terra: UI worker/checker and story worker.
- GPT-6 Luna: audio worker/checker and story checker.
- GPT-6 Astra: explicit coding-worker probe with real rule execution and an
  independent Sol checker. This was not a naturally triggered escalation.

The fixture is a small custom beacon game, not a claim to have live-tested every
genre or every specialist. The normal regression suite covers the wider app
with demo/synthetic transports. No human listening or playtest approval was
fabricated. The test driver explicitly approved its predefined plans and
supplied a story answer; final games remain for human review.

## Observed workflow

1. Real workers and separate model checkers created the first game; isolated
   rule and browser tests passed.
2. A supplied story answer (Moonbrook) persisted in project memory. The manager
   restarted before the second run.
3. A new open feedback item requested an exact visible control-hint label.
4. A second run inherited the known answer without asking again, received the
   open issue and base source, and implemented the hint. Browser-worker output
   verified the label and preserved health 4. Feedback remained open.
5. Restoring the original version produced identical game bytes in a new run,
   passed fresh browser checks and required a new plan/playtest approval.
   Restoration did not resolve feedback.
6. Astra's separate worker proposal passed execution and an independent Sol
   review. A final served-preview check found health 4, the visible hint and no
   page errors on the active preview port.

Final project: `4dfbda9f-496d-4fc1-a776-2571afb3bf2d`.
Follow-up run: `57e6b78b-ec35-482e-8756-b5940c2f407c`.
Restored run: `2fcf9916-46d5-481f-8b2b-0185bb67f9ad`.

## Fixes prompted by validation

- Inherit known human answers as current decisions with original provenance;
  do not record them again as new human answers or override explicit brief
  settings.
- Retry transient Windows directory-rename locks; retry a validated delivery
  without regenerating or charging model work.
- Remove redundant checker examples/answers and keep small source edits whole.
  Task context remains bounded; protocol schemas have a separate wire-byte cap,
  and all bytes still count in token reservations.
- Carry real Responses function-call/output messages through the tool handoff.
  End the tool allowance with a structured submission, then execute and review
  that exact file. A successful rule-check tool can also proceed to submission.
- Name the exact invalid render node/field. Require complete, short planner
  criteria rather than sentence fragments. Exhausted tasks need a new plan
  generation; they cannot overwrite the previous attempt evidence by retrying.
- Verify feedback with visible-label assertions, not source-text searches.
- Build preview links from the active server ports without mutating immutable
  game bytes or historical metadata.

Earlier failed/stopped test runs were retained. They exposed context limits,
tool limits, malformed criteria, a Windows lock and a network failure. No failed
result was relabeled as a completed game and no application budget was reset
or silently increased. Instrumented live tests now retain normal token counting.

## Reproduce

    node scripts/live-project-validation.js --preflight
    node scripts/live-project-validation.js --full --max-dollars 0.75

These are explicit live commands and incur API usage. Normal `npm test` never
invokes them. The validation script uses the tested role mix without rewriting
local model pins or the key file. See openai-provider.md for resume/limits.

Final verification: full 266-test suite passed with zero failures; JavaScript
syntax checks passed. The real served preview was checked separately.
