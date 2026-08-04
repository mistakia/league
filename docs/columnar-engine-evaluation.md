# Columnar engine evaluation for data-view serving

**Recommendation: do not adopt a columnar engine.** Two plain-Postgres defects account for
most of the measured cost, and neither needs an engine change. `pg_duckdb` is a non-starter
against this schema — it executed **0 of 20** corpus queries and silently fell back to the row
executor on every one. Standalone DuckDB is genuinely 4.6x faster and ran all 20 statements
unmodified, but it buys that with a second copy of the data, and the comparison is not
apples-to-apples. Fix the two defects, re-measure with the committed harness, and revisit only
if the serving path still misses its targets.

Measured 2026-08-04 against a restored copy of the 2026-08-04 08:00 production dump, on an
isolated Postgres 16.14 cluster matching production's GUCs. Production was never queried for
timings.

## Headline numbers

| Arm                                  | Corpus total (20 views) | vs baseline | Ran unmodified             |
| ------------------------------------ | ----------------------- | ----------- | -------------------------- |
| Postgres baseline (as emitted today) | 90.5s                   | 1.0x        | 20/20                      |
| Postgres + partition-pruning fix     | 78.1s                   | 1.16x       | 20/20                      |
| `pg_duckdb` 1.2.0                    | no speedup              | 1.0x        | **0/20** (silent fallback) |
| Standalone DuckDB 1.5.5              | 19.8s                   | **4.6x**    | 20/20                      |

Median per-view DuckDB speedup is ~13x; the range is 1x to 281x. Zero row-count mismatches
across all 20 views.

## The null hypothesis: tested first, and it found something better

The brief asked whether collapsing per-column CTEs into shared aggregation passes captures
most of the win. The premise turned out to be partly wrong and the answer more useful than
expected.

**The generator already merges columns into shared CTEs.** "Defense Coverage Matric" has 12
columns and emits 1 named aggregation CTE per distinct filter, not 26 independent ones. The
redundant work is not CTE-per-column.

**The real defect is that the partitioned fact table never prunes.** `nfl_plays` is
`PARTITION BY RANGE (season_year)` with 27 partitions. The rate-aggregate CTEs restrict the
year on the wrong table:

```sql
from "nfl_plays" inner join "nfl_games" on "nfl_games"."esbid" = "nfl_plays"."esbid"
where "nfl_games"."season_year" in (2025)     -- restricts the join, not the partition
  and "nfl_plays"."season_type" in ('REG')     -- no season_year predicate on nfl_plays
```

Nothing constrains `nfl_plays.season_year`, so every one of the 27 partitions is scanned,
once per column. The denominator CTE emitted immediately above it does it correctly
(`"nfl_plays"."season_year" in (2025)`), which is what makes this look like an oversight
rather than a design choice.

For "Defense Coverage Matric" — 12 columns, 32 output rows — that is **12 scans x 27
partitions and 2,570,276 buffers**, about 20 GB of buffer traffic to produce 32 rows.

