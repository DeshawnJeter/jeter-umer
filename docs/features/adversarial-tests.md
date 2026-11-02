# Adversarial regression tests

Base prerequisite: `codex/prompt-loop-integration` (PR #10). This branch adds 16 failure-focused tests for contract smuggling, capability escalation, forged checker approval, malformed reports, output/context overflow, traversal names, unsafe question keys, stale approvals, conflicting answers, repeated questions, cancellation and step limits.

Run `node --test tests/adversarial.test.js`, or `npm test` for the full suite. No API key or network service is used. Each test uses disposable temporary directories and synthetic data. The capability test creates its own canary and never reads the real `.env`.

The initial red run had 14 passes and 2 failures. The fixes reject extra artifact fields and ambiguous question choices/invalid recommendations. Additional question validation rejects malformed affected-role lists and choices longer than the answer limit.

These are checks of deterministic application boundaries. They do not establish model resistance to prompt injection, verify truthfulness of a trusted checker, provide OS isolation, or prove that a human actually performed an attested playtest.
