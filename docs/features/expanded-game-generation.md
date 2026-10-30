# Expanded game generation

## Playable additions

- `campaign`: three distinct RPG levels; party HP, MP, XP and potions carry
  through portals. A cleared room grants its reward once.
- `roguelike`: five seeded rooms, randomized obstacles, enemy appearances and
  potion rewards, a final boss, and a fresh run after death/restart.
- RPG, front-view, campaign and roguelike battles use a separate battle backdrop.
  Returning to exploration restores the overworld without resetting resources.
  The art specialist chooses themed, forest, space, neon, ruins or cavern.
- `custom`: a coding specialist writes original JavaScript rules in
  `generated/rules.js`. The Phaser shell renders up to 64 colored labeled nodes
  and supplies keyboard controls, pause/settings/restart, audio and health/score
  display. This is a bounded rules API, not unrestricted game-project editing.

## Coding tools and acceptance

The Claude coding worker has explicit function tools for component inspection,
owned-source reading/search, exact text patches and browser-worker rule checks.
It uses [adaptive tool limits](../adaptive-tool-limits.md): reads have a separate
allowance, actions are bounded by task type, and repair extensions need measured
progress. Every model request counts against existing budgets. A patched source
can be submitted without repeating its text.

The source is parsed with Acorn and checked before model review. It is never
imported, evaluated or executed by Node. The harness then runs declared win/loss
scenarios in an isolated Chromium worker, checks frozen terminal states and
fresh-instance reset, and sends actual evidence to the independent checker.
Failures return to the worker within the existing repair limit. The checker must
also compare mechanics with the approved prompt: passing source-supplied
scenarios alone does not establish that the requested game was built.

The custom preview runs on a separate read-only origin (default workshop port
plus 100). It exposes game assets only, with no workshop API. Its worker policy
blocks network connections and nested workers. Worker response deadlines,
scenario limits and render bounds contain routine failures. This is browser
isolation, not a hard per-game OS memory quota or permission to run arbitrary
native programs. The API key remains in the server environment.

The local demo uses an example rules module and discloses that before approval.
Real OpenAI mode writes rules from the prompt. `examples/custom/tower-defense.js`
demonstrates original tower-defense logic without registering a fixed genre.

## Token controls and memory

Custom generation activates seven worker/checker pairs (14 minimum model calls).
Campaign/roguelike generation activates nine pairs (18 minimum calls).
Prompt interpretation adds two calls; tools, repairs and revisions add requests.
Budgets are not increased automatically. Unused template services come from
trusted framework defaults and are not presented as model-approved agent work.

Audio-only edits retain unrelated accepted work and rerun audio plus dependent
assembly/integration/QA. Theme edits invalidate presentation dependents. Changed
requirements, instructions, dependencies and source hashes invalidate the
relevant approvals. The human approves a renewed plan and exact final build.

Focused skills load for applicable capabilities. Downstream roles receive a
checked source reference/interface instead of repeated source text. Project
memory retains the full source, provenance and audit directory. Oversized tasks
stop rather than silently truncating context. Per-role calls/reported token
usage and retained revision work are visible in the dashboard; unknown usage is
reported explicitly. No fixed percentage of token savings is promised.

## Build and verification

`npm run export:game -- .local/.../builds/0` packages a generated build with Vite.
Only the trusted Vite configuration runs: generated configs, package scripts,
plugins and environment files are not loaded. Source builds stay unchanged;
packaged outputs are new artifacts requiring their own review. Node 22.12+
is required. Existing Phaser and Tone vendors are copied with their licenses.

Commands:

- `npm test`: fixtures, provider/tool boundaries, memory, rules and browser-worker tests.
- `npm run test:browser -- campaign roguelike custom`: playable browser acceptance.
- `npm run check`: JavaScript syntax checks.

Browser acceptance exercises all campaign/roguelike level exits, party resource
persistence, battle/overworld presentation, defeat/restart, pause and settings.
Code adversarial tests reject invented wins and terminate hanging rules. Seed
tests check 200 maps and winning default combat paths. These checks do not
establish audio quality, all possible game balance, or reliable live-model
generation. Final human playtesting remains required.

The feature branches are stacked after `codex/agent-handoff-audit` (PR #53) and
target `development`. Merge prerequisites preserving ancestry, or rebase after
squash merges. Branches are not merged automatically.

Approved plans include 3–6 observable acceptance criteria. They are displayed
before approval and supplied to workers/checkers. The full plan appears once in
each request; dependency records point to that exact checked plan/hash rather
than duplicating its text. Natural custom objectives are not required to copy
keywords from a fixed template.
