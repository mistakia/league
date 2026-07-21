# Player Management

This document provides a comprehensive guide for managing player data in the xo.football platform.

## Quick Reference

| Operation           | Command                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Search database     | `node scripts/resolve-player-match.mjs search --name "Name"`                                                 |
| Multi-source lookup | `node scripts/resolve-player-match.mjs lookup --name "Name" --sources all`                                   |
| Create player       | `node scripts/resolve-player-match.mjs create --first-name "First" --last-name "Last" --primary-position QB` |
| Update player       | `node scripts/resolve-player-match.mjs update --pid "PID" --gsis-player-id "00-0012345"`                     |
| Add alias           | `node scripts/resolve-player-match.mjs add-alias --pid "PID" --alias "Nickname"`                             |
| Merge duplicates    | `node scripts/resolve-player-match.mjs merge --keep-pid "KEEP" --remove-pid "REMOVE"`                        |

## Player ID Format

Player IDs follow the format: `FNAM-LNAM-<serial>`

- **FNAM**: First 4 letters of first name (uppercase, `X`-padded if shorter)
- **LNAM**: First 4 letters of last name (uppercase, `X`-padded if shorter)
- **&lt;serial&gt;**: An opaque, immutable, collision-free ordinal, zero-padded to six digits and allowed to grow (drawn from a dedicated Postgres sequence)

Example: `PATR-MAHO-000123` (Patrick Mahomes)

The `FNAM-LNAM` prefix is a frozen, human-readable courtesy snapshot taken once at mint. It carries **no** referential meaning: it is never recomputed, is allowed to go stale if the person's name is later corrected, and must not be parsed for identity. The `<serial>` is the actual identity — assigned exactly once and never regenerated. A pid does **not** depend on `date_of_birth` or `nfl_draft_year`, so a person can be minted at recruit/college stage before either field exists.

A DST (defense/special teams) pid is the team abbreviation (e.g. `NE`, `DAL`) — a stable non-person pseudo-identifier with no serial.

## Lookup Command

The lookup command searches multiple data sources in parallel to find player information.

### Basic Usage

```bash
# Search all sources (default)
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Patrick Mahomes"

# Search specific sources
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --sources sleeper,espn

# Filter by position and team
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --primary-position QB --team KC
```

### Command Options

| Option               | Alias | Description                              | Default |
| -------------------- | ----- | ---------------------------------------- | ------- |
| `--name`             |       | Player name to search (required)         |         |
| `--team`             |       | NFL team abbreviation filter             |         |
| `--primary-position` |       | Position filter (QB, RB, WR, TE, K, DEF) |         |
| `--draft-year`       |       | Draft year filter                        |         |
| `--sources`          | `-s`  | Data sources to query                    | `all`   |
| `--ignore-cache`     |       | Bypass cached data                       | `false` |

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

| Field              | Description       | Example                                    |
| ------------------ | ----------------- | ------------------------------------------ |
| `first_name`       | First name        | `Patrick`                                  |
| `last_name`        | Last name         | `Mahomes`                                  |
| `primary_position` | Position          | `QB`                                       |
| `date_of_birth`    | Date of birth     | `1995-09-17` (use `0000-00-00` if unknown) |
| `nfl_draft_year`   | Draft/rookie year | `2017`                                     |
| `height`           | Height in inches  | `75`                                       |
| `weight`           | Weight in pounds  | `225`                                      |

### Workflow

1. **Always lookup first** to check for duplicates:

   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Player Name" --primary-position QB
   ```

2. **Use the suggested command** from lookup output, which includes all discovered IDs

3. **If creating manually**, include as many external IDs as available:
   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs create \
     --first-name "First" \
     --last-name "Last" \
     --primary-position QB \
     --team KC \
     --date-of-birth "1995-09-17" \
     --draft-year 2017 \
     --height 75 \
     --weight 225 \
     --sleeper-player-id "12345" \
     --espn-player-id 3139477 \
     --gsis-player-id "00-0033873"
   ```

## Updating Players

Update existing player fields including external IDs:

```bash
# Update team and position
NODE_ENV=production node scripts/resolve-player-match.mjs update \
  --pid "PATR-MAHO-005785" \
  --team KC \
  --primary-position QB

# Add missing external IDs
NODE_ENV=production node scripts/resolve-player-match.mjs update \
  --pid "PATR-MAHO-005785" \
  --gsis-player-id "00-0033873" \
  --gsis-it-player-id "46046" \
  --pfr-player-id "MahoPa00"
```

## External ID Types

### Fantasy Platform IDs

| ID Type                  | Platform        | CLI Flag                   |
| ------------------------ | --------------- | -------------------------- |
| `sleeper_player_id`      | Sleeper         | `--sleeper-player-id`      |
| `yahoo_player_id`        | Yahoo Fantasy   | `--yahoo-player-id`        |
| `mfl_player_id`          | MyFantasyLeague | `--mfl-player-id`          |
| `cbs_player_id`          | CBS Sports      | `--cbs-player-id`          |
| `keeptradecut_player_id` | KeepTradeCut    | `--keeptradecut-player-id` |
| `fleaflicker_player_id`  | Fleaflicker     | `--fleaflicker-player-id`  |
| `underdog_player_id`     | Underdog        | `--underdog-player-id`     |

### Analytics IDs

| ID Type                  | Platform           | CLI Flag                   |
| ------------------------ | ------------------ | -------------------------- |
| `pff_player_id`          | Pro Football Focus | `--pff-player-id`          |
| `fantasy_data_player_id` | FantasyData        | `--fantasy-data-player-id` |

