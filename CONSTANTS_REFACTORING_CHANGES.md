# Constants Refactoring - Complete Change Documentation

This document memorializes all changes made during the constants breakdown refactoring.

## Overview

The `libs-shared/constants.mjs` file was broken down into multiple files organized in a `libs-shared/constants/` directory structure.

## New Directory Structure

```
libs-shared/constants/
├── index.mjs                    # Re-exports all constants
├── season-constants.mjs         # Season, week, year, draft rounds, etc.
├── stats-constants.mjs          # Fantasy stats, positions, stat helpers
├── player-status-constants.mjs  # NFL player status definitions
├── nfl-teams-constants.mjs      # NFL team abbreviations
├── colleges-constants.mjs       # NCAA colleges and conferences
├── roster-constants.mjs         # Roster slots, lineup slots, practice squad
├── transaction-constants.mjs    # Transactions, waivers, tags, matchups
├── source-constants.mjs         # Data sources, projections sources
└── error-constants.mjs          # Validation errors
```

Note: File names use kebab-case per project conventions.

## Import Path Changes

**Old:**

```javascript
import { season, week, year, fantasyStats } from './constants.mjs'
```

**New (direct imports for tree shaking):**

```javascript
// Import directly from specific constant files for better tree shaking
import {
  current_season,
  current_week,
  current_year
} from './constants/season-constants.mjs'
import { all_fantasy_stats } from './constants/stats-constants.mjs'
```

### Tree Shaking Best Practices

- **DO** import directly from the specific constant file
- **AVOID** importing from `index.mjs` as barrel files prevent effective tree shaking
- **AVOID** using `import * as constants` pattern

### Migration Notes

This is a **direct migration** with no backwards compatibility aliases. All imports must be updated to use the new constant names. See the mapping tables below for old-to-new name conversions.

## Complete Constant Name Mappings

### Season Constants (`season-constants.mjs`)

| Old Name                                                  | New Name                               | Notes                                           |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `season`                                                  | `current_season`                       | Season instance object                          |
| `week`                                                    | `current_week`                         | Current week number                             |
| `year`                                                    | `current_year`                         | Current year                                    |
| `fantasy_season_week`                                     | `current_fantasy_season_week`          | Current fantasy season week                     |
| `isOffseason`                                             | `is_offseason`                         | Boolean flag                                    |
| `isRegularSeason`                                         | `is_regular_season`                    | Boolean flag                                    |
| `league_default_restricted_free_agency_announcement_hour` | `league_default_rfa_announcement_hour` | RFA announcement hour                           |
| `league_default_restricted_free_agency_processing_hour`   | `league_default_rfa_processing_hour`   | RFA processing hour                             |
| `nfl_draft_rounds`                                        | `nfl_draft_rounds`                     | _No change_                                     |
| `DEFAULTS`                                                | `league_defaults`                      | Object with LEAGUE_ID                           |
| `colors`                                                  | `ui_color_palette`                     | Color array for UI                              |
| `years`                                                   | `available_years`                      | Array of available years                        |
| `weeks`                                                   | `regular_fantasy_weeks`                | Array [1-14] for regular fantasy season         |
| `fantasyWeeks`                                            | `fantasy_weeks`                        | Array [1-17] including playoffs                 |
| `nfl_weeks`                                               | `nfl_weeks`                            | _No change_ - Array [1-21] including postseason |
| `days`                                                    | `game_days`                            | Array of game day abbreviations                 |
| `quarters`                                                | `nfl_quarters`                         | Array of quarter numbers                        |
| `downs`                                                   | `nfl_downs`                            | Array of down numbers                           |
| `seas_types`                                              | `nfl_season_types`                     | Array: ['PRE', 'REG', 'POST']                   |

**Internal helpers (not exported, remain in season-constants.mjs):**

- `get_available_years()` - generates array of years from current year back to 2000

**Dependencies:**

- Imports `season_dates` from `../season-dates.mjs`
- Imports `Season` class from `../season.mjs`

### Stats Constants (`stats-constants.mjs`)

