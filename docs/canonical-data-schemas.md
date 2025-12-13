# Canonical Data Schemas

This document provides comprehensive documentation for the external fantasy leagues canonical data format schemas. These schemas define the unified data structure that all platform adapters transform their data into, ensuring consistency across platforms like Sleeper, ESPN, Yahoo, MFL, and others.

## Overview

The canonical data format system consists of 5 core schemas that work together to represent complete fantasy league data:

1. **League Format** - League configuration and settings
2. **Team Format** - Team information and ownership
3. **Roster Format** - Player assignments and roster composition
4. **Transaction Format** - Trades, waivers, and roster moves
5. **Player Format** - Player identification and metadata

## Schema Architecture

### Version Control

- **Current Version**: 1.0.0
- **Schema Location**: `/schemas/`
- **Validation Library**: AJV (JSON Schema validator)
- **Caching**: 5-minute schema cache for performance

### Common Definitions

To reduce duplication and ensure consistency, schemas use shared definitions:

- **`platform_enum`**: Standardized platform identifier enum (SLEEPER, ESPN, YAHOO, etc.) - referenced via `$ref: "#/definitions/platform_enum"`
- **`player_ids`**: Cross-platform player identifier structure - referenced via `$ref: "#/definitions/player_ids"`

These definitions are defined in each schema's `definitions` section and ensure that platform codes and player ID structures remain consistent across all schemas.

### Terminology Standards

- **Practice Squad**: Use `practice_squad` field (not `taxi_squad`)
- **Platform Codes**: Uppercase format (e.g., `SLEEPER`, `ESPN`, `YAHOO`)
- **Status Values**: Uppercase with underscores (e.g., `ACTIVE`, `INJURED_RESERVE`)
- **Team Identifiers**: Use `external_team_id` consistently (must match across league, roster, and transaction formats)
- **Common Definitions**: Schemas use shared definitions for `platform_enum` and `player_ids` to ensure consistency

## Schema Definitions

### 1. Canonical League Format

**File**: `schemas/canonical-league-format.json`  
**Purpose**: Defines the complete structure for fantasy league configuration data.

#### Key Fields

```json
{
  "external_id": "string", // Platform's league identifier
  "platform": "SLEEPER|ESPN|...", // Platform code (uppercase)
  "name": "string", // League name
  "year": "number", // NFL season year
  "settings": {
    "num_teams": "number", // Number of teams (8-32)
    "season_type": "REDRAFT|KEEPER|DYNASTY",
    "playoff_teams": "number", // Teams making playoffs
    "playoff_week_start": "number", // First playoff week
    "regular_season_waiver_type": "FAAB|PRIORITY|NONE",
    "trade_deadline": "number", // Week of trade deadline
    "playoff_bracket_type": "SINGLE_ELIMINATION|DOUBLE_ELIMINATION",
    "playoff_reseeding_enabled": "boolean",
    "consolation_bracket_enabled": "boolean",
    "divisions_enabled": "boolean",
    "division_count": "number",
    "max_keepers": "number", // Max keeper players (0 for redraft)
    "keeper_deadline_week": "number|null",
    "free_agent_draft_type": "SNAKE_DRAFT|LINEAR_DRAFT|AUCTION"
  },
  "scoring_settings": {
    "passing_yards": "number", // Points per passing yard (e.g., 0.04)
    "passing_touchdowns": "number", // Points per passing TD (e.g., 4)
    "passing_completions": "number", // Points per completion (default: 0)
    "passing_interceptions": "number", // Points per interception (usually negative, e.g., -2)
    "rushing_yards": "number", // Points per rushing yard (e.g., 0.1)
    "rushing_touchdowns": "number", // Points per rushing TD (e.g., 6)
    "receiving_yards": "number", // Points per receiving yard (e.g., 0.1)
    "receiving_touchdowns": "number", // Points per receiving TD (e.g., 6)
    "receptions": "number", // Points per reception - PPR (e.g., 1.0 for full PPR)
    "fumbles_lost": "number" // Points per fumble lost (usually negative)
    // ... many more IDP and special scoring settings available
  },
  "roster_slots": [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "RB_WR_TE_FLEX",
    "BN",
    "BN",
    "IR"
    // Array of roster slot positions in order (see enum values below)
  ],
  "teams": [
    {
      "external_team_id": "string", // Platform-specific team identifier
      "owner_id": "string", // Platform user ID of team owner
      "name": "string", // Team name
      "avatar": "string|null", // URL or identifier for team avatar
      "is_commissioner": "boolean", // Whether owner is commissioner
      "division": "string|null", // Division name if applicable
      "draft_position": "number|null", // Draft position
      "waiver_priority": "number|null", // Current waiver priority
      "faab_balance": "number|null" // Remaining FAAB budget
    }
  ],
  "platform_data": "object" // Original platform data for reference
}
```

