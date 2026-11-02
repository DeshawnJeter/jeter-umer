# Architecture

The local Node.js server hosts a static dashboard and JSON API. It binds to 127.0.0.1, restricts Host/Origin for writes, and does not auto-load environment secret files. Opt-in OpenAI mode reads its key from the server environment and exposes only non-secret provider configuration. Preview resources have a separate URL scope and run in an iframe with scripts allowed but same-origin permission withheld. Downloaded builds contain only template and vendor files.

The orchestrator uses explicit state transitions. The router maps allowlisted role names to worker/checker modules. The shared harness enforces context size, contract validation, isolated input copies, retry counts, checkpoint budgets, and persisted evidence. Agent tools in this demo are bounded artifact production and inspection rather than shell execution.

Workers produce JSON settings. The trusted Phaser template turns those settings into a 15 by 10 top-down collection game. Level checking uses grid flood fill. Gameplay checking verifies settings. UI checking measures player/background contrast. Story and audio checkers verify objective references and playback settings. Whole-game static validation checks cross-agent consistency.

Web Audio synthesizes event effects. Optional Tone.js synthesis adds a repeating melody. Both paths follow the same mute/volume settings and initialize after a user gesture. No audio assets or paid services are required.

Future work: arbitrary coding tasks inside an OS sandbox, automated browser playtests, project branching, authentication and deployment. General human questions, role-level invalidation and an opt-in model provider now exist. Do not treat a JSON validator or an iframe as an OS sandbox for executing untrusted server-side code.

## Prompt and human-loop extension
See prompt-system.md for the two harness layers, instruction/skill manifests, generalized questions, plan approval and migration behavior. Reusable application skills live under skills/. Demo mode remains local. See openai-provider.md for the optional Responses API adapter, independent model checkers, deterministic verification and usage limits.
