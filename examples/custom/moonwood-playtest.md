# Moonwood player playtest

This fixture preserves the generated game's rules and music composition. Its source comes from the real-agent run recorded in `moonwood-provenance.json`, with one targeted gameplay fix: the build-button latch lives in persistent game state instead of the newly copied input object. Holding a key or touch button now builds once until release.

The shared runtime uses a timer-driven Tone context and a minimal Tone bundle without eager worker creation. This preserves the isolated preview policy. Labels have a dark outline for readability over the procedural forest.

Start a corrected local preview:

```sh
node scripts/preview-custom-game.js --config examples/custom/moonwood-crystal-guard.json --source examples/custom/moonwood-crystal-guard.js
```

In another terminal:

```sh
node scripts/playtest-tower-defense.js
```

The test uses actual keyboard/menu interactions and real browser time. It measures audio at Web Audio output nodes before the muted headless device output; this establishes a nonzero signal and routing behavior, not listening quality. It covers single-press building, remapping, duplicate-key rejection, costs/rewards, independent volume/mute settings, timed waves, health, win/loss freezing, and restart. Reports and screenshots go to `.local/tower-defense-playtest/checks`.

The local candidate does not overwrite the original generated build, agent evidence, approval or API counters. No model calls are needed for this playtest.
