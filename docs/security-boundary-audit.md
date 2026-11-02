# Security boundary audit — October 30, 2026

This audit used disposable loopback demo servers, synthetic credentials and harmless browser probes. It made no paid model calls, loaded no real environment file, changed no user project and installed or updated no dependency. Production security behavior is unchanged by this branch.

## Confirmed gaps

1. **Unauthenticated local API access.** A request without credentials read the fixture run with HTTP 200. A request without credentials or an Origin header created a disposable project with HTTP 201. The server still binds to loopback; this does not establish public Internet access or a bypass of the foreign-browser-Origin protection. Local processes and callers able to reach a forwarded port remain a concern. Authentication is not implemented by this audit.
2. **No application-wide spending allowance.** The per-run counter rejected a second reservation at its one-call test limit. A fresh run counter could reserve again. Source review confirms that the app has per-run call/token limits rather than a global daily or dollar allowance. These were synthetic reservations; no provider request was made. Anthropic account-side limits were not inspected.
3. **Static-code filtering needs the browser backstop.** The parser accepted indirect function construction in a harmless source canary. The actual custom-preview worker CSP blocked the corresponding attempt to construct a function returning 7. This is a static-filter weakness, not a demonstrated preview sandbox escape. Exported games depend on their hosting policy; no exported-host exploit or exfiltration test was performed.

## Protections that passed

- Explicit foreign browser Origin rejected with HTTP 403.
- Unexpected Host rejected with HTTP 403 using raw HTTP, so the client could not normalize it back to localhost.
- Private `.env`, `.git` and traversal requests returned HTTP 404.
- Custom preview origin returned HTTP 404 for workshop API reads and HTTP 403 for mutations.
- A fake environment credential did not appear in public configuration, run responses or decompressed downloadable fixture files.
- Actual preview worker CSP blocked a same-origin request for an existing harmless JSON file, indirect dynamic code execution and a harmless nested worker.
- Current tracked-file pattern scan found no matching real-key-shaped strings. The local environment file matched Git ignore rules. This does not prove historical commits or all possible secret types are clean.
- Per-run spending reservation limits held. Browser-worker regression checks rejected hanging generated rules and false win/loss claims.
- Existing asset tests rejected SVG/executable content, oversized files/dimensions and malformed WAV chunks. These are bounded validator tests, not exhaustive decoder fuzzing.

## Results and limits

The standalone boundary audit recorded **11 passes, 3 failures, 1 warning, 2 not-tested checks and no execution errors**. The three failures represent unauthenticated reads, unauthenticated writes and missing global spending enforcement. The warning is indirect dynamic-code syntax accepted by the static parser but blocked at runtime.

The selected security/agent/asset/memory/export regressions passed **88 tests**, and the separate generated-code/browser-route suite passed **13 tests**. The local red-team suite passed **11 probes**; its five live-model prompt-injection/persuasion cases and one human creative/audio case were explicitly not tested.

`npm audit --omit=dev --ignore-scripts --json` reported **zero known vulnerabilities across 51 dependency entries** at audit time. No automatic fixes or package scripts were run. This advisory result is not a guarantee against unknown vulnerabilities or a supply-chain compromise.

Previously pasted credentials still need rotation. This audit did not query account activity, prove whether those keys were used by anyone else, revoke keys or change local credentials. No destructive disk-exhaustion test or comprehensive disk-quota verification was performed.

## Reproduce

```
node scripts/security-boundary-audit.js
node red-team/run.js --local-only
```

The boundary command creates and retains its own ignored `.local/security-audit/<timestamp>` fixture and report, starts only loopback listeners and stops its own processes. It exits nonzero when it observes a gap or probe error. It never loads `.env/local.env`. A nonzero exit for the current missing authentication/global limits is an audit finding, not a passing defense.

Evidence for this run:

- Final boundary report: `.local/security-audit/2026-10-30T18-27-24-752Z/boundaries.json`.
- Regression/advisory logs: `.local/security-audit/2026-10-30T18-23-30-135Z/`.
- Local red-team report: `.local/red-team/2026-10-30T18-25-42.916Z-c774718a-dcd9-4ae7-b95f-ea6853d59300.json`.

Priority follow-up is local API authentication, a global spending allowance, credential rotation and stronger generated-code/export-host defenses. These findings require separate fixes; this branch provides the reproducible tests and evidence. It is stacked on PR #100 and its unmerged prerequisites, targeting development.
