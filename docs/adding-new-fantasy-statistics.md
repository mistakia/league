# Adding New Fantasy Statistics to the Calculation System

This document provides a comprehensive guide for adding new fantasy football statistics to the xo.football platform's fantasy points calculation system.

## Overview

The fantasy points calculation system is designed to be modular and extensible, supporting both named scoring formats and custom league configurations. Adding new statistics requires updates across several components:

1. **Constants and Definitions** - Define the new statistic
2. **Scoring Format System** - Add scoring parameters
3. **Calculation Engine** - Update point calculation logic
4. **Data Processing** - Aggregate statistics from play-by-play data
5. **Database Schema** - Store the new statistics
6. **Data Views** - Include in dynamic SQL generation

## Step-by-Step Implementation Guide

### 1. Define the New Statistic in Constants

**File: `/libs-shared/constants/stats-constants.mjs`**

Add your new statistic to the `base_fantasy_stats` array and provide a human-readable header:

```javascript
export const base_fantasy_stats = [
  // existing stats...
  'your_new_stat' // add your new stat
]

export const fantasy_stat_display_names = {
  // existing headers...
  your_new_stat: 'Human Readable Name'
}
```

The statistic will automatically be included in `all_fantasy_stats` and `create_empty_fantasy_stats()` functions.

### 2. Update Scoring Format Hash Generation

**File: `/libs-shared/generate-scoring-format-hash.mjs`**

Add the new parameter to the function signature and include it in extended parameters:

```javascript
export default function ({
  // existing parameters...
  your_new_stat = 0
}) {
  // Core parameters maintain backward compatibility
  const core_key = `${original_params}`

  // Extended parameters - only include if non-default
  let extended_key = ''
  if (your_new_stat !== 0) {
    extended_key += `_your_new_stat${your_new_stat}`
  }

  const key = core_key + extended_key

  return {
    scoring_format_hash,
    // existing parameters...
    your_new_stat
  }
}
```

**Important**: Always add new parameters as extended parameters to maintain backward compatibility. This ensures existing scoring formats generate identical hashes.

### 3. Update Fantasy Points Calculation

**File: `/libs-shared/calculate-points.mjs`**

Add logic to handle the new statistic in the scoring loop. Most stats can use the default handling, but some may need special logic:

```javascript
// For most stats, the default handling works:
// The loop automatically processes all stats from base_fantasy_stats

// For special handling, add conditional logic:
else if (stat === 'your_new_stat' && some_condition) {
  factor = scoring[stat]
  statValue = stats[stat] || 0
  // special logic here
}
```

### 4. Update League Format Definitions

**File: `/libs-shared/league-format-definitions.mjs`**

Add the new parameter to existing scoring formats where appropriate:

```javascript
export const scoring_formats = {
  standard: {
    config: {
      // existing parameters...
      your_new_stat: 0 // typically 0 for standard formats
    }
  },
  ppr: {
    config: {
      // existing parameters...
      your_new_stat: 0.5 // example scoring value
    }
  }
}
```

### 5. Update Play-by-Play Statistics Aggregation

**File: `/libs-shared/calculate-stats-from-play-stats.mjs`**

Add initialization and aggregation logic for your new statistic:

### 6. Update Database Schema

Add the new statistic columns to relevant tables:

**Tables to update:**

- `league_scoring_formats` - For scoring parameters
- `player_gamelogs` - For game-level statistics
- `player_seasonlogs` - For season aggregations

### 7. Update Data View Column Definitions

**File: `/libs-server/data-views-column-definitions/player-fantasy-points-from-plays-column-definitions.mjs`**

Add your statistic to the `stat_columns` Set and update the SQL generation:

```javascript
const stat_columns = new Set([
  // existing columns...
  'your_new_stat'
])

// In generate_scoring_sql function:
if (scoring_format.your_new_stat) {
  cases.push(
    `CASE WHEN condition THEN ${scoring_format.your_new_stat} ELSE 0 END`
  )
}
```

### 8. Use Existing Data Population Pipeline

The existing data population pipeline automatically handles new statistics through the standard flow:

1. **Update `calculate-stats-from-play-stats.mjs`** (already covered in step 5)
2. **Regenerate gamelogs** using the existing script:
   ```bash
   node scripts/generate-player-gamelogs.mjs --year 2023
   ```
3. **Regenerate seasonlogs** using the existing script:
   ```bash
   node scripts/process-player-seasonlogs.mjs --year 2023
   ```

The pipeline works as follows:

