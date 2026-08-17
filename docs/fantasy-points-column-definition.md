# Fantasy Points Column Definition Documentation

## Overview

The `player_fantasy_points_from_plays` column definition is one of the most complex column definitions in the data views system. It calculates fantasy football points from individual NFL plays based on configurable scoring formats.

> **Related: projected fantasy points.** A sibling in-query scorer lives in `libs-server/data-views-column-definitions/player-projected-column-definitions.mjs` (`projection_fantasy_points_sql`), which scores the `player_{week,season,rest_of_season}_projected_points` columns from `projections_index`/`ros_projections` rows. It mirrors `calculatePoints({ use_projected_stats: true })` at the per-row grain (no `SUM` over plays) and is source-selectable via the `source_id` param. `projections_index` AVERAGE is the authoritative as-of-gametime frozen projection, so the in-query value is the correct one; the legacy precomputed `scoring_format_player_projection_points` is a per-format derived cache that the pipeline now re-derives **from** `projections_index` (never the reverse), keeping the two in lockstep to within rounding. See `docs/data-views-system.md` § "Projection `source_id` param".

## Key Features

### 1. Multi-Player Point Attribution

A single NFL play can generate fantasy points for multiple players:

- **Ball carrier (ball_carrier_pid)**: Rush yards, rush touchdowns, fumbles
- **Passer (passer_pid)**: Pass yards, pass touchdowns, interceptions
- **Target receiver (target_pid)**: Receiving yards, receptions, receiving touchdowns
- **Fumbler (fumble_lost_pid)**: Fumble lost points

This is handled through a UNION ALL structure that processes each player type separately.

### 2. Dynamic Scoring Format Support

The column supports custom scoring formats through the `scoring_format_hash` parameter:

- **Named Format Support**: Use predefined format names like `'ppr'`, `'half_ppr'`, `'draftkings'`, etc.
- **Hash-based Formats**: Direct hash references to `league_scoring_formats` table entries
- **Array Support**: Accepts arrays with the first element used for scoring calculations
- **Fallback Behavior**: Falls back to default half-PPR scoring when formats aren't found (in test environment)
- Supports position-specific reception scoring (RB, WR, TE)
- Handles all standard fantasy scoring categories

### 3. Performance Optimizations

Several optimizations ensure fast query execution:

#### Early Filtering in CTE

```sql
-- Only include plays that can generate fantasy points
WHERE (
  (ball_carrier_pid IS NOT NULL AND (rush_yards > 0 OR is_rushing_touchdown = true)) OR
  (passer_pid IS NOT NULL AND (pass_yards > 0 OR is_passing_touchdown = true OR is_interception = true)) OR
  (target_pid IS NOT NULL AND (recv_yards > 0 OR is_completion = true)) OR
  fumble_lost_pid IS NOT NULL
)
```

#### Conditional Position Joins

Position data is only joined when needed for position-specific scoring:

```javascript
const requires_position_data =
  (scoring_format.rbrec && scoring_format.rbrec !== base_rec) ||
  (scoring_format.wrrec && scoring_format.wrrec !== base_rec) ||
  (scoring_format.terec && scoring_format.terec !== base_rec)
```

#### Optimized Column Selection

Only selects columns actually needed for calculations, reducing data transfer.

#### Pre-calculated Scoring Values

All scoring multipliers are calculated once before SQL generation.

## Named Format Support

### Available Named Formats

The system supports several predefined named formats that can be used instead of hash values:

- **`'ppr'`**: Full point per reception scoring with 6-point passing touchdowns
- **`'half_ppr'`**: Half point per reception scoring with 6-point passing touchdowns
- **`'standard'`**: Standard scoring with no PPR and 6-point passing touchdowns
- **`'ppr_lower_turnover'`**: Full PPR with reduced turnover penalties (-1 INT, -1 fumble lost)
- **`'half_ppr_lower_turnover'`**: Half PPR with reduced turnover penalties
- **`'draftkings'`**: DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses
- **`'fanduel'`**: FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses
- **`'genesis'`**: Genesis League scoring with half PPR, 4-point passing TDs, and 0.05 passing yards
- **`'sfb15_mfl'`**: Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target)
- **`'sfb15_sleeper'`**: Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry)

