# Historical OpenAI provider

Live OpenAI generation is retired. Use [Claude / Anthropic setup](anthropic-provider.md) and the [Claude role policy](role-model-policy.md).

The production app no longer contains an OpenAI API endpoint, credential-selection path or startup mode. Existing run records, model IDs, usage, hashes and approvals remain historical evidence and are not relabeled as Claude work. Start a new run or restore a version into a new Claude run for current checks and approval.

Historical protocol fixtures live under tests/fixtures and require an injected offline transport; they cannot make real OpenAI requests. Previous setup and validation reports remain available in Git history. Historical live reports in ignored local storage are retained.