#### Platform-Specific Notes

**Sleeper**:

- Uses `total_rosters` for `num_teams`
- Maps `settings.draft_type: 1` → `SNAKE_DRAFT`, `0` → `LINEAR_DRAFT`
- Extracts scoring from `scoring_settings` object
- Team objects in `teams` array use `external_team_id` matching `user_id`

**ESPN**:

- Uses `settings.size` for `num_teams`
- Maps complex `scoringSettings` array to canonical format
- Extracts roster slots from `rosterSettings.lineupSlotCounts`
- Team objects in `teams` array use `external_team_id` matching team `id`

### 2. Canonical Team Format

**File**: `schemas/canonical-team-format.json`  
**Purpose**: Defines team information including ownership and performance.

#### Key Fields

```json
{
  "external_team_id": "string", // Platform-specific unique identifier for the team
  "platform": "SLEEPER|ESPN|...", // Platform code (references platform_enum definition)
  "league_external_id": "string", // Platform-specific league identifier
  "team_owner_ids": ["string"], // Array of platform-specific owner IDs (supports co-ownership)
  "team_name": "string", // Team name as displayed on the platform
  "team_avatar_url": "string|null", // URL to team's avatar/logo image
  "division_name": "string|null", // Division name if league has divisions
  "division_external_id": "string|null", // Platform-specific division identifier
  "draft_position": "number|null", // Draft position/pick order for this team
  "current_waiver_priority": "number|null", // Current waiver priority if using priority waivers
  "current_faab_balance": "number|null", // Remaining FAAB budget if using FAAB waivers
  "current_salary_cap_used": "number|null", // Currently used salary cap amount
  "current_salary_cap_available": "number|null", // Remaining salary cap space
  "total_roster_spots": "number|null", // Total number of roster spots
  "filled_roster_spots": "number|null", // Number of currently filled roster spots
  "team_status": "ACTIVE|INACTIVE|ARCHIVED|SUSPENDED", // Current status of the team
  "join_date": "string|null", // ISO date-time when team/owner joined the league
  "last_activity_date": "string|null", // ISO date-time of last recorded activity
  "platform_data": "object" // Original platform-specific data preserved for reference
}
```

### 3. Canonical Roster Format

**File**: `schemas/canonical-roster-format.json`  
**Purpose**: Defines player assignments and roster composition with cross-platform player identification.

#### Key Fields

