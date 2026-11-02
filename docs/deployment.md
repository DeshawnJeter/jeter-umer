# Private team deployment

This configuration hosts a **private shared workshop**, following the latest requested scope. Every signed-in team member can access the same projects, feedback, versions and model allowance. There is no public registration, individual account ownership, public game directory or multi-tenant promise.

The deployment code is separate from the existing localhost demo. `NODE_ENV=production` always requires authentication and fails startup if its required configuration is absent. `WORKSHOP_AUTH=on` enables the same gate in local staging. Normal localhost mode remains available without credentials; do not expose that mode through a tunnel or public reverse proxy.

## Security and operating boundaries

- Team passwords are salted with scrypt. Only a password hash belongs in server configuration. Sessions use random opaque tokens; only token hashes are stored. Production cookies are Secure, HttpOnly, host-only `__Host-` cookies with SameSite=Strict and an eight-hour default lifetime. Logout revokes the session server-side. Rotate the password hash **and** session secret when removing a team member; preserve the backup key separately for recovery.
- Every workshop API and dashboard module requires sign-in. Mutations require the exact configured Origin and the session's CSRF header. Missing Origin is rejected. Login is bounded to ten recorded attempts in fifteen minutes across the workshop; a separate traffic limiter prevents concurrent scrypt floods. The team shares these limits. Rate limiting does not trust forwarded client-IP headers.
- All games, including trusted templates, are served on a **different hostname** from the workshop. The read-only preview host has no workshop API or sign-in routes. Signed links authorize one run and generation for one hour. Treat these as private bearer links: anybody you give a link can play until it expires. Logout does not retract an already shared link. Rotate the session secret to invalidate links. Stable tickets avoid resetting gameplay on dashboard polling.
- Worker responses prohibit network requests, nested workers and dynamic evaluation via CSP. The static checker additionally rejects direct/literal constructor and prototype traversal. Static parsing is not a security proof; the worker CSP remains required, especially if exporting to a different host.
- `WORKSHOP_`, model-provider and other known credential variables are removed from browser-process environments. Keys are never included in public configuration, model prompts, saved builds or exports by this feature. Docker excludes local environments, repositories, run history and dependencies from its build context.
- Daily UTC call/token allowances and a lifetime token allowance cover every worker, checker, repair and tool continuation across runs. Reservations are committed and synced before generation; concurrent requests cannot independently consume the same allowance. Known usage reconciles reservations; unknown or interrupted usage stays charged. Restarting or making a new run does not reset the lifetime allowance. Corrupt/missing accounting for existing data blocks startup.
- These are model-use allowances, **not a guaranteed dollar cap on the provider account**. Prices, other applications and provider billing are outside this process. Set provider account-side limits and alerts too. Changing configured allowances is an explicit administrator operation, not a game prompt or browser setting.
- Storage admission limits cover saved runs, projects, uploads and new work started by changes/repairs/restores. A maximum of five unfinished runs remains enforced. Existing accepted work can still consume some space while it finishes; the byte threshold is an admission limit, not a kernel filesystem quota. Keep disk headroom. Cancellation, sign-out and export remain available at the threshold.
- One process owns the persistent data directory. The file lock rejects concurrent writers; a dead process's lock is recovered. This JSON-backed deployment is single-instance. Do not scale replicas or run overlapping deploys against the same disk. Hosted runs share one build slot; independent roles within that run can still work in parallel. Waiting runs do not spend model tokens. SIGTERM stops new paid work, pauses active runs, drains requests and waits for saved work, with a bounded shutdown deadline.
- In-memory ZIP downloads are limited to 32 MB of source files to bound export memory. Larger projects need an administrator-managed export rather than silently consuming all server memory.
- Native browser QA has a recorded wall-clock allowance based on game duration: at least 60 seconds and at most three minutes. Custom-code QA retains its one-minute wall cap and separate bounded rule checks. Linux CI uses two test processes to reduce competing software-rendered browsers; checks are not skipped. This does not increase model-call or token allowances.
- On Linux headless hosts, browser QA exercises Phaser's supported Canvas fallback to avoid software WebGL emulation. Windows Edge QA retains its normal renderer. Player previews still use the delivered Phaser.AUTO configuration. Reports record the renderer, current stage and last observed gameplay values. Human visual review remains necessary for the player's actual browser/GPU.
- Audio QA observes native gain values with a bounded settling window: the browser's actual audio clock is independent of accelerated JavaScript time. A label saying muted cannot satisfy the check while playback gain stays positive.