| Old Name                   | New Name                                 | Notes                                       |
| -------------------------- | ---------------------------------------- | ------------------------------------------- |
| `positions`                | `fantasy_positions`                      | Array: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] |
| `stats`                    | `base_fantasy_stats`                     | Base player stats array                     |
| `kStats`                   | `kicker_fantasy_stats`                   | Kicker stats array                          |
| `dstStats`                 | `defense_fantasy_stats`                  | Defense stats array                         |
| `fantasyStats`             | `all_fantasy_stats`                      | Combined all fantasy stats                  |
| `projected_stats`          | `projected_base_stats`                   | Projected base stats                        |
| `projected_fantasy_stats`  | `all_projected_fantasy_stats`            | All projected fantasy stats                 |
| `createStats()`            | `create_empty_fantasy_stats()`           | Function to create empty stats object       |
| `createProjectedStats()`   | `create_empty_projected_fantasy_stats()` | Function to create empty projected stats    |
| `statHeaders`              | `fantasy_stat_display_names`             | Object mapping stat keys to display names   |
| `fullStats`                | `extended_player_stats`                  | Array of extended/advanced player stats     |
| `qualifiers`               | `stat_qualification_thresholds`          | Object with stat qualification rules        |
| `createFullStats()`        | `create_empty_extended_stats()`          | Function to create empty extended stats     |
| `teamStats`                | `nfl_team_stats`                         | Array of NFL team stats (not fantasy)       |
| `fantasyTeamStats`         | `fantasy_team_stats`                     | Array of fantasy team stat field names      |
| `createFantasyTeamStats()` | `create_empty_fantasy_team_stats()`      | Function to create empty fantasy team stats |

**Internal helpers (not exported, remain in stats-constants.mjs):**

- `passingQualifier` - qualification threshold for passing stats
- `rushingQualifier` - qualification threshold for rushing stats
- `receivingQualifier` - qualification threshold for receiving stats

### Player Status Constants (`player-status-constants.mjs`)

| Old Name                          | New Name                          | Notes                                  |
| --------------------------------- | --------------------------------- | -------------------------------------- |
| `player_nfl_status`               | `player_nfl_status`               | _No change_ - enum-style object        |
| `player_nfl_injury_status`        | `player_nfl_injury_status`        | _No change_ - enum-style object        |
| `nfl_player_status_abbreviations` | `nfl_player_status_abbreviations` | _No change_ - keeps "player" context   |
| `nfl_player_status_full`          | `nfl_player_status_display_names` | Object mapping status to display names |
| `nfl_player_status_descriptions`  | `nfl_player_status_descriptions`  | _No change_                            |

### NFL Teams Constants (`nfl-teams-constants.mjs`)

| Old Name   | New Name                 | Notes                           |
| ---------- | ------------------------ | ------------------------------- |
| `nflTeams` | `nfl_team_abbreviations` | Array of NFL team abbreviations |

### Colleges Constants (`colleges-constants.mjs`)

| Old Name           | New Name                | Notes                                          |
| ------------------ | ----------------------- | ---------------------------------------------- |
| `colleges`         | `ncaa_college_names`    | Array of college names                         |
| `collegeDivisions` | `ncaa_conference_names` | Array of NCAA conference names (not divisions) |

### Roster Constants (`roster-constants.mjs`)

| Old Name               | New Name                           | Notes                                        |
| ---------------------- | ---------------------------------- | -------------------------------------------- |
| `slots`                | `roster_slot_types`                | Object with slot type constants              |
| `starterSlots`         | `starting_lineup_slots`            | Array of starting lineup slot IDs            |
| `ps_slots`             | `practice_squad_slots`             | Array of practice squad slot IDs             |
| `ps_protected_slots`   | `practice_squad_protected_slots`   | Array of protected PS slot IDs               |
| `ps_unprotected_slots` | `practice_squad_unprotected_slots` | Array of unprotected PS slot IDs             |
| `ps_signed_slots`      | `practice_squad_signed_slots`      | Array of signed PS slot IDs                  |
| `ps_drafted_slots`     | `practice_squad_drafted_slots`     | Array of drafted PS slot IDs                 |
| `slotName`             | `roster_slot_display_names`        | Object mapping slot ID to display name       |
| `availability`         | `player_availability_statuses`     | Array of fantasy availability status strings |

### Transaction Constants (`transaction-constants.mjs`)

| Old Name             | New Name                         | Notes                                           |
| -------------------- | -------------------------------- | ----------------------------------------------- |
| `matchups`           | `matchup_types`                  | Object with matchup type constants              |
| `waivers`            | `waiver_types`                   | Object with waiver type constants               |
| `waiversDetail`      | `waiver_type_display_names`      | Object mapping waiver type to display name      |
| `transactions`       | `transaction_types`              | Object with transaction type constants          |
| `transactionsDetail` | `transaction_type_display_names` | Object mapping transaction type to display name |
| `tags`               | `player_tag_types`               | Object with tag type constants                  |
| `tagsDetail`         | `player_tag_display_names`       | Object mapping tag type to display name         |

### Source Constants (`source-constants.mjs`)

| Old Name               | New Name                             | Notes                                                                     |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `sources`              | `external_data_sources`              | Object with external data source constants (projections + sportsbooks)    |
| `source_keys`          | `external_data_source_keys`          | Object mapping source value to key (generated from external_data_sources) |
| `sourcesTitle`         | `external_data_source_display_names` | Object mapping source value to display name                               |
| `KEEPTRADECUT`         | `keeptradecut_metric_types`          | Object with KTC metric type constants                                     |
| `default_points_added` | `default_points_added`               | _No change_ - already descriptive                                         |
| `team_pid_regex`       | `team_id_regex`                      | Regex for team ID validation                                              |
| `player_pid_regex`     | `player_id_regex`                    | Regex for player ID validation                                            |

