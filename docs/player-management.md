# Player Management

This document provides a comprehensive guide for managing player data in the xo.football platform.

## Quick Reference

| Operation           | Command                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| Search database     | `node scripts/resolve-player-match.mjs search --name "Name"`                           |
| Multi-source lookup | `node scripts/resolve-player-match.mjs lookup --name "Name" --sources all`             |
| Create player       | `node scripts/resolve-player-match.mjs create --fname "First" --lname "Last" --pos QB` |
| Update player       | `node scripts/resolve-player-match.mjs update --pid "PID" --gsisid "00-0012345"`       |
| Add alias           | `node scripts/resolve-player-match.mjs add-alias --pid "PID" --alias "Nickname"`       |
| Merge duplicates    | `node scripts/resolve-player-match.mjs merge --keep-pid "KEEP" --remove-pid "REMOVE"`  |

## Player ID Format

Player IDs follow the format: `FNAM-LNAM-YEAR-DOB`

- **FNAM**: First 4 characters of first name (uppercase)
- **LNAM**: First 4 characters of last name (uppercase)
- **YEAR**: NFL draft/rookie year
- **DOB**: Date of birth (YYYY-MM-DD)

Example: `PATR-MAHO-2017-1995-09-17` (Patrick Mahomes)

## Lookup Command

The lookup command searches multiple data sources in parallel to find player information.

### Basic Usage

```bash
# Search all sources (default)
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Patrick Mahomes"

# Search specific sources
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --sources sleeper,espn

# Filter by position and team
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --pos QB --team KC
```

### Command Options

| Option           | Alias | Description                              | Default |
| ---------------- | ----- | ---------------------------------------- | ------- |
| `--name`         |       | Player name to search (required)         |         |
| `--team`         |       | NFL team abbreviation filter             |         |
| `--pos`          |       | Position filter (QB, RB, WR, TE, K, DEF) |         |
| `--draft-year`   |       | Draft year filter                        |         |
| `--sources`      | `-s`  | Data sources to query                    | `all`   |
| `--ignore-cache` |       | Bypass cached data                       | `false` |

### Data Sources

| Source    | Description                      | Data Provided                                           |
| --------- | -------------------------------- | ------------------------------------------------------- |
| `sleeper` | Sleeper Fantasy API              | sleeper_id, espn_id, sportradar_id, gsis_id, player bio |
| `espn`    | ESPN Public Search API           | espn_id, basic info                                     |
| `nfl`     | NFL Pro API (authenticated)      | gsisid, esbid, gsis_it_id, draft info, bio              |
| `pfr`     | Pro-Football-Reference (scraped) | pfr_id, career years, active status                     |

### Output

The lookup command provides:

1. **Database matches**: Existing players matching the search criteria
2. **External source results**: Results from each queried source
3. **Consolidated view**: Merged results with all discovered IDs
4. **Duplicate warnings**: Alerts if player already exists by external ID
5. **Suggested command**: Ready-to-use create or update command

## Creating Players

### Required Fields

| Field            | Description       | Example                                    |
| ---------------- | ----------------- | ------------------------------------------ |
| `fname`          | First name        | `Patrick`                                  |
| `lname`          | Last name         | `Mahomes`                                  |
| `pos`            | Position          | `QB`                                       |
| `dob`            | Date of birth     | `1995-09-17` (use `0000-00-00` if unknown) |
| `nfl_draft_year` | Draft/rookie year | `2017`                                     |
| `height`         | Height in inches  | `75`                                       |
| `weight`         | Weight in pounds  | `225`                                      |

### Workflow

1. **Always lookup first** to check for duplicates:

   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Player Name" --pos QB
   ```

2. **Use the suggested command** from lookup output, which includes all discovered IDs

3. **If creating manually**, include as many external IDs as available:
   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs create \
     --fname "First" \
     --lname "Last" \
     --pos QB \
     --team KC \
     --dob "1995-09-17" \
     --draft-year 2017 \
     --height 75 \
     --weight 225 \
     --sleeper-id "12345" \
     --espn-id 3139477 \
     --gsisid "00-0033873"
   ```

## Updating Players

