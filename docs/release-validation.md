# Local indie workflow validation

Validated October 30, 2026 on Windows/Node 24 with Edge. The full combined
regression run passed 252 tests with zero failures. The separately added real
editable-export build passed. Final targeted tests passed for imported image/WAV
playback, sprite sizing, project persistence, late-save ordering and restoration.
JavaScript syntax checks passed; changed files received additional checks.

Verified behavior includes project identity across runs/restarts; immutable
version bytes and approval separation; unresolved feedback and human resolution;
new-run restoration; focused change source seeding; dependency invalidation;
controlled helper-module editing; independent requirement rejection; repair
duplication limits; image/audio imports and assignments; pause/audio controls;
editable export and actual production build; model protocol and budget handling.

Full tests strip API credentials and use demo/synthetic model transports. No paid
requests were made. New model account access, latency, creative quality and cost
per accepted game remain unmeasured. Models do not replace deterministic tests
or human playtesting. This validation does not establish unrestricted arbitrary
game generation, sprite-sheet workflows or public multi-user hosting readiness.

Reproduce:

    node scripts/test.js --test-concurrency=2 "tests/*.test.js"
    npm run check

Browser tests require installed Edge on Windows or Playwright Chromium. Test
servers use temporary local projects, not existing user run history. The demo
at localhost:3112 uses .local/indie-workflow-preview and does not load an API key.

See feature-pull-requests.md for the separate branches and prerequisites. The
indie-release-validation PR contains the final integration fixes, this report,
and onboarding documentation. All requests target development and await review.
