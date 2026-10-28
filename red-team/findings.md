# Confirmed findings and open coverage

## RT-001: unexpected artifact fields accepted

Surface: shared artifact contract. Reproduction: LOCAL-01 and the first adversarial regression. The original contract validates known fields but ignores extras such as `path` and `instructions`. A synthetic proposal therefore passes validation despite carrying unrelated metadata.

Impact: weak contract/ownership boundary. This test did not demonstrate arbitrary file access or code execution; the trusted template does not execute these fields.

Fix: `codex/adversarial-tests` rejects fields absent from the role's defined artifact. The regression preserves the synthetic role/path/instruction cases.

## RT-002: ambiguous human question definitions accepted

Surface: question normalization. Reproduction: LOCAL-02 and the second adversarial regression. Choices with leading/trailing spaces and false-valued non-string recommendations pass the original definition validation. Answer trimming can make the displayed choices disagree with accepted values.

Impact: inconsistent human decision handling, not a demonstrated privilege escalation.

Fix: `codex/adversarial-tests` rejects whitespace-ambiguous options, invalid recommendation values, malformed affected-role lists and options that exceed the configured answer length.

## Untested model/human cases

MODEL-01 through MODEL-05 require explicitly authorized model-connected test execution. An application model provider exists, but this local runner does not exercise it. HUMAN-01 requires actual playtesting/listening. They remain not_tested. No claim of prompt-injection resistance or creative-quality review follows from the scripted checks.

## Known trust limitations

The harness does not OS-isolate trusted JavaScript workers. Checker evidence is structurally validated but is not independently guaranteed truthful. Final approval records an attestation, not verified human identity or behavior. The reviewer must keep these limitations visible rather than mark them resolved because local probes pass.