## Required hosting configuration

The default Blueprint now creates a second, diskless `team-game-previews` web service in the same region. It forwards only GET requests for signed `/play/.../preview/...` assets to the workshop's internal network address, rewriting Host to the configured preview hostname. It never forwards cookies or authorization headers, never exposes workshop APIs, and preserves the game's CSP and worker restrictions. Both services use their own Render HTTPS addresses, so no purchased domain is required. Set `WORKSHOP_PREVIEW_ORIGIN` to the preview service's exact public origin on **both** services, and `WORKSHOP_PUBLIC_ORIGIN` to the workshop's public origin. `WORKSHOP_UPSTREAM` is populated from the workshop's internal hostport by the Blueprint. The free preview service can make private-network requests but may sleep when idle; upgrade only if always-on previews are needed. Signed links still expire after one hour and require a valid capability at the upstream.

Use the checked-in `Dockerfile` and `render.yaml`. The image includes Node 24 and the pinned Playwright Chromium browser with system dependencies. Application source stays root-owned and read-only to the application user; `/app/.local` is a writable ephemeral cache. The container prepares only a whitelisted data directory under `/var/data` as root, holds a kernel `flock` for the disk, then runs the application as the unprivileged `node` user. The kernel releases this lock even after a crash or PID-namespace restart. No API key is supplied during the image build.

The Blueprint selects a single paid web service, a five-GB persistent disk, manual deploys, browser QA, and **demo mode initially**. No billable Render resources are created just by committing it. The smallest paid compute plan is a starting configuration; verify memory with your actual concurrent builds and increase it if needed. The local machine's Docker daemon was unavailable during implementation; the new Linux CI job builds the image rather than claiming a local image build passed.

Configure these values privately in the hosting environment:

| Setting | Purpose |
| --- | --- |
| `WORKSHOP_PUBLIC_ORIGIN` | Exact HTTPS workshop origin, without a trailing slash |
| `WORKSHOP_PREVIEW_ORIGIN` | Exact HTTPS origin on a different hostname, routed to the same service |
| `WORKSHOP_PASSWORD_HASH` | Team password's scrypt hash |
| `WORKSHOP_SESSION_SECRET` | Random secret of at least 32 characters |
| `WORKSHOP_BACKUP_KEY` | 32 random bytes encoded as 64 hex characters; store an offline copy |
| `WORKSHOP_DATA_DIR` | `/var/data/workshop`, backed by the persistent disk |
| `GAME_BUILDER_PROVIDER` | Start with `demo`; change to `anthropic` only after secret rotation |
| `ANTHROPIC_API_KEY` | A **new** provider key, supplied as a runtime secret for live mode |

The template defaults are 100 calls/day, 500,000 reserved/reported tokens/day, 2,000,000 tokens total, 250 MB of live data, 100 saved runs, 100 projects, 20 concurrent sessions and five unfinished runs. Lower or deliberately raise these through environment settings. Game-level budgets remain separate and cannot raise these allowances.

### Create team secrets without putting the password in arguments

Run locally from the repository. In PowerShell 7:

```powershell
$teamPassword = Read-Host 'Team password (16–128 characters)' -MaskInput
$teamPassword | node scripts/workshop-secrets.js
Remove-Variable teamPassword
```

The command creates ignored `.env/hosted.env` with a password hash and fresh session/backup secrets. It refuses to overwrite an existing file and does not print its contents. Transfer required values through your host's secret settings, not chat or GitHub. The model key is deliberately not copied from the existing local environment. Keep an offline copy of the backup key; replacing it does not decrypt older snapshots.

## Render setup and launch gate

1. Review and merge this feature PR into `development`. Do not point a Blueprint at a branch missing its Dockerfile/configuration.
2. Validate `render.yaml` with `render blueprints validate render.yaml` when Render CLI is installed. Schema validation is also supported by Render's current published JSON Schema. A schema pass does not create resources or prove DNS, billing or runtime health.
3. Create the Blueprint from the GitHub repository and review the paid service/disk before applying. Supply the required secrets and origins. The Blueprint uses `sync: false` for values that need operator input; later changes use the service's environment settings.
4. Use the separate Render addresses from the two-service Blueprint and configure both origins as described above. Alternatively, with an owned domain, omit the relay service and route a custom preview hostname directly to the workshop service. Do not use ports on the same hostname as production separation.
5. Deploy in demo mode. Verify `/healthz`, sign-in, a complete demo build, the isolated preview, pause/settings, version restore, sign-out and a backup/restore rehearsal. Unauthenticated API reads/writes must fail; the preview host must reject API routes. Avoid logging full capability URLs.
6. Revoke both keys previously pasted into chat at their respective provider accounts. Generate a fresh Anthropic key and set it only in runtime secrets. Enable provider-side usage alerts/limits. No code change can prove those account operations happened.
7. Switch to `GAME_BUILDER_PROVIDER=anthropic`, deploy, and run one bounded real-model build. Verify measured shared usage and rollback to demo if it fails. Do not call this live-provider verification complete based on demo or synthetic tests.