**Note:** `external_data_source_keys` is generated dynamically by inverting `external_data_sources`.

### Error Constants (`error-constants.mjs`)

| Old Name | New Name                   | Notes                                  |
| -------- | -------------------------- | -------------------------------------- |
| `errors` | `roster_validation_errors` | Object with validation error constants |

## Files Modified

All files that import from `./constants.mjs` or `../constants.mjs` need to be updated to:

1. Change import path to `./constants/index.mjs` or `../constants/index.mjs`
2. Update constant names according to the mappings above

### Key Files Modified

- `libs-shared/index.mjs` - Updated to export from `./constants/index.mjs`
- All files in `api/routes/` - Updated imports and constant references
- All files in `libs-server/` - Updated imports and constant references
- All files in `libs-shared/` - Updated imports and constant references
- All files in `app/core/` - Updated constant references
- All files in `app/views/` - Updated constant references
- All files in `scripts/` - Updated imports and constant references
- All files in `test/` - Updated constant references

## Special Cases

### Property Access Patterns

Some constants are accessed as properties of the `season` object:

- `constants.season.isOffseason` → `constants.current_season.isOffseason` (note: `isOffseason` is a property, not a constant)
- `constants.season.isRegularSeason` → `constants.current_season.isRegularSeason`
- `constants.season.fantasy_season_week` → `constants.current_season.fantasy_season_week`

### Dynamic Slot/Position Fields

The `fantasy_team_stats` array includes dynamic fields that are generated:

- `pSlot${slot}` for each slot type
- `pPos${position}` for each position

These are handled in the `create_empty_fantasy_team_stats()` function.

## Migration Checklist

When re-applying these changes:

- [x] Create `libs-shared/constants/` directory structure
- [x] Create all constant files with new names
- [x] Create `libs-shared/constants/index.mjs` to re-export all
- [x] Update `libs-shared/index.mjs` to import from new path
- [x] Add `#constants` and `#constants/*` aliases to `package.json` imports
- [x] Add `@constants/*` aliases to `babel.config.js` for frontend
- [x] Update all `libs-shared/` files to use `#constants` aliased imports
- [x] Update all `libs-server/` files to use `#constants` aliased imports
- [x] Update all `api/routes/` files to use `#constants` aliased imports
- [x] Update all `scripts/` files to use `#constants` aliased imports
- [x] Update all `app/core/` and `app/views/` files to use `@constants` aliased imports
- [x] Delete old `libs-shared/constants.mjs` file
- [x] Run tests to verify no regressions
- [x] Fix all linting errors (duplicate imports, unused variables, missing imports)

## Import Alias Configuration

### package.json (Node.js/Server)

```json
"imports": {
  "#constants": "./libs-shared/constants/index.mjs",
  "#constants/*": "./libs-shared/constants/*"
}
```

### babel.config.js (Frontend/Webpack)

```javascript
alias: {
  '@constants/season-constants': './libs-shared/constants/season-constants.mjs',
  '@constants/stats-constants': './libs-shared/constants/stats-constants.mjs',
  '@constants/player-status-constants': './libs-shared/constants/player-status-constants.mjs',
  '@constants/nfl-teams-constants': './libs-shared/constants/nfl-teams-constants.mjs',
  '@constants/colleges-constants': './libs-shared/constants/colleges-constants.mjs',
  '@constants/roster-constants': './libs-shared/constants/roster-constants.mjs',
  '@constants/transaction-constants': './libs-shared/constants/transaction-constants.mjs',
  '@constants/source-constants': './libs-shared/constants/source-constants.mjs',
  '@constants/error-constants': './libs-shared/constants/error-constants.mjs',
  '@constants': './libs-shared/constants/index.mjs'
}
```

## Import Pattern Examples

### Server-side (libs-server, scripts, api routes)

```javascript
// Import only what you need from #constants
import { roster_slot_types, player_tag_types } from '#constants'

// Or for tree-shaking, import directly from specific file
import { roster_slot_types } from '#constants/roster-constants.mjs'
```

### Frontend (app/core, app/views)

```javascript
// Import only what you need from @constants
import { fantasy_positions, current_season } from '@constants'

// Or for tree-shaking, import directly from specific file
import { fantasy_positions } from '@constants/stats-constants'
```

## Notes

- The old `constants.mjs` file should be deleted after migration
- Some constants like `season`, `week`, `year` are now accessed via `current_season`, `current_week`, `current_year`
- Property access patterns (e.g., `constants.season.isOffseason`) remain the same but use `current_season` instead
- All snake_case naming is preserved in the new constant names