### Format Resolution Process

1. **Named Format Lookup**: If the value is a string that matches a named format, it's resolved to the corresponding hash
2. **Hash Validation**: If the value is already a 64-character hex string, it's used directly
3. **Fallback Handling**: Invalid formats fall back to default scoring (test environment) or throw an error (production)

### Parameter Processing

The `scoring_format_hash` parameter supports multiple input formats:

```javascript
// String format (recommended)
scoring_format_hash: ['ppr']

// Array format (first element used)
scoring_format_hash: ['ppr', 'backup_format']

// Direct hash format
scoring_format_hash: [
  'a29c5c91c762cc114abd6911cd59293a5727cb99f44dcde8d5462485d7915559'
]
```

### Error Handling and Fallbacks

**Production Environment**:

- Invalid or missing scoring formats throw an error
- Named formats that don't exist will cause query failure
- Hash values that don't exist in the database will throw an error

**Test Environment**:

- Missing formats fall back to default half-PPR scoring with a console warning
- Allows tests to run without requiring all scoring formats to be seeded

**Array Parameter Handling**:

- When an array is provided, only the first element is used for scoring calculations
- Empty arrays fall back to default scoring

## Implementation Details

### CTE Structure

1. **filtered_plays**: Pre-filters plays and conditionally joins position data
2. **bc_stats**: Aggregates rushing statistics by ball carrier
3. **psr_stats**: Aggregates passing statistics by passer
4. **trg_stats**: Aggregates receiving statistics by target (with position if needed)
5. **fuml_stats**: Aggregates fumble statistics

### Filtering Architecture

The column supports filtering through two complementary mechanisms:

- **CTE-level filtering (`with_where`)**: Filters on the `fantasy_points_from_plays` column within the CTE for simple scenarios, providing optimal performance
- **Main query filtering (`main_where`)**: Handles complex aggregations and rate type calculations after CTE joins for advanced use cases

### Scoring SQL Generation

The `generate_scoring_sql()` function creates optimized SQL based on the scoring format:

- **Format Resolution**: Named formats are resolved to their hash values before SQL generation
- **Dynamic SQL**: Generates optimized CASE statements based on actual scoring rules in the format
- Groups related scoring categories (e.g., all passing stats in one CASE statement)
- Uses COALESCE for null-safe calculations
- Handles position-specific logic only when position data is available
- **Fallback Logic**: Uses hardcoded default half-PPR SQL when no custom format is specified

### Scoring is declared as data, not written as SQL

`libs-server/data-views/fantasy-points-scoring-expressions.mjs` holds two role
tables and both from-plays builders iterate them. Nothing here hand-writes a
scoring expression any more.

- **`PLAYS_SOURCED_ROLES`** — the three roles `nfl_plays` names with a pid column
  (passing off `passer_pid`, rushing off `ball_carrier_pid`, receiving off
  `target_pid`). Each declares a list of `terms`, one per scoring column.
- **`STAT_SOURCED_ROLES`** — the seven roles whose player identity lives in
  `nfl_play_stats` instead (both fumble roles, the two return touchdowns, two
  point conversions, field goals, extra points).

A scoring column is covered by this path exactly when some term or role names it,
and `test/libs-server.fantasy-points-path-parity.spec.mjs` imports that derived
map rather than grepping for column names. Adding a scoring column therefore
means adding a term — and forgetting to is a test failure rather than a column
that silently scores zero, which is the state `passing_completions` was in for
years.

#### Term kinds

| kind          | emits                                           | used by                                                   |
| ------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `rate`        | `<expr> * <value>`                              | a per-play quantity times a rate                          |
| `flat`        | `<value>`                                       | a role whose join already restricts each row to one event |
| `conditional` | `CASE WHEN <predicate> THEN <value> ELSE 0 END` | first downs                                               |

