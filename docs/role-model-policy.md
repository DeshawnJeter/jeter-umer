# Claude role model policy

Claude / Anthropic is the only supported live provider. Offline demo remains available. This routing policy favors cheaper, faster Haiku for bounded data and Sonnet for implementation and independent system checks. These choices are hypotheses to validate on actual games; a cheaper token rate does not itself reduce the number of tokens sent.

| Job | Worker | Checker | Effort |
| --- | --- | --- | --- |
| Planner and prompt interpretation | Sonnet 5.5 | Sonnet 5.5 | medium |
| New JavaScript mechanics and repairs | Sonnet 5.5 | Sonnet 5.5 | medium |
| Gameplay configuration | Haiku 5.5 | Sonnet 5.5 | low |
| Levels configuration | Haiku 5.5 | Sonnet 5.5 | low |
| Combat, enemy behavior, progression | Sonnet 5.5 | Sonnet 5.5 | medium |
| UI / UX and art direction | Sonnet 5.5 | Sonnet 5.5 | low |
| VFX settings | Haiku 5.5 | Sonnet 5.5 | low |
| Story and dialogue | Sonnet 5.5 | Haiku 5.5 | low |
| Synthesized music data | Haiku 5.5 | Haiku 5.5 | low |
| Implementation, integration, acceptance QA | Sonnet 5.5 | Sonnet 5.5 | medium |
| Third coding-worker repair with concrete findings | Opus 5.5 | Sonnet 5.5 | high worker, medium checker |

Gameplay/level/VFX jobs currently produce bounded configuration. New behavior code belongs to the Sonnet coding specialist; this policy does not route arbitrary implementation to Haiku. UI/art currently receive structured data, not screenshots. The policy does not add visual generation or musical listening. Orchestration, memory storage, dependency tracking, hashing, schema validation and execution remain deterministic and consume no model calls.

Effort is sent through native output_config.effort and included in native token counting and request audit records. It is low for bounded tasks and medium for requirements/code/system review. Token/output/call/attempt limits remain enforced; high effort never expands a budget. The final coding escalation requires task attempt 3 plus actual findings; malformed protocol response repairs alone do not trigger it.

ANTHROPIC_MODEL or stage-wide overrides deliberately replace the mix; leave them unset for job routing. Role/stage overrides such as ANTHROPIC_AUDIO_CHECKER_MODEL have highest priority. Explicit worker overrides disable automatic escalation. ANTHROPIC_ENABLE_ESCALATION=false disables Opus entirely. Saved run configurations never change silently; a new run is required after the policy changes.

Efficiency comes from existing focused context, affected-role routing, deterministic checks before model review and bounded repair, plus cheaper Haiku assignments and lower effort where suitable. Judge the policy by cost and elapsed time per accepted build, including repair calls, rather than promising a fixed saving. All-Sonnet and mixed runs may produce different code, so one small live comparison is not a benchmark.

Official references checked October 30, 2026: [model suitability and latency](https://platform.claude.com/docs/en/models/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort), [pricing](https://platform.claude.com/docs/en/about-claude/pricing). Haiku's listed low-input rate applies only up to 100,000 input tokens per request; this app's 40,000-byte request ceiling and count check keep normal requests well below that tier boundary. Estimates exclude cache discounts and repair/escalation uncertainty.
