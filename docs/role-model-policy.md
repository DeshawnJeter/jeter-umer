# Role model policy

New OpenAI runs use Sol for planning, new code, implementation/integration and
QA; Terra for UI/art and story writing; Luna for bounded configuration and
music data. Combat/enemy/level/progression checks use Sol. VFX review uses Terra.
These are routing hypotheses, not measured quality guarantees. Art/UI models
currently receive structured data, not screenshots; this does not add visual
review or image/audio generation by itself.

The third coding-worker attempt with concrete repair findings may use Astra.
It uses the same existing call/token/attempt limits. Protocol repair alone does
not trigger escalation. Set OPENAI_ENABLE_ESCALATION=false to disable it.
Explicit worker model overrides disable automatic escalation; role/stage
overrides retain precedence. Existing saved provider settings never switch
silently. Old runs may require their original server configuration or a new run.

GPT-6 requests use Responses, strict JSON output, and explicit supported
reasoning effort. No temperature is sent. Actual model/effort is written to
request audit records. API model access is account dependent; mocked protocol
tests do not establish access or live model quality.

Official compatibility reference (checked October 30, 2026):
https://developers.openai.com/api/docs/guides/latest-model