These reproduce the previous hand-written output character for character. The
`always` flag marks a term emitted even when the format scores it at 0, which is
what keeps the data-view goldens stable — match an existing term's shape rather
than inventing one.

### Two term classes: linear and aggregate-conditional

A term is either **linear** (a per-play value, summed) or
**aggregate-conditional** (evaluated once per player-GAME against a game total).
The second class exists because a milestone bonus, and the two DST
points/yards-against thresholds, are conditions on a game aggregate that no
per-play expression can express.

`build_role_union_period_cte` supports it with a **per-game stage**: a role
declares `game_aggregates: { <alias>: <per_play_expr> }`, the column declares
`game_conditional_expr`, and the builder groups `(pid, esbid)` first, evaluates
the conditional there, then groups to period grain.

Two consequences worth knowing:

- The stage is emitted **only** when something declares an aggregate or a
  conditional. A format with neither gets the previous single-level aggregate,
  so it costs nothing and its SQL is unchanged.
- A cross-role aggregate works because every union arm projects every alias
  (contributing 0 for the ones it does not source). That is what makes
  `rush_rec_yd` — rushing yards from one arm plus receiving yards from another —
  expressible at all.

At season grain this sums one evaluation **per game** rather than testing the
season total against the threshold, which is the whole point of the stage.

### Bonuses

`league_scoring_formats.bonuses` is a `jsonb` list of
`{ type, stat, threshold, points }`.

| type        | class                 | meaning                                                                      |
| ----------- | --------------------- | ---------------------------------------------------------------------------- |
| `milestone` | aggregate-conditional | adds `points` once when the player-game total for `stat` reaches `threshold` |
| `big_play`  | linear                | adds `points` per play of `stat` gaining at least `threshold`                |

`stat` is one of `passing_yards`, `rushing_yards`, `receiving_yards`, or the
derived `rush_rec_yd`. Cumulative tiers are just several milestone rules.
An unknown `type` or `stat` is ignored rather than thrown, so a config written
for a newer engine does not crash an older one.

**Array order is canonicalized on write.** `config_digest` dedups scoring formats
by reading `bonuses::text`, and jsonb preserves array order — so `[A, B]` and
`[B, A]` would digest differently and mint two format rows for one rule set,
silently. `canonicalize_bonuses` runs in `resolve_scoring_config` before the
value is stored. It cannot run inside the digest: a generated column must be
IMMUTABLE and cannot contain the set-returning `jsonb_array_elements`.

**Big-play bonuses are systematically under-counted on projections.** They need
per-play yardage, which `scripts/calculate-points.mjs` attaches only when the
format declares a `big_play` rule. Projections and live weekly scoring carry no
such arrays, so those rules score 0 there. That is correct — a big play is
realized, not projectable — but it means a projected total for a format carrying
them is lower than a realized one by construction. Milestones are unaffected;
they read projected aggregates normally.

### Positional overrides

A scoring column may override another column's value for one position. Two exist:

- `running_back_reception` / `wide_receiver_reception` / `tight_end_reception`
  override `receptions`.
- `tight_end_receiving_first_downs` overrides `receiving_first_downs`.

**An override of exactly 0 falls back to the base value rather than scoring
nothing.** That is pinned behaviour on both paths (`calculate-points.mjs` reads
it through `||`, not `??`), and it is load-bearing rather than incidental:
`tight_end_receiving_first_downs` defaults to 0 while `receiving_first_downs` is
commonly nonzero, so treating 0 as a real override would switch positional
scoring on for existing formats and pay a tight end nothing.

Both from-plays builders gate on the same `needs_position_data` predicate, which
is derived from the role table. The role-union builder reaches the position
through the `apply_joins` hook, the same one the `nfl_play_stats`-sourced roles
use.

### touchdown_is_first_down

A boolean, defaulting to `true`, which is what the platform has always done. When
`false`, each first-down stat is replaced by its excluding-touchdown twin
(`rushing_first_downs_excluding_touchdowns`,
`receiving_first_downs_excluding_touchdowns`), so a touchdown that also gained a
first down scores once rather than twice.

