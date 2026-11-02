# Free temporary team demo

`render.free.yaml` describes two free web services with no disk or paid model calls. Use the dedicated `codex/render-free-workshop` branch while testing, rather than applying the paid `render.yaml`. The main image's `/var/data/workshop` directory is ephemeral here. Team sign-in, CSRF checks, signed preview links, source isolation and browser QA remain enabled.

Free Render services cannot receive private network requests. The preview relay instead connects to the workshop's public HTTPS origin, authenticates with a shared runtime secret and serves only signed game assets. It never forwards the player's cookies or authorization headers. Set the same `WORKSHOP_PREVIEW_RELAY_SECRET` on both services, `WORKSHOP_PUBLIC_ORIGIN` to the workshop HTTPS origin, `WORKSHOP_PREVIEW_ORIGIN` on both services to the preview HTTPS origin, and `WORKSHOP_UPSTREAM` to the workshop HTTPS origin on the preview service.

Set `WORKSHOP_EPHEMERAL=on` and `GAME_BUILDER_PROVIDER=demo` on the workshop. This combination refuses live model providers so lost local accounting cannot reset paid model allowances. No model key belongs in this demo. Use a fresh generated team password hash, session secret and backup key through runtime environment settings. Never commit them.

Games, project memory, feedback, versions, sessions and local backups can disappear whenever Render sleeps, restarts or redeploys the service. Download source exports before leaving. This is a temporary shared test workspace, not durable hosting. Both services may take about a minute to wake up, and share the workspace's free usage allowance with its other services. No keep-alive polling is configured to bypass idle sleep.

Before reporting launch success, verify HTTPS, sign-in, unauthenticated API denial, a complete demo build, isolated preview playback, pause/restart, sign-out, and the deployed service plans. Test live providers only on a separately configured durable deployment.