```json
{
  "external_roster_id": "string", // Platform-specific unique identifier for this roster snapshot
  "platform": "SLEEPER|ESPN|...", // Platform code (references platform_enum definition)
  "league_external_id": "string", // Platform-specific unique identifier for the league
  "team_external_id": "string", // Platform-specific unique identifier for the team (must match external_team_id from league teams array)
  "week": "number", // NFL week number (0 for offseason/preseason rosters)
  "year": "number", // NFL season year
  "roster_snapshot_date": "string|null", // ISO date-time when this roster snapshot was taken
  "players": [
    {
      "player_ids": {
        // References player_ids definition - cross-platform identifiers
        "sleeper_id": "string|null",
        "espn_id": "integer|null",
        "yahoo_id": "integer|null",
        "mfl_id": "integer|null",
        "cbs_id": "integer|null",
        "fleaflicker_id": "integer|null",
        "nfl_id": "integer|null",
        "rts_id": "integer|null",
        "fantasy_data_id": "integer|null",
        "rotowire_id": "integer|null"
      },
      "roster_slot": "string|null", // Roster slot assignment (must match roster_slots from league format, null for bench/unassigned)
      "roster_slot_category": "STARTING|BENCH|INJURED_RESERVE|PRACTICE_SQUAD",
      "acquisition_date": "string|null", // ISO date-time when player was acquired
      "acquisition_type": "DRAFT|WAIVER|FREE_AGENT|TRADE|KEEPER|null",
      "acquisition_cost": "number|null", // Cost to acquire (FAAB, draft pick value, etc.)
      "current_salary": "number|null", // Current salary if salary cap league
      "contract_years_remaining": "number|null", // Years remaining on contract
      "is_locked": "boolean", // Whether player is locked and cannot be moved
      "keeper_eligible": "boolean", // Whether player is eligible to be kept
      "protection_status": "PROTECTED|UNPROTECTED|FRANCHISE_TAGGED|null",
      "extension_count": "number", // Number of times player has been extended/re-signed
      "tag_type": "NONE|FRANCHISE|ROOKIE|RESTRICTED_FREE_AGENT|KEEPER",
      "tag_details": {
        "tag_cost": "number|null",
        "tag_duration": "number|null",
        "tag_restrictions": ["string"]
      },
      "trade_block_status": "AVAILABLE|ON_BLOCK|UNTRADEABLE"
    }
  ],
  "keeper_designations": [
    {
      "player_ids": {
        // References player_ids definition
      },
      "keeper_round": "number|null", // Draft round cost for keeping this player
      "keeper_salary": "number|null" // Salary cost for keeping if salary cap league
    }
  ],
  "roster_moves_remaining": "number|null", // Number of roster moves/acquisitions remaining
  "trades_remaining": "number|null", // Number of trades remaining
  "total_salary_committed": "number|null", // Total salary committed if salary cap league
  "available_salary_cap_space": "number|null", // Remaining salary cap space
  "roster_lock_status": "UNLOCKED|LOCKED", // Whether roster changes are locked
  "auto_start_enabled": "boolean", // Whether auto-start optimal lineup is enabled
  "platform_data": "object" // Original platform-specific data preserved for reference
}
```

#### Important Notes

- **Cross-Platform IDs**: The `player_ids` object (defined as a common definition) contains identifiers for all supported platforms, with `null` for unavailable IDs
- **Team ID Consistency**: The `team_external_id` field must match `external_team_id` from the league's teams array
- **Roster Slots**: The `roster_slot` field must match one of the values defined in the league's `roster_slots` array
- **Roster Slot Categories**: Use enum values (`STARTING`, `BENCH`, `INJURED_RESERVE`, `PRACTICE_SQUAD`) for consistent categorization
- **Keeper Designations**: Use the `keeper_designations` array with `player_ids` and keeper cost information

### 4. Canonical Transaction Format

**File**: `schemas/canonical-transaction-format.json`  
**Purpose**: Defines all types of roster transactions including trades, waivers, and free agent pickups.

#### Key Fields