Those twins are derived in `libs-shared/calculate-stats-from-play-stats.mjs` by
incrementing in the non-touchdown stat cases (10 rushing, 21 receiving) and
deliberately **not** in the touchdown cases (11, 22). On the from-plays path the
same switch appends an excluding-touchdown clause to the first-down term's
predicate. The two paths must agree here or the same play scores twice on one of
them.

### Table Aliasing

Uses hash-based table aliasing to support multiple instances with different parameters:

```javascript
const table_alias = get_table_hash(`fantasy_points_from_plays_${key}`)
```

## Usage Examples

### Default Scoring (Half-PPR)

```javascript
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: { year: [2024], seas_type: ['REG'] }
}
```

### Named Scoring Formats

```javascript
// Full PPR scoring
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['ppr']
  }
}

// DraftKings DFS scoring
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['draftkings']
  }
}

// Half PPR scoring (explicit)
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['half_ppr']
  }
}
```

### Hash-based Scoring Formats

```javascript
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['abc123def456']  // 64-character hash referencing league_scoring_formats table
  }
}
```

### With Week Splits

```javascript
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  row_axes: ['week'],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['ppr']  // Optional: specify scoring format
  }
}
```

### Comparison: Named vs Hash Formats

```javascript
// Using named format (recommended for common formats)
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['ppr']  // Easy to read and maintain
  }
}

// Equivalent hash-based format
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  params: {
    year: [2024],
    seas_type: ['REG'],
    scoring_format_hash: ['a29c5c91c762cc114abd6911cd59293a5727cb99f44dcde8d5462485d7915559']  // Same as 'ppr'
  }
}
```

### Primary Table Optimization Example

When this column is used for sorting, the query builder automatically detects it as a CTE-based column and uses it as the primary table:

```javascript
{
  columns: [{ column_id: 'player_fantasy_points_from_plays' }],
  sort: [{ column_id: 'player_fantasy_points_from_plays', desc: true }],
  params: { year: [2024], seas_type: ['REG'] }
}
// Results in query starting from the fantasy points CTE (~1-5K records)
// instead of the player table (~27K records)
```

## Performance Characteristics

- **Primary Table Optimization**: Benefits from being used as the starting table when sorted, reducing initial result set from ~27K to 1-5K records
- **Index Usage**: Leverages `idx_nfl_plays_fantasy` covering index
- **Partition Pruning**: Uses year-specific tables when single year is queried
- **Memory Efficient**: Hash aggregations fit in memory, no disk spills
- **CTE-Based Architecture**: Hash-based table aliasing enables multiple instances while supporting primary table optimization

## Supported Features

- **Row Axes**: `year`, `week`
- **Rate Types**: All standard rate types (per_game, per_play, etc.)
- **Caching**: Full support with parameter-based cache keys
- **Having Clause**: Filters out zero-point results
- **Named Scoring Formats**: Predefined format names (`ppr`, `half_ppr`, `draftkings`, etc.)
- **Dynamic Format Resolution**: Automatic resolution of named formats to hash values

## Future Enhancements

1. **Two-Point Conversions**: Currently not implemented
2. **Special Teams Touchdowns**: Not yet included in calculations
3. **Additional Scoring Categories**: Could add sacks allowed, QB hits, etc.

## Related Documentation

### System Architecture

- [Data Views System](./data-views-system.md) - Complete system architecture and implementation details
- [Query Builder Function Reference](./query-builder-function-reference.md) - Function parameter documentation

### Schema and Specifications

- [Data View Request Schema](./data-view-request-schema.json) - API request schema
- [Performance Guidelines](./data-view-specs/performance-guidelines.json) - Optimization recommendations
- [Fantasy Parameters Schema](./data-view-specs/parameters/schemas/fantasy-parameters.json) - Fantasy-specific parameter definitions

### Development

- [Adding New Fantasy Statistics](./adding-new-fantasy-statistics.md) - Guide for extending fantasy calculations
- [Named Formats](./named-formats.md) - Available scoring format definitions
