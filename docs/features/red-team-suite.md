# Red-team suite

Base prerequisite: `codex/prompt-loop-integration` (PR #10). Adds a reusable independent-review prompt, synthetic project fixture, 17-case catalog, allowlisted local probes, structured JSON reports, report schema, confirmed findings and runner tests.

The `codex/adversarial-tests` branch fixes the two gaps detected in the baseline. This sibling branch intentionally reports those gaps until that prerequisite merges. Run `node red-team/run.js --local-only` as well as `npm test`; unit tests alone are not a clean local-probe report.

The runner uses no API key, real credentials, network, arbitrary fixture evaluation or existing project runs. Eleven probes execute locally. Five model cases and one manual playtest remain explicitly not_tested. See red-team/README.md for exit codes and trust limitations.