```json
{
  "external_transaction_id": "string", // Platform-specific unique identifier for this transaction
  "platform": "SLEEPER|ESPN|...", // Platform code (references platform_enum definition)
  "league_external_id": "string", // Platform-specific unique identifier for the league
  "transaction_type": "TRADE|WAIVER_CLAIM|FREE_AGENT_PICKUP|DROP|ADD_DROP|DRAFT_PICK|KEEPER_SELECTION|COMMISSIONER_ACTION|EXTENSION|FRANCHISE_TAG|ROSTER_MOVE",
  "transaction_date": "string", // ISO date-time when the transaction occurred
  "year": "number", // NFL season year for this transaction
  "week": "number|null", // NFL week when transaction occurred (0 for offseason)
  "transaction_status": "PENDING|PROCESSING|COMPLETED|CANCELLED|FAILED|VETOED",
  "effective_date": "string|null", // ISO date-time when transaction takes effect (for delayed transactions)
  "processing_date": "string|null", // ISO date-time when transaction was processed/approved
  "involved_teams": [
    {
      "team_external_id": "string", // Platform-specific team identifier (must match external_team_id from league teams array)
      "team_role": "SENDER|RECEIVER|BIDDER|INITIATOR|TARGET"
    }
  ],
  "player_moves": [
    {
      "player_ids": {
        // References player_ids definition - cross-platform identifiers
      },
      "from_team_external_id": "string|null", // Team player is leaving (null for free agent pickups, must match external_team_id)
      "to_team_external_id": "string|null", // Team player is joining (null for drops, must match external_team_id)
      "roster_slot": "string|null", // Roster slot assignment after transaction (must match roster_slots from league format)
      "salary_impact": "number|null" // Salary cap impact for this player move
    }
  ],
  "draft_pick_moves": [
    {
      "from_team_external_id": "string", // Team trading away the pick (must match external_team_id)
      "to_team_external_id": "string", // Team receiving the pick (must match external_team_id)
      "pick_year": "number", // Year of the draft pick
      "pick_round": "number", // Round of the draft pick
      "pick_number": "number|null", // Specific pick number if known
      "original_owner_team_external_id": "string|null" // Original owner before any trades (must match external_team_id)
    }
  ],
  "waiver_details": {
    "waiver_priority": "number|null", // Waiver priority when claim was made
    "bid_amount": "number|null", // FAAB bid amount
    "claim_date": "string|null", // ISO date-time when waiver claim was submitted
    "process_date": "string|null" // ISO date-time when waivers processed
  },
  "trade_details": {
    "trade_deadline_eligible": "boolean", // Whether trade was made before deadline
    "trade_review_period": "number|null", // Review period in days before trade processes
    "votes_for": "number|null", // Number of votes in favor
    "votes_against": "number|null", // Number of votes against
    "veto_threshold": "number|null" // Number of votes needed to veto
  },
  "commissioner_details": {
    "commissioner_user_id": "string|null", // Platform-specific ID of commissioner
    "reason": "string|null", // Reason for commissioner action
    "original_transaction_id": "string|null" // ID of original transaction being overridden
  },
  "salary_details": {
    "total_salary_impact": "number|null", // Net salary cap impact
    "extension_details": {
      "extension_years": "number|null",
      "extension_amount": "number|null",
      "extension_type": "STANDARD|FRANCHISE_TAG|ROOKIE_EXTENSION|VETERAN_EXTENSION|null"
    }
  },
  "transaction_notes": "string|null", // Additional notes or comments
  "platform_data": "object" // Original platform-specific data preserved for reference
}
```

#### Transaction Type Mappings

| Platform | Platform Value | Standard Value      |
| -------- | -------------- | ------------------- |
| Sleeper  | `trade`        | `TRADE`             |
| Sleeper  | `waiver`       | `WAIVER_CLAIM`      |
| Sleeper  | `free_agent`   | `FREE_AGENT_PICKUP` |
| ESPN     | `TRADE`        | `TRADE`             |
| ESPN     | `WAIVER`       | `WAIVER_CLAIM`      |
| ESPN     | `FREEAGENT`    | `FREE_AGENT_PICKUP` |

### 5. Canonical Player Format

**File**: `schemas/canonical-player-format.json`  
**Purpose**: Defines player identification and metadata across all platforms.

#### Key Fields

