# Indie development workflow

The starting implementation is commit b3df739 (tower-defense fixes, PR #78).
Development was 1984104 when this work started. Earlier feature PRs remain
unmerged. New feature branches preserve that ancestry and target development;
review each feature against its preceding branch to see its isolated change.
Merge prerequisites with history preserved before merging dependent PRs.

The current application supports templates, bounded custom JavaScript rules,
campaign/roguelike templates, persistent per-run memory, independently checked
artifacts, isolated browser checks, exact-build human approval and ZIP export.
Custom generation is not unrestricted Phaser project editing. Browser smoke
checks do not prove every requested mechanic or creative quality.

Implementation order: shared project identity; immutable versions; unresolved
feedback; version restore/compare; natural-language changes; dependency-aware
edits; modular workspaces; reusable components; independent gameplay tests;
targeted repairs; asset import/assignment; editable export; budget controls;
workspace UI; release validation. Model policy is a separate feature.

Project facts, source, feedback, tests and approvals must retain provenance.
Restoration never overwrites a historical build or copies human approval to a
new candidate. A shared project identity is not permission to execute an old
agent's instructions or skip current checks. No paid model calls are needed
for ordinary regression tests.

## Using projects

Select an existing project before creating another run to retain its history.
Existing runs are migrated to individual projects on startup. Delivered builds
are saved as immutable versions; use Save current build as a version for an
older delivered run. Name a milestone, compare two versions, or restore one.
Restore makes a new run with identical game bytes, fresh current checks and
fresh plan/playtest approval. Open feedback stays attached to the project.

Record a version, expected/actual behavior and reproduction steps. Make a repair
plan from an open issue, or request a focused change with a preservation list.
The coding workspace starts with the base source. Human review resolves or
defers issues; agents do not close them. Duplicate active repairs are rejected.

Independent input/metric checks apply to new custom-game runs and are captured
with that run's plan. These checks are human-defined; natural-language criteria
are not automatically converted into a complete test suite. Browser smoke,
worker replay and these metric checks cover different scopes.

Module tools expose named top-level helper-function views of the bounded
canonical rules.js file. Movement/combat/enemy/level/progression/effect views
cannot introduce imports or modify helpers outside their prefix. This is not
yet unrestricted multi-file Phaser editing or parallel writes by many roles.
Reusable input, cooldown, inventory, movement and progression helpers reduce
duplicate game code; existing template combat/audio systems remain available.

## Assets and export

Import PNG images up to 2048×2048 or 16-bit PCM mono/stereo WAV (8–48 kHz, up to
60 seconds), at most 2 MB per file and 24 files per project. Keep license and
attribution records. Assign background/player/music assets for future builds;
music must also be enabled. New art jobs can choose catalog IDs; explicit human
assignments take precedence. Choices are metadata-based, not screenshot review.
Player textures use a static image; sprite-sheet frame mapping is not included.
Custom render nodes can request asset:'player'. Other nodes remain rectangles.
Imported music loops use the existing independent music/master settings and
stop on pause/end. The original procedural/synthesized defaults remain usable.

Download editable projects from a saved version. Unpack, install Node 22.12+,
run npm install, then npm run dev. npm run build bundles runtime code and copies
configuration/vendor/imported assets to dist. These exports require fresh QA;
the workshop never claims old approval covers edited or repackaged files.

## Budgets and validation

New runs can lower server call/token limits. Estimates show assumptions and
exclude tools, repairs, escalation and caching; they are not dollar caps.
Model defaults and third-attempt escalation are explained in role-model-policy.
Live access and performance require a separate paid evaluation with your account.

Run npm test for demo/synthetic tests (credentials are stripped); browser tests
require installed Edge on Windows or Playwright Chromium. Use npm run check for
syntax checks. The integration tests exercise restart, project isolation,
immutable bytes, feedback provenance, restored approvals, real UI workflows,
independent requirement failure, actual imported audio and editable exports.
This is a local development release, not an authenticated public hosting service.
