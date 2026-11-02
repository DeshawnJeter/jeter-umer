# Prompts, harnesses, skills and human context

## Instruction layers

`prompts/orchestrator.md` defines system coordination responsibilities. `prompts/shared.md` contains common boundaries. Each `agents/<role>/profile.json` selects the role's worker/checker prompt, skills, tool names, context/output limits, and retry count. Worker and checker prompts remain separate files.

`skills/<name>/SKILL.md` contains application procedures. These are project-owned skills loaded by this application, not installed global Codex skills. The skill registry allowlists names. Only the configured skills are loaded. Checkers additionally receive the playtest-evidence skill. Skills and prompt text cannot grant permissions beyond the code's allowlists.

The system manifest fingerprints master instructions, profiles, role prompts, and skill contents. Each run records the manifest. A changed manifest invalidates old contributions when work resumes. Stale plan/final approvals reject if instructions changed; revise the plan to rebuild.

## Harness layers

The manager is the system harness: role dependencies, parallel batches, saved state, retry/budget checkpoints, question routing, integration and approval rules. The shared pair runner is the agent harness: full instruction bundles, task contracts, cloned inputs, narrow tools, contract validation, retries and separate checker requests.

The scripted worker interface offers `inspect_context` and `propose_artifact`. The checker interface offers `inspect_context` and `inspect_artifact`, with no repair tool. Scripted modules remain trusted JavaScript and can import Node modules. Tool configuration is not OS isolation. The OpenAI adapter exposes no arbitrary tools: it returns strict role-specific artifact or question JSON for the harness to validate.

Context checks count full serialized instructions, selected skills, tasks, human decisions, findings and artifacts before each call. The OpenAI adapter additionally bounds the complete API body, including its output schema, disables truncation, limits output tokens, and reserves estimated input/output usage. Estimates are based on bytes rather than a model tokenizer and are not a guaranteed billing ceiling. Nothing is silently truncated.

Each role workspace records worker and checker request audits, context character counts, tool-call names and reports. Repair attempts rebuild instructions from durable sources. A role receives applicable durable decisions as data, not as higher-priority system instructions.

## Human questions and approvals

Human questions contain a stable key, question text, reason, optional choices, recommendation, blocking flag, affected roles and answer-length limit. A free-text question uses an empty choices list. The default difficulty question affects the planner and all dependent specialists. Optional story-direction input affects only story.

Workers and checkers can raise questions. Equivalent questions combine their requesters and affected roles. Conflicting questions sharing a key fail visibly. Saved answers enter shared decisions. A worker that requests an already answered key causes a visible failure instead of repeatedly asking the human.

Independent ready tasks continue after one role asks for context. Work with unresolved blocking dependencies waits. Human answers invalidate only affected contributions, or all specialists when the planner changes. Preserved tasks keep their original IDs and dependencies. Optional questions can remain unanswered without inventing a choice.

Before implementation, a human must approve the hash of the checked plan. Changing the title, difficulty or other brief requirements requires a revised plan and renewed approval. Final review still requires explicit playtest observations and approval of the exact delivered build. Silence grants neither approval.

State writes serialize per run. Human actions also serialize so double submissions cannot start two loops. Saved unfinished v1 runs migrate to paused and need fresh approval after resuming. Old run files and builds are not deleted.

## Current limitations

OpenAI mode now supports real model calls using a server-side environment key. Demo/tests/local red-team probes remain no-key. Neither mode adds autonomous executable code generation, automatic browser playtesting or an OS sandbox. The reusable template supplies the JavaScript implementation. See openai-provider.md for setup and verification boundaries.