```json
{
  "player_ids": {
    // References player_ids definition - cross-platform identifiers
    "sleeper_id": "string|null",
    "espn_id": "integer|null",
    "yahoo_id": "integer|null",
    "mfl_id": "integer|null",
    "cbs_id": "integer|null",
    "fleaflicker_id": "integer|null",
    "nfl_id": "integer|null",
    "rts_id": "integer|null",
    "fantasy_data_id": "integer|null",
    "rotowire_id": "integer|null"
  },
  "platform": "SLEEPER|ESPN|...", // Platform code (references platform_enum definition)
  "player_name": "string", // Player's full name as displayed on the platform
  "first_name": "string|null", // Player's first name
  "last_name": "string|null", // Player's last name
  "position": "QB|RB|WR|TE|K|DST|DE|DT|OLB|MLB|CB|FS|SS|DL|LB|DB|null", // Primary position
  "positions": ["string"], // All positions player is eligible for
  "team_abbreviation": "string|null", // Current NFL team abbreviation (e.g., 'TB', 'KC', 'BUF', null for free agents)
  "jersey_number": "number|null", // Player's jersey number (0-99)
  "age": "number|null", // Player's age (18-50)
  "height": "string|null", // Player's height (e.g., '6-2', '5-11')
  "weight": "number|null", // Player's weight in pounds (100-400)
  "college": "string|null", // Player's college
  "years_experience": "number|null", // Years of NFL experience
  "rookie_year": "number|null", // Year player entered the NFL
  "roster_status": "ACTIVE|INACTIVE|INJURED_RESERVE|PRACTICE_SQUAD|SUSPENDED|RETIRED|FREE_AGENT",
  "game_designation": "OUT|QUESTIONABLE|DOUBTFUL|PROBABLE|null",
  "injury_notes": "string|null", // Details about player's injury
  "bye_week": "number|null", // Player's bye week for current season (1-18)
  "fantasy_positions": [
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DST",
    "IDP",
    "DL",
    "LB",
    "DB"
  ], // Positions eligible in fantasy
  "season_projections": {
    "fantasy_points": "number|null",
    "passing_yards": "number|null",
    "passing_touchdowns": "number|null",
    "rushing_yards": "number|null",
    "rushing_touchdowns": "number|null",
    "receiving_yards": "number|null",
    "receiving_touchdowns": "number|null",
    "receptions": "number|null"
  },
  "season_stats": {
    "fantasy_points": "number|null",
    "games_played": "number|null",
    "passing_yards": "number|null",
    "passing_touchdowns": "number|null",
    "rushing_yards": "number|null",
    "rushing_touchdowns": "number|null",
    "receiving_yards": "number|null",
    "receiving_touchdowns": "number|null",
    "receptions": "number|null"
  },
  "news": [
    {
      "headline": "string",
      "summary": "string|null",
      "timestamp": "string", // ISO date-time
      "source": "string|null"
    }
  ],
  "platform_data": "object" // Original platform-specific data preserved for reference
}
```

## Implementation Guidelines

### Schema Validation Integration

```javascript
import { schema_validator } from '../utils/schema-validator.mjs'

// Validate league data
const league_validation = await schema_validator.validate_league(league_data)
if (!league_validation.valid) {
  console.warn('League validation failed:', league_validation.errors)
}

// Validate roster data
const roster_validation = await schema_validator.validate_roster(roster_data)
if (!roster_validation.valid) {
  console.warn('Roster validation failed:', roster_validation.errors)
}
```

### Performance Considerations

1. **Sample Validation**: For large datasets (>100 items), validate a sample rather than all items
2. **Schema Caching**: Schemas are cached for 5 minutes to improve performance
3. **Timeout Limits**: Validation operations timeout after 5 seconds
4. **Batch Processing**: Use `validate_batch()` for multiple items of the same type

### Error Handling

```javascript
// Validation returns detailed error information
const validation = await schema_validator.validate_league(data)
if (!validation.valid) {
  validation.errors.forEach((error) => {
    console.log(`Field: ${error.instancePath}`)
    console.log(`Error: ${error.message}`)
    console.log(`Schema: ${error.schemaPath}`)
  })
}
```

## Platform-Specific Transformation Notes

### Position Mapping

| Sleeper | ESPN | Yahoo | Standard |
| ------- | ---- | ----- | -------- |
| `QB`    | `1`  | `QB`  | `QB`     |
| `RB`    | `2`  | `RB`  | `RB`     |
| `WR`    | `3`  | `WR`  | `WR`     |
| `TE`    | `4`  | `TE`  | `TE`     |
| `K`     | `5`  | `K`   | `K`      |
| `DEF`   | `16` | `DEF` | `DST`    |

### Status Mapping