Update existing player fields including external IDs:

```bash
# Update team and position
NODE_ENV=production node scripts/resolve-player-match.mjs update \
  --pid "PATR-MAHO-2017-1995-09-17" \
  --team KC \
  --pos QB

# Add missing external IDs
NODE_ENV=production node scripts/resolve-player-match.mjs update \
  --pid "PATR-MAHO-2017-1995-09-17" \
  --gsisid "00-0033873" \
  --gsis-it-id "46046" \
  --pfr-id "MahoPa00"
```

## External ID Types

### Fantasy Platform IDs

| ID Type           | Platform        | CLI Flag            |
| ----------------- | --------------- | ------------------- |
| `sleeper_id`      | Sleeper         | `--sleeper-id`      |
| `yahoo_id`        | Yahoo Fantasy   | `--yahoo-id`        |
| `mfl_id`          | MyFantasyLeague | `--mfl-id`          |
| `cbs_id`          | CBS Sports      | `--cbs-id`          |
| `keeptradecut_id` | KeepTradeCut    | `--keeptradecut-id` |
| `fleaflicker_id`  | Fleaflicker     | `--fleaflicker-id`  |

### Analytics IDs

| ID Type           | Platform           | CLI Flag            |
| ----------------- | ------------------ | ------------------- |
| `pff_id`          | Pro Football Focus | `--pff-id`          |
| `fantasy_data_id` | FantasyData        | `--fantasy-data-id` |

### Official NFL IDs

| ID Type         | Description   | CLI Flag          |
| --------------- | ------------- | ----------------- |
| `gsisid`        | NFL GSIS ID   | `--gsisid`        |
| `esbid`         | NFL ESB ID    | `--esbid`         |
| `gsis_it_id`    | GSIS IT ID    | `--gsis-it-id`    |
| `nfl_id`        | NFL.com ID    | `--nfl-id`        |
| `espn_id`       | ESPN ID       | `--espn-id`       |
| `sportradar_id` | Sportradar ID | `--sportradar-id` |

### Reference IDs

| ID Type        | Platform               | CLI Flag         |
| -------------- | ---------------------- | ---------------- |
| `pfr_id`       | Pro-Football-Reference | `--pfr-id`       |
| `rotowire_id`  | RotoWire               | `--rotowire-id`  |
| `rotoworld_id` | RotoWorld              | `--rotoworld-id` |
| `otc_id`       | Over The Cap           | `--otc-id`       |

### DFS IDs

| ID Type         | Platform   | CLI Flag          |
| --------------- | ---------- | ----------------- |
| `draftkings_id` | DraftKings | `--draftkings-id` |
| `fanduel_id`    | FanDuel    | `--fanduel-id`    |
| `rts_id`        | RTS        | `--rts-id`        |

## Import Scripts

Scripts for bulk importing player data:

| Script                                | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `scripts/import-players-sleeper.mjs`  | Import from Sleeper API            |
| `scripts/import-players-espn.mjs`     | Import from ESPN                   |
| `scripts/import-players-nfl.mjs`      | Import from NFL.com                |
| `scripts/import-players-nflverse.mjs` | Import from nflverse data          |
| `scripts/import-players-pfr.mjs`      | Import from Pro-Football-Reference |

## Troubleshooting

### Duplicate Players

1. Use `lookup` command to identify duplicates
2. Compare external IDs between records
3. Use `merge` command to consolidate:
   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs merge \
     --keep-pid "CORRECT-PID" \
     --remove-pid "DUPLICATE-PID"
   ```

### Name Matching Issues

1. Add aliases for alternate names:

   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs add-alias \
     --pid "PATR-MAHO-2017-1995-09-17" \
     --alias "Patrick Mahomes II"
   ```

2. Names are normalized (lowercase, no punctuation) for matching

### Missing External IDs

1. Use `lookup --sources all` to discover IDs from all sources
2. Update player with discovered IDs
3. External IDs improve matching accuracy across data imports

### Player Not Found in Sources

1. Check if player is too new (Sleeper updates weekly)
2. Try alternate name spellings
3. Search by team to narrow results
4. Create manually if confirmed new player
