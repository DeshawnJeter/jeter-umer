# Agent and handoff audit

The audit exercises all active worker/checker pairs across all ten game types.
It uses synthetic responses through the actual OpenAI request serialization,
strict decoding, deterministic checkers, agent harness and scoped project memory.
It makes no paid API requests and does not claim live-model reliability or
browser gameplay coverage.

Run `node scripts/test.js tests/agent-handoff.test.js` for the targeted checks.
Run `npm test` for the complete suite.

Coverage includes exact dependency payloads, acyclic scheduling, independent
checker rejection, bounded repair, malformed artifacts, revoked acceptance,
modified memory payloads, altered ancestors, cyclic memory records, restart
with damaged cached work and dependency changes during asynchronous work.

Two reproduced gaps were fixed: the handoff previously checked the saved result
hash but did not hash the memory payload being delivered, and it did not
revalidate independent acceptance. Both stored copies and the acceptance report
are now checked recursively through their ancestors. Cached work is checked
before reuse; in-flight work is discarded if its dependencies lose integrity.
An integrity failure stops the run without marking the game complete.

These checks detect inconsistent application state. They are not a signature
or a defense against someone who can rewrite every artifact, hash and report
in the server's trusted storage.

This change follows `codex/enemy-vfx-integration` (PR #52). Its pull request
targets development and includes that existing stack until the prerequisites
are merged. Preserve ancestry or rebase after squash merges.