| Sleeper           | ESPN             | Standard       |
| ----------------- | ---------------- | -------------- |
| `Active`          | `ACTIVE`         | `ACTIVE`       |
| `Injured Reserve` | `INJURY_RESERVE` | `IR`           |
| `Out`             | `OUT`            | `OUT`          |
| `Questionable`    | `QUESTIONABLE`   | `QUESTIONABLE` |
| `Doubtful`        | `DOUBTFUL`       | `DOUBTFUL`     |

### Authentication Requirements

- **Sleeper**: No authentication required
- **ESPN**: Cookie-based auth for private leagues (`espn_s2` + `SWID`)
- **Yahoo**: OAuth2 authentication required
- **MFL**: API key authentication
- **Fleaflicker**: No authentication required

## Migration Guide

### From Internal Format to Canonical Format

If migrating from an existing internal format:

1. **Update Adapter Returns**: Ensure all adapter methods return canonical format
2. **Add Schema Validation**: Integrate schema validation in all data methods
3. **Update Field Names**:
   - Change `taxi_squad` → `practice_squad`
   - Use `external_team_id` consistently (not `team_id` in league format teams)
   - Use `team_external_id` in roster/transaction formats (must match `external_team_id`)
4. **Platform Codes**: Use uppercase platform codes via `platform_enum` definition (`SLEEPER`, `ESPN`)
5. **Cross-Platform IDs**: Implement `player_ids` object structure using the common definition
6. **Status Values**: Use uppercase status enums (`ACTIVE`, `IR`, `INJURED_RESERVE`)
7. **Roster Slots**: Use array of strings (not objects) matching enum values from schema

### Testing Migration

```javascript
// Test that old and new formats are equivalent
const old_data = legacy_adapter.get_league(league_id)
const new_data = standard_adapter.get_league(league_id)

// Validate new format against schema
const validation = await schema_validator.validate_league(new_data)
assert(validation.valid, 'New format must pass validation')

// Test key data preservation
assert.equal(new_data.teams.length, old_data.teams.length)
```

## Schema Updates and Versioning

### Version History

- **1.0.0** (2024-08-04): Initial canonical format schemas

### Making Schema Changes

1. **Backward Compatibility**: Maintain compatibility when adding optional fields
2. **Version Bumps**: Increment version for breaking changes
3. **Migration Scripts**: Provide data migration utilities for breaking changes
4. **Documentation**: Update this document with schema changes

### Future Schema Additions

Planned schema enhancements:

- **Salary Cap Schema**: For salary cap league support
- **Contract Schema**: For dynasty league contract management
- **Draft Schema**: For draft-specific data structures
- **Playoff Schema**: For playoff bracket and matchup data

## Troubleshooting

### Common Validation Errors

1. **Missing Required Fields**: Ensure all required schema fields are present
2. **Type Mismatches**: Check data types match schema (string vs number)
3. **Enum Values**: Use exact enum values (e.g., `ACTIVE` not `active`)
4. **Date Formats**: Use ISO 8601 date strings
5. **Practice Squad**: Use `practice_squad` not `taxi_squad`

### Performance Issues

1. **Large Datasets**: Use sample validation for >100 items
2. **Schema Loading**: Schemas are cached - first load may be slower
3. **Timeout Errors**: Increase validation timeout if needed
4. **Memory Usage**: Clear schema cache periodically in long-running processes

### Platform Integration Issues

1. **Authentication**: Verify correct auth method for each platform
2. **Rate Limiting**: Respect platform-specific rate limits
3. **Data Availability**: Some platforms have limited data endpoints
4. **Field Mapping**: Check platform-specific transformation configs

## Support and Contributing

### Reporting Issues

- Schema validation failures: Include sample data and validation errors
- Performance issues: Include dataset size and timing information
- Platform-specific problems: Include platform name and data structures

### Contributing Schema Changes

1. Update JSON schema files in `/schemas/`
2. Update transformation configs in `/libs-server/external-fantasy-leagues/external-platforms.json`
3. Add tests for new schema features
4. Update this documentation

### Resources

- [JSON Schema Documentation](https://json-schema.org/)
- [AJV Validator Documentation](https://ajv.js.org/)
- [Platform API Documentation](../README.md#platform-apis)
