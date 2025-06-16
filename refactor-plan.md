# Refactor Plan: Rename Ambiguous `start` Fields

## Overview

This refactor addresses two ambiguous uses of `start` in the codebase:

1. Rename `player.start` to `player.nfl_draft_year` in the player table and related code
2. Rename `season.start` to `season.regular_season_start` for clarity

## Summary of Progress

- **Completed:**
  - ✅ Code changes across 92 files to replace both `player.start` with `player.nfl_draft_year` and `season.start` with `season.regular_season_start`
  - ✅ Updated database schema to rename `player.start` column to `player.nfl_draft_year`
  - ✅ Updated `season.mjs` and `season-dates.mjs` to use `regular_season_start` instead of `start`
  - ✅ Updated all test files that were using the old `start` variable from `constants.season`
  - ✅ Successfully rebased onto main branch with conflict resolution
  - ✅ All linting and tests are passing

## Implementation Plan

### 1. Database Schema Changes

- ✅ Create migration SQL scripts to rename columns
  - ✅ For `player.start` to `player.nfl_draft_year`
  - ✅ Update column comment from 'starting nfl year' to 'NFL draft year'

### 2. `season.start` Renaming

- ✅ Update `libs-shared/season.mjs` to rename the property from `start` to `regular_season_start`
- ✅ Update `libs-shared/season-dates.mjs` to rename the property from `start` to `regular_season_start`
- ✅ Update all references to `season.start` in scripts, tests, and application code
  - All files have been systematically updated to use `regular_season_start`

## Tracking Progress

### Files Updated for `player.start` → `player.nfl_draft_year`

- ✅ All code changes completed across the codebase 
- ✅ Database schema updated to rename column
- ✅ All imports, references, and usage updated

### Files Updated for `season.start` → `season.regular_season_start`

- ✅ **Core Season Files:**
  - `libs-shared/season.mjs` - Updated property name and all internal references
  - `libs-shared/season-dates.mjs` - Updated property name
  - `libs-shared/get-free-agent-period.mjs` - Updated usage
  - `libs-shared/is-santuary-period.mjs` - Updated usage

- ✅ **Application Files:**
  - `app/core/selectors.js` - Updated references
  - All frontend component files using season start

- ✅ **Scripts (92 files total):**
  - All import scripts, analysis scripts, and processing scripts updated
  - Scripts with wagering, odds importing, and data processing logic
  - Database seed files and processing scripts

- ✅ **Test Files:**
  - `test/season.spec.mjs` - Core season functionality tests
  - `test/scripts.transition.spec.mjs` - Transition bid processing tests  
  - `test/api.super-priority.spec.mjs` - Super priority API tests
  - `test/libs-server.get-super-priority-status.spec.mjs` - Super priority status tests
  - `test/scripts.super-priority.spec.mjs` - Super priority processing tests
  - All other test files using season constants

### Additional Fixes Applied

- ✅ Fixed merge conflicts during rebase onto main branch
- ✅ Corrected over-replacement issues where database column names were incorrectly changed
- ✅ Restored proper test assertion strings and database references
- ✅ Resolved linting warnings and ensured code quality standards

## Completion Status

**✅ COMPLETED** - The refactor is now fully complete and ready for merge.

## Final Summary

This comprehensive refactor successfully renamed ambiguous `start` variables throughout the codebase:

1. **`player.start` → `player.nfl_draft_year`**: Updated all references to clearly indicate this field represents the NFL draft year
2. **`season.start` → `season.regular_season_start`**: Updated all references for clarity about timing

**Changes Applied:**
- 92 files modified with systematic replacements
- Database schema updated 
- All tests passing
- Code quality standards maintained
- Successfully rebased onto main branch

**Notes:**
- This refactor focuses specifically on `player.start` and `season.start` fields only
- Other uses of "start" (game starts, lineup starters, etc.) remain unchanged as intended
- No backward compatibility needed - clean breaking change with full codebase update
- All conflicts resolved and edge cases handled properly
