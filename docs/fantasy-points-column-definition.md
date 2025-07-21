# Fantasy Points Column Definition Documentation

## Overview

The `player_fantasy_points_from_plays` column definition is one of the most complex column definitions in the data views system. It calculates fantasy football points from individual NFL plays based on configurable scoring formats.

## Key Features

### 1. Multi-Player Point Attribution

A single NFL play can generate fantasy points for multiple players:

- **Ball carrier (bc_pid)**: Rush yards, rush touchdowns, fumbles
- **Passer (psr_pid)**: Pass yards, pass touchdowns, interceptions
- **Target receiver (trg_pid)**: Receiving yards, receptions, receiving touchdowns
- **Fumbler (player_fuml_pid)**: Fumble lost points

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
  (bc_pid IS NOT NULL AND (rush_yds > 0 OR rush_td = true)) OR
  (psr_pid IS NOT NULL AND (pass_yds > 0 OR pass_td = true OR int = true)) OR
  (trg_pid IS NOT NULL AND (recv_yds > 0 OR comp = true)) OR
  player_fuml_pid IS NOT NULL
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
  splits: ['week'],
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

- **Splits**: `year`, `week`
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