Render references checked during implementation: [Blueprint specification](https://render.com/docs/blueprint-spec), [environment secrets](https://render.com/docs/configure-environment-variables), [Docker](https://render.com/docs/docker), [domains/TLS](https://render.com/docs/custom-domains), [persistent disks](https://render.com/docs/disks).

## Backups and recovery

At startup and every six hours when no job or mutating request is active, the server drains pending saves, temporarily rejects mutations and creates an encrypted snapshot. Busy periods are checked every fifteen minutes. The most recent seven snapshots are retained under `$WORKSHOP_DATA_DIR/backups`. `/api/backup-status` reports the last snapshot in this process; `/healthz` fails on backup errors. Failed backups block new paid reservations. Backups include all project, version, feedback and accounting files, without the active lock or temporary files. Each file uses AES-256-GCM; the manifest is authenticated with HMAC. A backup on the same disk is not offsite disaster protection: regularly copy an encrypted snapshot directory to separate storage through the host's secure file-transfer facility, and retain the key elsewhere. Render's disk snapshots are an additional recovery aid, not a substitute for a tested application backup.

For recovery, stop the service first. Copy an entire encrypted snapshot directory, including `manifest.json` and all numbered `.enc` files, to a trusted machine. Set `WORKSHOP_BACKUP_KEY` privately, then run:

```sh
node scripts/restore-workshop.js BACKUP_DIRECTORY EMPTY_DESTINATION
```

Restore refuses a populated destination, checks authentication before trusting paths, and discards partial output on a damaged file. Restored sessions are revoked. For the container, use the empty destination `/var/data/restored`; its entrypoint accepts `/var/data`, `/var/data/workshop` or `/var/data/restored` only. Run recovery as the application user (`node`, UID/GID 1000), with access to the encrypted source and an empty target owned by that user. The container entrypoint prepares this ownership when its command is set to the restore script; do not restore files as root and then expect the application to read root-only files. Configure `WORKSHOP_DATA_DIR` to the restored directory, then restart in demo mode and verify project versions, feedback, quota usage and previews before enabling models. Keep the original directory until recovery is verified. A restored snapshot may predate usage incurred afterward: preserve the newer accounting ledger where available, or conservatively reduce remaining allowances before enabling paid generation. Never delete `control.json` to reset budgets. This is disaster recovery, separate from the workshop's ordinary game-version restore.

## Existing local projects

Local data and keys are not uploaded automatically. Prepare a fresh hosted data directory and initialize its controls before importing trusted local run/project/version/asset directories while the server is stopped. Keep the existing local data unchanged. Migrating accounting from already billed local runs requires an explicit conservative allowance decision. The default deployment intentionally starts empty rather than silently publishing old games or resetting old accounting.

## Verification

```sh
node scripts/test.js --test-concurrency=2 tests/deployment-security.test.js tests/deployment-http.test.js
node scripts/test.js --test-concurrency=4 'tests/*.test.js'
npm run check
```

The focused tests use synthetic passwords and credentials, exercise real HTTP Host routing and browser sign-in/gameplay, shared budget rejection before provider generation, persistence across restart, malformed/expired tickets, session revocation, CSRF, private-file denial and authenticated encrypted restore. Full application tests remain offline. The GitHub workflow runs the suite, a Linux Docker image build and `node scripts/container-smoke.js`. That disposable fixture checks the unprivileged application UID, the kernel single-writer lock, authenticated demo-agent generation with actual browser QA, preview separation, saved versions, graceful restart and crash recovery. Its plan approval is explicitly from the fixture driver; final human game approval is never fabricated. It creates and removes only its own random container and volume, uses synthetic secrets and makes no model calls. A live DNS/TLS/Render check, fresh provider credentials, listening quality and final human gameplay approval are separate launch evidence.