- `generate-player-gamelogs.mjs` uses `calculateStatsFromPlayStats()` to aggregate play-by-play data into game-level statistics
- `process-player-seasonlogs.mjs` aggregates game-level statistics into season-level statistics
- Both scripts automatically include any new statistics added to the `base_fantasy_stats` array

### 9. Testing and Validation

1. **Unit Tests**: Test calculate-points with new statistic
2. **Integration Tests**: Verify data view generates correct SQL
3. **Data Validation**: Ensure aggregation produces expected results

**Example test:**

```javascript
const league = { your_new_stat: 1.0 }
const stats = { your_new_stat: 5 }
const result = calculatePoints({ stats, league })
console.log(result.your_new_stat) // Should be 5.0
```

## Common Patterns and Examples

### Example 1: Simple Per-Event Scoring (like receptions)

For statistics that award points per occurrence:

```javascript
// In scoring formats
your_new_stat: 1.0, // 1 point per occurrence

// In calculate-stats-from-play-stats.mjs
case YOUR_STAT_ID:
  stats.your_new_stat += 1
  break
```

### Example 2: Yardage-Based Scoring (like passing yards)

For statistics based on yardage with fractional scoring:

```javascript
// In scoring formats
your_new_stat: 0.04, // 1 point per 25 yards

// In calculate-stats-from-play-stats.mjs
case YOUR_STAT_ID:
  stats.your_new_stat += playStat.yards
  break
```

### Example 3: Conditional Scoring (like QB kneel exclusion)

For statistics with conditional logic:

```javascript
// In calculate-points.mjs
else if (stat === 'your_new_stat' && league.exclude_special_plays) {
  factor = scoring[stat]
  statValue = stats.your_filtered_stat || 0
}

// In calculate-stats-from-play-stats.mjs
case YOUR_STAT_ID:
  stats.your_new_stat += playStat.yards
  if (!playStat.special_condition) {
    stats.your_filtered_stat += playStat.yards
  }
  break
```

## Database Schema Considerations

### Data Types

Choose appropriate data types based on the statistic:

- **smallint**: For count-based stats (attempts, completions, touchdowns)
- **integer**: For yardage stats that can be large
- **numeric(2,1)**: For scoring parameters (allows 0.5, 1.0, etc.)
- **boolean**: For flags (exclude_qb_kneels)

### Indexing

Consider adding indexes for performance:

```sql
-- Index on scoring format columns that are frequently filtered
CREATE INDEX IF NOT EXISTS idx_league_scoring_formats_your_stat
ON league_scoring_formats(your_new_stat) WHERE your_new_stat != 0;
```

### Partitioning

Remember that player_gamelogs is partitioned by year:

- Tables exist for years 2000-2026
- Default table handles other years
- Update scripts must handle all relevant partitions

## Integration Points

### Named Formats System

When adding statistics to named formats:

1. Update the format definitions in `league-format-definitions.mjs`
2. Regenerate format hashes if needed
3. Update documentation in `docs/named-formats.md`

### Data Views

The data view system automatically:

- Includes new stats in `stat_columns`
- Generates dynamic SQL based on scoring format
- Handles parameter-based filtering

### API Endpoints

// TODO

## Deployment Checklist

1. [ ] Update constants and type definitions
2. [ ] Update scoring format hash generation
3. [ ] Update fantasy points calculation logic
4. [ ] Update league format definitions
5. [ ] Update play stats aggregation
6. [ ] Create database migration script
7. [ ] Update data view column definitions
8. [ ] Create data population script
9. [ ] Add tests and validation
10. [ ] Update documentation

## Troubleshooting

### Common Issues

1. **Missing from all_fantasy_stats**: Ensure added to `base_fantasy_stats` array
2. **Hash mismatch**: Update `generate-scoring-format-hash.mjs`
3. **SQL errors**: Check data view SQL generation
4. **Missing data**: Verify play stats aggregation logic
5. **Performance issues**: Add appropriate database indexes

### Debugging

1. **Test calculation**: Use manual calculation test
2. **Check data flow**: Verify from plays → gamelogs → points
3. **Validate SQL**: Check generated data view SQL
4. **Compare formats**: Ensure hash generation consistency

## Conclusion

Adding new fantasy statistics requires careful coordination across multiple system components. Following this guide ensures that new statistics are properly integrated into all aspects of the fantasy points calculation system while maintaining backward compatibility and performance.

For questions or clarification, refer to the existing implementation of recent additions like `rush_first_down`, `rec_first_down`, and `ry_excluding_kneels` as reference examples.

## Reference Documentation

- [NFL GSIS Stat IDs Reference](nfl-gsis-stat-ids.md) - Complete reference for NFL GSIS stat IDs used in play-by-play processing
