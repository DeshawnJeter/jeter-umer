# Indie workflow pull requests

All target development. Each branch depends on the previous row; the first
depends on the existing tower-defense fixes (PR #78). Merge prerequisites with
history preserved. These are first bounded implementations; read indie-workflow
for capabilities and limits. The final indie-release-validation branch combines
the stack and adds integration fixes, documentation and release checks.

| Change | Branch | Pull request |
| --- | --- | --- |
+| Document the indie workflow baseline and dependency order | `codex/verified-development-baseline` | [PR #79](https://github.com/DeshawnJeter/jeter-umer/pull/79) |
| Persist project memory across generation runs | `codex/persistent-game-projects` | [PR #80](https://github.com/DeshawnJeter/jeter-umer/pull/80) |
| Save immutable game versions and exact-build evidence | `codex/immutable-game-versions` | [PR #81](https://github.com/DeshawnJeter/jeter-umer/pull/81) |
| Track unresolved playtest feedback across project runs | `codex/playtest-feedback` | [PR #82](https://github.com/DeshawnJeter/jeter-umer/pull/82) |
| Compare milestones and restore versions into fresh runs | `codex/version-compare-and-restore` | [PR #83](https://github.com/DeshawnJeter/jeter-umer/pull/83) |
| Assign role models with bounded coding escalation | `codex/role-model-policy` | [PR #84](https://github.com/DeshawnJeter/jeter-umer/pull/84) |
| Expose projects versions feedback and restoration in the workshop | `codex/developer-workspace-ui` | [PR #85](https://github.com/DeshawnJeter/jeter-umer/pull/85) |
| Start focused game changes from a saved version | `codex/natural-language-change-requests` | [PR #86](https://github.com/DeshawnJeter/jeter-umer/pull/86) |
| Retain test evidence for unaffected code dependencies | `codex/dependency-aware-code-edits` | [PR #87](https://github.com/DeshawnJeter/jeter-umer/pull/87) |
| Expose tested reusable gameplay components | `codex/reusable-game-components` | [PR #88](https://github.com/DeshawnJeter/jeter-umer/pull/88) |
| Allow focused edits through controlled gameplay module views | `codex/modular-game-workspaces` | [PR #89](https://github.com/DeshawnJeter/jeter-umer/pull/89) |
| Gate custom games with independent project acceptance tests | `codex/independent-gameplay-tests` | [PR #90](https://github.com/DeshawnJeter/jeter-umer/pull/90) |
| Create traceable repair plans from unresolved feedback | `codex/targeted-repair-loop` | [PR #91](https://github.com/DeshawnJeter/jeter-umer/pull/91) |
| Download editable standalone projects from saved versions | `codex/editable-project-export` | [PR #92](https://github.com/DeshawnJeter/jeter-umer/pull/92) |
| Add per-build call/token limits and transparent cost estimates | `codex/build-cost-controls` | [PR #93](https://github.com/DeshawnJeter/jeter-umer/pull/93) |
| Import bounded PNG and WAV assets with provenance | `codex/user-asset-library` | [PR #94](https://github.com/DeshawnJeter/jeter-umer/pull/94) |
| Use project assets in game rendering music and exports | `codex/agent-asset-assignment` | [PR #95](https://github.com/DeshawnJeter/jeter-umer/pull/95) |