## Naming Conventions Applied

The following principles were applied during the naming review:

### 1. Descriptive and Searchable Names

Per `write-software.md` guidelines:

- Variable names are descriptive and self-documenting
- Names include context (`nfl_team_abbreviations` not just `teams`)
- Names are searchable with grep (`fantasy_stat_display_names` is more discoverable than `statHeaders`)

### 2. Consistent Suffix Patterns

- `_types` for enum-style objects defining categories (e.g., `roster_slot_types`, `transaction_types`)
- `_display_names` for UI display mappings (e.g., `roster_slot_display_names`, `data_source_display_names`)
- `_stats` for stat field arrays (e.g., `all_fantasy_stats`, `nfl_team_stats`)

### 3. Function Naming

- Functions use snake_case: `create_empty_fantasy_stats()`, not `createEmptyFantasyStats()`
- Function names describe their action and output

### 4. Preservation of Established Patterns

- Enum-style objects keep singular form when they define a type (e.g., `player_nfl_status`)
- Existing well-named constants remain unchanged (e.g., `nfl_draft_rounds`, `nfl_weeks`)

### 5. Accuracy Over Brevity

- `ncaa_conference_names` instead of `ncaa_division_names` (they are conferences, not divisions)
- `nfl_team_stats` instead of `comprehensive_team_stats` (they are NFL stats, not fantasy)
- `external_data_sources` instead of `projection_data_sources` (includes sportsbooks, not just projections; "external" clarifies these are third-party sources)
- `extended_player_stats` instead of `comprehensive_player_stats` (extends base stats with advanced metrics)

### 6. File Naming

- Files use kebab-case per project conventions: `season-constants.mjs`, not `season_constants.mjs`

## Linting Fixes (Post-Migration)

After the initial migration, the following linting errors were fixed:

### Frontend Files (app/views, app/core)

1. **Duplicate import statements** - Fixed duplicate `import {` statements in:

   - `app/views/components/auction-targets/index.js`
   - `app/views/components/league-team/index.js`
   - `app/views/components/league-team/league-team.js`
   - `app/views/components/player-name/player-name.js`
   - `app/views/components/selected-player-transactions/index.js`
   - `app/views/pages/draft/index.js`
   - `app/views/pages/league-home/league-home.js`
   - `app/views/pages/rosters/index.js`
   - `app/views/pages/stats/index.js`
   - `app/views/pages/trade/trade.js`

2. **Unused imports** - Removed unused `constants` and `player_nfl_status` imports from:
   - `app/core/data-views-fields/espn-line-win-rates-table-fields.js`
   - `app/views/components/player-name-expanded/player-name-expanded.js`
   - `app/views/components/league-team/index.js`
   - `app/views/components/league-team/league-team.js`
   - `app/views/components/player-name/player-name.js`
   - `app/views/pages/draft/index.js`
   - `app/views/pages/league-home/league-home.js`

### Script Files (scripts/\*.mjs)

1. **Missing imports** - Added missing imports:

   - `is_main` from `#libs-server` in multiple scripts
   - `all_fantasy_stats` and `nfl_team_abbreviations` from `#constants` in:
     - `scripts/generate-nfl-team-seasonlogs.mjs`
     - `scripts/generate-player-gamelogs.mjs`
   - `current_year` from `#constants` in `scripts/populate-super-priority-table.mjs`
   - `getGameDayAbbreviation` from `#libs-shared` in `scripts/process-nfl-games.mjs`
   - Various utility functions (`generate_player_id`, `update_player_id`, `batch_insert`, `draftkings`, `format_market_selection_id`, `report_job`, `espn`, `find_player_row`, `updatePlayer`) from `#libs-server`

2. **Constant references** - Updated references:
   - `constants.fantasyStats` → `all_fantasy_stats`
   - `constants.nflTeams` → `nfl_team_abbreviations`
   - `constants.year` → `current_year`

### Test Files (test/\*.spec.mjs)

1. **Duplicate imports** - Fixed duplicate `#constants` imports in:

   - `test/teams.release.spec.mjs`
   - `test/waivers.update.spec.mjs`

2. **Import order** - Moved imports to top of file in:

   - `test/teams.release.spec.mjs`
   - `test/waivers.update.spec.mjs`

3. **Missing imports** - Added missing `current_season` import in:

   - `test/poach.immediate-release.spec.mjs`
   - `test/poach.process.spec.mjs`
   - `test/poach.spec.mjs`
   - `test/scripts.poach.window-blocking.spec.mjs`

4. **Unused imports** - Removed unused imports:
   - `roster_slot_types` from `test/draft.spec.mjs`
   - `roster_slot_types` and `player_nfl_status` from `test/teams.restricted-free-agency.spec.mjs`

All linting errors have been resolved. The codebase now passes `yarn lint` with zero errors.