### Official NFL IDs

| ID Type                | Description   | CLI Flag                 |
| ---------------------- | ------------- | ------------------------ |
| `gsis_player_id`       | NFL GSIS ID   | `--gsis-player-id`       |
| `esb_player_id`        | NFL ESB ID    | `--esb-player-id`        |
| `gsis_it_player_id`    | GSIS IT ID    | `--gsis-it-player-id`    |
| `nfl_player_id`        | NFL.com ID    | `--nfl-player-id`        |
| `espn_player_id`       | ESPN ID       | `--espn-player-id`       |
| `sportradar_player_id` | Sportradar ID | `--sportradar-player-id` |

### Reference IDs

| ID Type               | Platform               | CLI Flag                |
| --------------------- | ---------------------- | ----------------------- |
| `pfr_player_id`       | Pro-Football-Reference | `--pfr-player-id`       |
| `rotowire_player_id`  | RotoWire               | `--rotowire-player-id`  |
| `rotoworld_player_id` | RotoWorld              | `--rotoworld-player-id` |
| `otc_player_id`       | Over The Cap           | `--otc-player-id`       |

### DFS IDs

| ID Type                | Platform   | CLI Flag                 |
| ---------------------- | ---------- | ------------------------ |
| `draftkings_player_id` | DraftKings | `--draftkings-player-id` |
| `fanduel_player_id`    | FanDuel    | `--fanduel-player-id`    |
| `rts_player_id`        | RTS        | `--rts-player-id`        |

## Import Scripts

Scripts for bulk importing player data:

| Script                                   | Purpose                            |
| ---------------------------------------- | ---------------------------------- |
| `scripts/import-players-sleeper.mjs`     | Import from Sleeper API            |
| `scripts/import-players-espn.mjs`        | Import from ESPN                   |
| `scripts/import-players-nfl.mjs`         | Import from NFL.com                |
| `scripts/import-players-nflverse.mjs`    | Import from nflverse data          |
| `scripts/import-players-pfr.mjs`         | Import from Pro-Football-Reference |
| `private/scripts/import-players-ngs.mjs` | Import from NGS (NFL Pro API)      |

## Audit and Gamelog Scripts

| Script                                     | Purpose                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| `scripts/audit-player-gamelogs.mjs`        | Compare DB gamelogs against PFR; requires pfr_id on player |
| `scripts/generate-player-gamelogs.mjs`     | Aggregate play stats into player gamelogs                  |
| `scripts/update-player-gsispid.mjs`        | Backfill gsispid on player table from nfl_play_stats       |
| `scripts/archive-nfl-gamebooks.mjs`        | Download NFL gamebook PDFs to `/root/cache/nfl/gamebook/`  |
| `scripts/import-nfl-gamebook-starters.mjs` | Parse gamebooks; write `player_gamelogs.started`           |

### `player_gamelogs.started` provenance

The `started` column is owned by `scripts/import-nfl-gamebook-starters.mjs`. Coverage: 2002-current. Source: NFL gamebook PDFs (the pregame-declared starter list), cached at `/root/cache/nfl/gamebook/{esbid}.pdf` by `scripts/archive-nfl-gamebooks.mjs`. The PDF URL is `https://static.www.nfl.com/image/upload/gamecenter/{shieldid}.pdf`; `nfl_games.shieldid` is populated by `scripts/import-nfl-games-ngs.mjs`. Player resolution: `(team, week, jersey_number) -> gsis_id` via the per-year `roster_weekly_{year}.csv` nflverse release, then `gsis_id -> pid` via `player.gsisid`. Per-game floor: writes are skipped when resolution drops below 95%. Non-starter sweep: each touched esbid has its remaining dressed roster set to `started=false` (`active IS TRUE OR active IS NULL`).

### PFR Audit Workflow

The PFR audit (`audit-player-gamelogs.mjs`) matches gamelogs by `pfr_player_id`, `week`, and `seas_type`. Players without `pfr_player_id` show as "missing gamelogs" even if their data exists.

**PFR ID format**: First 4 letters of last name + first 2 of first name + numeric suffix (e.g., `MahoPa00`). Suffixes increment across all players sharing the prefix, not per position -- verify assignments by checking stat patterns (QB stats vs WR stats).

**Common audit issues**:

- Missing pfr_player_id: use `update --pid PID --pfr-player-id VALUE` to populate
- Stale PFR cache: re-run with `--ignore_cache` to refresh
- Gamelog zeros despite plays existing: check gsisid/gsispid linkage in `nfl_play_stats`

## Troubleshooting

### Duplicate Players

1. Use `lookup` command to identify duplicates
2. Compare external IDs between records
3. Determine canonical record: keep the PID with more relational data (gamelogs, roster entries, transactions); use valid DOB as tiebreaker
4. Use `merge` command to consolidate:
   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs merge \
     --keep-pid "CORRECT-PID" \
     --remove-pid "DUPLICATE-PID"
   ```
5. After merge, add alias for the removed record's name variant to prevent re-creation:
   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs add-alias \
     --pid "CORRECT-PID" \
     --alias "Removed Record Name"
   ```

### Name Matching Issues

1. Add aliases for alternate names:

   ```bash
   NODE_ENV=production node scripts/resolve-player-match.mjs add-alias \
     --pid "PATR-MAHO-005785" \
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
