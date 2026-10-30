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
