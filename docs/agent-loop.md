# Agent loop

1. Validate and save the brief, master instruction manifest, and task context.
2. Run the planner with shared rules, role instructions and selected skills, then run its independent checker.
3. Queue missing human context. After the plan passes checks, wait for human approval of its exact hash.
4. Dispatch ready specialists in batches of at most three. Every task has explicit ownership, acceptance requirements and dependencies.
5. Each worker proposes one artifact. Its checker receives a separate input copy and instruction bundle. Retry failures within configured limits and persist evidence.
6. Queue choice or free-text questions from workers/checkers. Independent tasks continue; only affected roles wait. Equivalent questions combine, conflicting keys fail visibly, and stored decisions prevent repeated human prompts.
7. Integrate accepted artifacts, run static cross-role checks, and create the playable Phaser build.
8. Require human playtesting for movement, collection/victory, timeout/restart, audio controls and presentation. Approve only the current tested bytes.
9. Revisions invalidate affected work and approvals. Changed brief requirements need a checked plan and renewed plan approval. The global step budget spans revisions and stops unfinished work.

Pause/cancel take effect at runner checkpoints. Process restart pauses in-flight runs. Saved unanswered questions and accepted contributions survive. Old unfinished runs migrate to paused and restart under the new approval rules.

The manager enforces workflow rules. Prompts guide a future model adapter but do not execute themselves. This version remains a no-key scripted demo. See prompt-system.md for context accounting, tool boundaries and limitations.