Mirroring the predicate onto `nfl_plays.season_year` is semantically identical (a play belongs
to its game's season) and was verified output-identical on every view it touched:

| View                           | Before | After  | Speedup |
| ------------------------------ | ------ | ------ | ------- |
| Defense Coverage Matric        | 4505ms | 806ms  | 5.6x    |
| Week Passing Matchup Preview   | 3250ms | 629ms  | 5.2x    |
| 1st and 10 Tendencies by week  | 337ms  | 65ms   | 5.2x    |
| Team Plays By Quarter          | 1438ms | 294ms  | 4.9x    |
| Cover 1 By Week                | 650ms  | 104ms  | 6.2x    |
| Week Receiving Matchup Preview | 3198ms | 1358ms | 2.4x    |
| Advanced QB metrics            | 3090ms | 1492ms | 2.1x    |

11 of 20 views carry the shape; all 11 produced byte-identical output. Buffers for Defense
Coverage Matric fall from 2,570,276 to 133,902 — **19x less IO**.

**Verdict on the null hypothesis: it does not clear the bar the brief set.** The affected
subset improves 1.6x (34.4s -> 22.2s) and the corpus total 1.16x, against DuckDB's 4.6x. That
is not within 2x. But two caveats matter before reading it as a case for an engine change.
The fix measured here is one mechanical predicate rewrite applied by regex, not the generator
change a real fix would be — the remaining cost in the slowest views has other causes that
were not attacked. And the DuckDB arm's advantage is partly structural rather than
engine-intrinsic (see below).

## pg_duckdb: do not adopt

`pg_duckdb` 1.2.0 on Postgres 16.14 was the lowest-adoption-cost option on paper: one engine,
one dialect, no porting of the 551 column definitions. In practice it does nothing here.

**0 of 20 corpus statements are executed by pg_duckdb.** Every one fails at plan time and
falls back to the ordinary Postgres executor:

```
WARNING:  (PGDuckDB/CreatePlan) Prepared query returned an error:
          Catalog Error: Type with name nfl_play_type does not exist!
```

The cause is Postgres ENUM types. The schema declares **34 enum types across 3,476 columns**,
111 of them on `nfl_plays` alone, and 19 of the 20 corpus views touch an enum-typed column.
Postgres injects the enum cast during planning (`'NOPL'::nfl_play_type`), DuckDB's catalog has
no such type, planning fails, and pg_duckdb hands the query back. Fallback reasons across the
corpus: `nfl_play_type` (16), `time_type` (3), `dfs_source_id` (1).

Two things make this worse than a plain "unsupported" answer:

- **The fallback is a WARNING, not an error.** A normal client never surfaces it. Measuring
  "did it get faster" without reading the plan yields "pg*duckdb made no difference", and the
  reason is invisible. A within-container A/B on five views showed pg_duckdb 0.8x–2.3x
  \_slower* than the same container without it — that is the cost of planning twice and
  discarding, not the cost of columnar execution, because no columnar execution happened.
- **An out-of-memory in the DuckDB engine takes the whole cluster down.** During the full
  corpus run the backend was `terminated by signal 9: Killed` and Postgres reinitialized,
  killing every other connection. This was in a 4 GB container so the OOM itself is an
  artifact of the test environment, but the blast radius is not: the failure mode is a
  cluster restart, not a failed query.

Even setting the enums aside, the mechanism would not deliver the win. pg*duckdb gives DuckDB's
\_executor* over Postgres _heap_ storage. The data stays row-major on disk, so the scan still
reads all 418 columns to reach the handful each aggregate references. The IO amplification
that makes this workload slow is a storage property, and pg_duckdb does not change storage.

`pg_mooncake` was dropped without testing. Its last release was v0.1.2 (Feb 2025), it never
reached 1.0, its commit trail went cold in October 2025 when Databricks acquired Mooncake Labs,
and its acceleration comes from mirroring tables into a separate Iceberg columnstore rather
than from reading heap tables — so it fails the "no migration" premise by construction.

## Standalone DuckDB: fast, and the dialect cost is zero

All 20 statements — generated by the Postgres emitter, byte-for-byte unmodified — ran on
DuckDB 1.5.5 and returned identical row counts.

**Dialect-incompatibility inventory: empty.** Not "small" — empty. Across 20 real saved views
spanning player and team grain, year and week splits, from-plays, seasonlogs, projections and
betting-market sources, there was not one SQL construct DuckDB rejected. The estimated
fraction of the 551 column definitions needing changes for dialect reasons is **0%**.

Two setup requirements are worth recording, because both initially read as dialect failures
and neither is one:

- Relations must live in a schema named `public`, and the session needs
  `SET search_path='public'`. The emitter qualifies some references as `"public"."nfl_games"`.
- Views referenced by the emitter (`nfl_year_week_timestamp`) must be materialized into the
  copy alongside the tables.

The enum problem that defeats pg_duckdb does not arise here, because the postgres scanner
flattens enums to `VARCHAR` at copy time. That is also the first hint that the comparison is
not clean.

### Why the 4.6x is not the number to plan against

The DuckDB arm was measured over a _different physical artifact_, not just a different engine:

- **Enums became VARCHAR** during the copy, so predicate evaluation differs.
- **No indexes.** The Postgres side maintains 1,485 indexes on `nfl_plays`; the DuckDB copy
  has none. That helps DuckDB on scans and is irrelevant to a serving path that also writes.
- **38 relations, not 289.** Only what the corpus touches was copied.
- **A copy is a copy.** Serving from it means an ETL path, a staleness window, and a second
  system in the request path. `nfl_plays` takes live in-season writes from the plays import
  worker.

DuckDB also does not help uniformly. The two most expensive views in the corpus barely move —
"2025 Weekly Game Props" 9093ms -> 8557ms (1.0x) and "Weekly PPRScoring" 4465ms -> 3759ms
(1.0x). Those are the 180-CTE betting-market shapes, where the cost is CTE count and join
depth rather than scan width, and a columnar engine has nothing to offer. The wins are
concentrated in exactly the from-plays aggregation family that the partition-pruning fix also
addresses.

## Two findings that are cheaper than any of this

### Production's `nfl_plays` is 3.4x bloated

Same row count, same 1,485 indexes, measured the same way on both sides:

|                  | Heap     | Indexes  | Total    |
| ---------------- | -------- | -------- | -------- |
| Production       | 5,272 MB | 3,214 MB | 8,489 MB |
| Freshly restored | 1,560 MB | 787 MB   | 2,349 MB |

A sequential scan of `nfl_plays` on production reads **3.4x more pages than the data
requires**, on the exact table this workload scans end to end. `nfl_snaps` (849 vs 823 MB) and
`nfl_play_stats` (1,145 vs 977 MB) are near-identical, so this is specific to `nfl_plays`. A
repack is a no-code-change, no-engine-change reduction in scan IO. It is also why the 8,489 MB
figure in the brief overstates the real working set.

### 9 of 185 saved views cannot execute at the deployed commit

The survey pass over every saved view found 9 failures at `2f8a4fe52`, which is what production
is running:

| Failure                                                         | Views |
| --------------------------------------------------------------- | ----- |
| `missing FROM-clause entry for table "current_week_opponents"`  | 3     |
| `missing FROM-clause entry for table "next_week_opponents"`     | 2     |
| `column "player_years.year" must appear in the GROUP BY clause` | 3     |
| `column player_seasonlogs.career_game does not exist`           | 1     |

**This includes both "Next Week Matchup Preview" views**, and it answers the year-scope
question in the brief: the 2000–2026 scan is not a missing year scope. Every from-plays column
in both views carries an explicit `year` param (2024 and 2025 respectively), and the emitted
SQL contains 22 `season_year in (2024)` literals. The all-partitions scan is the pruning defect
above, not a user error.

The views are broken for a different reason. `get-data-view-results.mjs:1731` skips the
opponent-CTE registration entirely for team-identity queries:

```js
// matchup_opponent_type joins reference player.current_nfl_team; skip
// entirely when the query is team-identity.
const is_matchup_player_identity_active = () =>
  query_context.identity_id.startsWith('player')
```

...while other paths still emit references to `next_week_opponents`. Both views are
`row_grain: ["team"]` and use `matchup_opponent_type: next_week_opponent_total`, so the SQL
names a CTE that was never defined. Verified against the **deployed** emitter on the league
host (read-only, no load): both report `references opponent CTE: true | defines it: false`.
The guard landed in `c464feaaa` (2026-05-14).

Not fixed in this session, per the brief. Worth noting that the brief's premise — this view
returning 32 rows in 4.5s — cannot be reproduced against the emitter as it stands.

## The environment finding

**Local benchmarking of this workload is entirely feasible, and should be the default.** The
whole fact-table working set is ~3.2 GB (`nfl_plays` 2,349 MB + `nfl_snaps` 823 MB +
`nfl_play_stats` 977 MB, unbloated), against 128 GB of RAM on a workstation. Restoring the
3.2 GB directory-format dump took **2m29s** with 8 parallel workers and `ANALYZE` took 2m46s.
Nothing about this workload requires production to measure it.

Doing so also removes the reason production numbers cannot support a comparison: the isolated
cluster produced run-to-run spreads under 15% (median vs min across 3 runs), against the ~3.7x
spread the same view shows on production under concurrent batch load.

## What to do

1. **Fix the partition-pruning defect in the generator.** Emit the `season_year` restriction on
   `nfl_plays` wherever it is currently emitted only on `nfl_games`. 2.1x–6.2x on 11 of 20
   views, output-identical. This is the highest value-per-risk change available.
2. **Repack `nfl_plays`.** 3.4x less scan IO, no code change.
3. **Fix the 5 views emitting an undefined opponent CTE**, and the 4 other broken saved views.
4. **Re-measure with the harness**, then decide whether anything further is warranted.
5. **Do not adopt pg_duckdb.** It cannot execute this schema's queries at all, and the way it
   declines is silent.
6. **Revisit standalone DuckDB only if 1–4 leave the serving path short**, and then scope it as
   a read-only analytical replica fed by an explicit ETL — not as a replacement for the serving
   database. The dialect cost is genuinely zero, which is the good news; the operational cost
   is a second copy of a table that takes live in-season writes.

TimescaleDB / Citus columnar compression was not evaluated. It stays the lower-risk middle path
if a columnar option is ever needed, since it keeps one engine and one connection path — but
nothing measured here suggests reaching for it before steps 1–4.

## Reproducing

The harness is `scripts/benchmark-data-views.mjs` and the corpus is
`test/data-view-benchmark/corpus.json` (20 views, `table_state` only — `run` re-emits the SQL
from the working tree, so it measures the generator you currently have).

```bash
# baseline against an isolated restore
NODE_ENV=test LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=5442 \
LEAGUE_DB_USER=bench LEAGUE_DB_DATABASE=league_bench \
node scripts/benchmark-data-views.mjs run \
  --corpus test/data-view-benchmark/corpus.json --label pg-baseline \
  --engine postgres --dsn postgres://bench@127.0.0.1:5442/league_bench \
  --runs 3 --out /tmp/pg.json

node scripts/benchmark-data-views.mjs report --results /tmp/pg.json /tmp/duck.json
```

Both subcommands need `#db` pointed at a league-schema database in addition to `--dsn`, because
several column definitions query the database while building their SQL. Without it every such
view reports `generate: role "league_test" does not exist`, which reads like a broken view
rather than a missing connection.

Run it from a clean worktree at HEAD, not the shared checkout — the emitter is read off the
working tree, so a sibling session's uncommitted rename is indistinguishable from a defect in
your own change. This evaluation hit exactly that: an uncommitted `sack` -> `is_sack` sweep in
the shared tree produced `column "is_sack" does not exist` against the restored schema.
