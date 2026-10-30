> Historical validation record: model names and measurements below describe earlier OpenAI runs. Current live generation uses the [Claude role policy](role-model-policy.md); OpenAI commands are retired.

# Planner human-question validation

The reported Moonbrook Lanterns run failed after repeated invalid planner questions. Its brief was in manual mode with collector/space/adventure settings, although the description requested custom lantern rules, forest art and calm bells. Manual settings take precedence; that conflict legitimately needs resolution. The original rejected question bodies were not retained, so their exact invalid fields cannot be reconstructed from the audit.

The provider question schema previously allowed arbitrary strings and integers despite stricter local validation. It now communicates bounded question keys, text, reasons, trimmed options, answer lengths, known roles and blocking status before generation. Descriptions explain the cross-field constraints that still require local validation: unique options, exact recommendations and options fitting the answer length. Protocol repair supplies the complete trusted question contract without reflecting rejected content or inventing a human answer. Local validation remains authoritative and the three-request repair cap is unchanged.

## Validation

- Regression tests cover worker and checker questions, valid free-text questions, invalid bounds, reserved keys, duplicate options, mismatched recommendations and bounded repair preserving the original task and usage accounting.
- A live Sol planner request using the conflicting manual brief returned a valid clarification question on its first request after the fix (2,903 reported tokens). An earlier diagnostic timed out without a response; its usage is unknown.
- The existing failed run was revised to prompt-only mode while retaining its ID, project memory, failed-attempt evidence and cumulative budgets. The real resolver worker/checker and planner worker/checker completed in four requests, reaching `awaiting_plan` with title Moonbrook Lanterns, custom genre, forest theme, calm bell music and beginner difficulty as an assumption. Reported cumulative usage increased from 6 calls / 18,836 tokens to 10 calls / 32,188 tokens.
- Human plan approval remains required. This validation does not claim implementation, playback, gameplay or final human acceptance of the lantern game.

This branch builds on the unmerged implementation in PR #97 and targets development. Merge the prerequisite stack before this fix; its development comparison includes that existing work.
