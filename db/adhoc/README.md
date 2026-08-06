# db/adhoc

Append-only audit log of one-shot SQL run against `league_production` via `yarn db:exec`,
plus the `.mjs` tooling that grew up alongside it. See § The .mjs files for the part of
this directory that is NOT append-only history.

## Conventions

- Filename: `YYYY-MM-DD-<slug>.sql` where the date is the run date.
- One file per logical change. If statements must succeed atomically, put them in one file -- `yarn db:exec` wraps each invocation in a single transaction.
- Files are committed and never edited after running. If a follow-up correction is needed, add a new file.
- After running ad-hoc DDL, run `yarn export:schema` to update `db/schema.postgres.sql`.

## The .mjs files

The `.mjs` files here fall into three groups. Only the third is append-only history; the first
two are standing tools that are expected to change.

**Durable gates.** Run by `yarn check:cluster`, whose manifest in
`scripts/check-cluster-gates.mjs` is the authoritative list — `yarn check:cluster --list` prints
each gate with its prerequisite and its oracle. That list is not restated here, so it cannot
drift out of agreement with what actually runs.

**Durable, but not gates.** Standing tools that must never be wired into a pass/fail run.

| File                               | Role                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit-schema-conformance.mjs`     | The oracle behind the conformance ratchet. Exits 1 by design on standing debt, so it is not a gate and is deliberately absent from the runner. |
| `scan-source-leakage.mjs`          | Advisory only. Its header states it MUST NOT be wired into a publish gate or CI — a non-zero count is the expected state.                      |
| `schema-partitions.mjs`            | Shared library. Derives partition-child membership from the dump for the audit and the inventory generator.                                    |
| `generate-migration-inventory.mjs` | Regenerable inventory generator. Never hand-edit its output.                                                                                   |

**Spent one-shots.** Written for a cluster that has since closed. They are kept as audit trail
and are not expected to run again: the pid re-key set (`check-pid-rekey-coverage.mjs`,
`scan-embedded-pids.mjs`, `pid-rekey-prep-02-remap.mjs`,
`2026-07-20-pid-rekey-index-hygiene.mjs`), the closed rename clusters
(`check-player-column-repoint.mjs`, `check-fantasy-stat-repoint.mjs` and its
`fantasy-stat-renames.mjs` map), `generate-bid-changelog-snapshot-backfill.mjs`, and
`2026-08-04-repair-snap-gamelog-nfl-team.mjs`.

`check-plays-column-repoint.mjs` is NOT in that group despite its cluster being closed — it takes
`--map`, so it serves any cluster renaming columns on the plays family, and it is in the runner.

**Before relocating any of these, check the path depth.** `check-player-column-repoint.mjs`,
`check-fantasy-stat-repoint.mjs` and `scan-embedded-pids.mjs` each resolve the repo root as
`path.join(__dirname, '..', '..')` and then filter their scan directories through
`fs.existsSync`. Moved one level deeper without fixing that constant, the scan set becomes empty
and the script reports zero findings and exits 0 — a green over nothing, which is the failure
mode most of the tooling in this directory exists to prevent.

## Workflow

```bash
# 1. Author the SQL (e.g. db/adhoc/2026-05-04-rename-pp-columns.sql)
# 2. Review locally
# 3. Run against prod (wrapped in BEGIN/COMMIT, halts on first error)
yarn db:exec db/adhoc/2026-05-04-rename-pp-columns.sql

# 4. Refresh the schema dump
yarn export:schema

# 5. Commit both the adhoc file and the schema diff
git add db/adhoc/2026-05-04-rename-pp-columns.sql db/schema.postgres.sql
git commit -m "Rename pp/ppp/pp_pct/doi columns"
```
