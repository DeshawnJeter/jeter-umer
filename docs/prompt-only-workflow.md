# Prompt-only game planning

The creation form offers two modes. Manual mode preserves the existing controls and their priority over the description. Checking **Get settings from my prompt** hides and disables those controls; the browser sends only `inputMode: "prompt"` and the source `prompt`. The server also ignores stale manual values in a prompt-mode request.

Example:

> Make a beginner-friendly maze escape called "Moonlit Lanterns" in a forest. Add calm ambient music with piano-like keys. Stars are optional bonuses.

The resolver proposes title, genre, theme, difficulty, music enabled/disabled, music style and lead instrument. Missing or conflicting information becomes a conservative suggestion with an explanation. Source text is preserved. Supported settings remain collector/maze/platformer/survival; space/forest/neon; beginner/experienced; the existing eight music styles and seven synthesized instruments, plus automatic instrument selection.

In OpenAI mode the configured planner worker extracts a strict typed artifact. A separate planner checker compares it with the original source prompt and supported catalog. Failed extraction checks feed back into up to three proposal attempts. Existing response-format repairs, per-request context bounds, cancellation, global step/call/token limits and usage accounting still apply. A normal prompt-mode run adds two requests before the usual twelve worker/checker requests. No arbitrary tools or executable output are exposed. Demo mode uses a documented keyword/label parser and deterministic validation; it does not claim general natural-language understanding.

Resolution is saved in `briefResolution` with the proposal, independent report, original prompt, instruction hash and provider. Workspaces retain separate resolver worker/checker audits. Provider request audits identify `operation: "resolve_brief"`. Resolver instructions are included in the system manifest so changes invalidate stale plan approval.

The normal planner/checker pair then reviews the resolved game plan. Specialists wait for **Approve plan and start specialists**. The review shows all selected settings, assumptions and unsupported requests. **Edit proposed settings** exposes the same supported controls; editing requires a fresh checked plan and hash. A prompt-mode revision re-extracts from the new prompt. An explicit settings edit switches that run to manual control while preserving warnings from the original interpretation.

Unsupported requests are disclosed by the model and supplemented by independent checks for known unsupported mechanics. The UI disables approval until the user acknowledges omitted features. The API separately requires `acceptUnsupported: true`; string-valued acknowledgements do not count. The acknowledgement is recorded against the checked plan hash and remains required after editing that plan. Excluded features are passed as context to the remaining workers/checkers. The runtime cannot create unsupported game types or load arbitrary code, asset URLs or instrument definitions. Semantic extraction can still make mistakes: review the proposal and omissions before approving. RPG, stealth, shooter and metroidvania mechanics are not added by this feature.

Prompt descriptions remain limited to 2,000 characters. Partial or malformed interpretations do not start specialists. Refusals, exhausted budgets and repeated failed checks stop visibly. Existing game build hashes, final playtest requirements and the opaque iframe sandbox remain unchanged.

This feature branch is stacked on response-recovery PR #21 and its prerequisites, targeting development. Restart the app to load the new planner workflow. Create a new run to use the new instruction manifest; existing saved game builds are preserved.
