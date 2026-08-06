# db/archive

Tooling written for a schema cluster that has since closed. Kept as reference,
**not expected to run.**

Moving a file here IS the record that it is spent. That is the point: a README
paragraph listing which files are dead has to be maintained by whoever kills the
next one, and it decays the first time somebody forgets. A directory does not.

Expect files here to name columns that no longer exist and to embed rename maps
for migrations that finished. That is correct for a record of a closed cluster
and would be a defect anywhere else — which is the second reason they are not in
`../gates`, where a stale identifier is a finding.

| Cluster                    | Files                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| pid re-key                 | `check-pid-rekey-coverage.mjs`, `scan-embedded-pids.mjs`, `pid-rekey-prep-02-remap.mjs` |
| player column repoint      | `check-player-column-repoint.mjs`                                                       |
| fantasy stat vocabulary    | `check-fantasy-stat-repoint.mjs`, `fantasy-stat-renames.mjs`                            |
| shorthand / boolean prefix | `shorthand-rename-map.json`, `column-repoint-maps/`                                     |
| season grain conform       | `season-grain-consumer-inventory.mjs`                                                   |
| bid changelog backfill     | `generate-bid-changelog-snapshot-backfill.mjs`                                          |

`shorthand-rename-map.json` and `column-repoint-maps/boolean-prefix.json` have no
code consumer at all — verified 2026-08-06. They are pure cluster artifacts, and
`shorthand-rename-map.json` even carries a note about where it ought to live.
They are retained because they document what a large rename actually mapped, and
deleted history is the one thing this tree cannot regenerate.

## Retiring something into here

Move it when its cluster closes, and in the same commit remove its manifest entry
from `scripts/check-cluster-gates.mjs` if it had one. A gate left in the manifest
after its cluster ends is worse than a deleted one: it burns runtime on every
cluster and its green means nothing, since it is anchored on a rename map that no
longer describes anything in flight.

`check-plays-column-repoint.mjs` is deliberately NOT here despite its own cluster
being closed. It takes `--map`, so it serves any cluster renaming columns on the
plays family, and it is still in the runner. Reusability is the test, not the age
of the migration that prompted it.
