# Refactor Plan: Rename Ambiguous `start` Fields

## Overview

This refactor addresses two ambiguous uses of `start` in the codebase:

1. Rename `player.start` to `player.nfl_draft_year` in the player table and related code
2. Rename `season.start` to `season.regular_season_start` for clarity

## Summary of Progress

- **Completed:**
  - Code changes in 16 files to replace `player.start` with `player.nfl_draft_year`
  - Created database migration script for renaming `player.start`
  - Updated `season.mjs` and `season-dates.mjs` to use `regular_season_start` instead of `start`
- **In Progress:**
  - Updating references to `season.start` in various scripts and tests

## Implementation Plan

### 1. Database Schema Changes

- ✅ Create migration SQL scripts to rename columns
  - ✅ For `player.start` to `player.nfl_draft_year`
  - ✅ Update column comment from 'starting nfl year' to 'NFL draft year'

### 2. `season.start` Renaming

- ✅ Update `libs-shared/season.mjs` to rename the property from `start` to `regular_season_start`
- ✅ Update `libs-shared/season-dates.mjs` to rename the property from `start` to `regular_season_start`
- ⬜ Update all references to `season.start` in scripts, tests, and application code
  - While a compatibility getter has been added to `season.mjs`, it's better to update all direct references for code clarity

## Tracking Progress

### Files to Check/Modify for `player.start` → `player.nfl_draft_year`

- ✅ Code changes in 16 files already completed
- ✅ Database migration script created at `db/migrations/20240714000000_rename_start_columns.mjs`
- ✅ Update database schema comment

### Files to Check/Modify for `season.start` → `season.regular_season_start`

- ✅ libs-shared/season.mjs
- ✅ libs-shared/season-dates.mjs
- ⬜ libs-shared/get-free-agent-period.mjs
- ⬜ libs-shared/is-santuary-period.mjs
- ⬜ app/core/selectors.js
- ⬜ scripts/import-rotowire-practice-report.mjs
- ⬜ scripts/analyze-wagers.mjs
- ⬜ db/seeds/league.mjs
- ⬜ scripts/import-prizepicks-odds.mjs
- ⬜ private/scripts/import-fanduel-odds-v2.mjs
- ⬜ scripts/import-fanduel-odds.mjs
- ⬜ scripts/import-fanduel-wagers.mjs
- ⬜ scripts/analyze-fanduel-wagers.mjs
- ⬜ scripts/import-betonline-odds.mjs
- ⬜ scripts/process-poaching-waivers.mjs
- ⬜ scripts/analyze-draftkings-wagers.mjs
- ⬜ test/common.get-poach-processing-time.spec.mjs
- ⬜ test/trade.spec.mjs
- ⬜ test/teams.protect.spec.mjs

## Notes

- This refactor focuses on `player.start` and `season.start` fields only
- Other uses of "start" (game starts, lineup starters, etc.) remain unchanged
- Backward compatibility is maintained for `season.start` through a getter method
- No backward compatibility is needed for `player.start` → `player.nfl_draft_year` change
