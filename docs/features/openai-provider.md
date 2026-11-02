# OpenAI workers and model checkers

Adds explicit OpenAI runtime selection, separate configurable worker/checker models, strict Responses API outputs, existing deterministic verification, bounded usage/cancellation, secret-safe state, dashboard provider labels and mocked integration tests. Demo remains available and tests never make paid requests.

Base prerequisite: the locally tested combination of prompt-loop integration (PR #10), adversarial fixes (PR #11) and red-team suite (PR #12). Those shared changes have not merged into development, so the PR initially includes their history. Review this feature against `codex/security-validation` locally; merge prerequisites first for a narrow development diff.

See docs/openai-provider.md for setup, limits, model overrides and verification boundaries. A fresh server-side key is needed to use live mode. The exposed key saved earlier was not read or used to test this implementation.
