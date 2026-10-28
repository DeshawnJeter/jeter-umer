# Basic agent loop

1. Save a human brief. The demo supports the fixed Star Collector template.
2. Run the planner and independent plan checker. Missing difficulty pauses the run for human context.
3. The router loads each specialist and checker. Run ready specialists in batches of at most three.
4. Each pair gets separate instruction files and cloned inputs. A worker proposes its own role's JSON artifact. The checker cannot mutate that proposal.
5. Reject malformed artifacts, retry failed checks up to three attempts, and persist every report. Never remove required context silently.
6. Integrate accepted artifacts, validate contracts and level reachability, and package a local Phaser game.
7. Pause for human browser playtesting. Record observations for movement, collection/victory, timeout/restart, audio controls, and presentation.
8. Approve only if required checks pass and the current build's byte hash matches the human's approval. Completion is explicit.
9. Difficulty/music revisions invalidate all results for this small template and start a new generation. The global 40-step budget spans revisions and stops unfinished runs. A future dependency graph can invalidate only affected tasks.

Pause and cancellation take effect at runner checkpoints. In-flight work cannot publish accepted results after cancellation. Process restart pauses unfinished active runs. Existing accepted artifacts can resume, but missing work reruns.

This version implements a planner-initiated difficulty question. The harness supports specialist/checker questions, but the dashboard's answer contract currently supports only the beginner/experienced choice. General question types and model-driven tasks are future work.
