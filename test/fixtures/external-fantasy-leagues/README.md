# External Fantasy Leagues Test Fixtures

Test fixtures for external fantasy league integration using the Canonical Format approach. Fixtures contain anonymized real platform API responses for testing canonical format transformation and schema validation.

## Fixture Design Principles

1. **Minimal representative data** - Fixtures contain only enough data to test all transformation code paths
2. **Anonymized real data** - Actual API responses with personal information removed
3. **Schema-driven validation** - All transformed data validates against canonical format JSON schemas
4. **Cross-platform consistency** - Both Sleeper and ESPN fixtures validate against identical schemas

## Directory Structure

```
external-fantasy-leagues/
├── platform-responses/
│   ├── sleeper/               # Sleeper API fixtures (~310 KB total)
│   │   ├── league-config.json # League settings
│   │   ├── rosters.json       # Roster assignments
│   │   ├── transactions.json  # Transaction history
│   │   ├── players.json       # 33 representative players
│   │   └── users.json         # User/owner data
│   └── espn/                  # ESPN API fixtures (~126 KB total)
│       ├── league-config.json # League with 5 sample players
│       ├── rosters.json       # Roster metadata
│       ├── transactions.json  # Transaction history
│       └── players.json       # 5 sample players
├── expected-outputs/
│   ├── transaction-mappings.json  # Transaction transformation tests
│   └── player-mappings-sleeper.json # Player transformation tests
├── database-states/
│   └── initial-players.json   # Initial database state
└── player-mapper-test-data.json # Player mapper unit test data
```

## Fixture Files

### Sleeper Platform

| File                 | Size   | Purpose                                                |
| -------------------- | ------ | ------------------------------------------------------ |
| `league-config.json` | 14 KB  | League settings, scoring, roster configuration         |
| `rosters.json`       | 40 KB  | Complete roster assignments for 12-team league         |
| `transactions.json`  | 187 KB | Transaction history (trades, waivers, adds/drops)      |
| `players.json`       | 54 KB  | 33 players covering QB, RB, WR, TE, K, DEF, LB, DL, DB |
| `users.json`         | 8 KB   | League member information                              |

### ESPN Platform

| File                 | Size   | Purpose                                  |
| -------------------- | ------ | ---------------------------------------- |
| `league-config.json` | 58 KB  | League with 5 sample player entries      |
| `rosters.json`       | 4.5 KB | Roster metadata (members, teams, status) |
| `transactions.json`  | 6 KB   | Transaction samples                      |
| `players.json`       | 58 KB  | 5 sample player entries                  |

### Expected Outputs

| File                           | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `transaction-mappings.json`    | Expected canonical format for transaction types      |
| `player-mappings-sleeper.json` | Expected canonical format for player transformations |

## Usage

### Loading Fixtures

```javascript
import fs from 'fs/promises'

const sleeper_league = JSON.parse(
  await fs.readFile('./platform-responses/sleeper/league-config.json', 'utf8')
)
```

### Testing Canonical Format Transformation

```javascript
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'
import { schema_validator } from '#libs-server/external-fantasy-leagues/utils/schema-validator.mjs'

const adapter = new SleeperAdapter()
const canonical_league = await adapter.get_league('test_league')
const validation = await schema_validator.validate_league(canonical_league)
assert(validation.valid)
```

## Data Anonymization

Fixtures use anonymized real data:

- **User IDs** - Generic identifiers (e.g., `{083EC1C6-922C-4DEB-9B54-7A8E44DC47E1}`)
- **Display names** - Generic names (e.g., `EspnUser1`, `Tjpell21`)
- **League names** - Preserved when non-identifying
- **Player data** - Real NFL player data (public information)

## Canonical Format Schemas

Fixtures validate against these schemas in `schemas/`:

1. `canonical-league-format.json` - League configuration
2. `canonical-team-format.json` - Team information
3. `canonical-roster-format.json` - Roster assignments
4. `canonical-transaction-format.json` - Transactions
5. `canonical-player-format.json` - Player data

## Terminology

- Use `practice_squad` (not `taxi_squad`) in all canonical format data
- Use `external_roster_id` (not `external_id`) for roster identifiers
- Use `external_team_id` (not `team_id`) for team identifiers in league format teams array
- Use `team_external_id` in roster and transaction formats (must match `external_team_id` from league teams)
- Use `player_ids` object structure (references common definition in schemas)
- Use `platform_enum` for platform codes (references common definition in schemas)
