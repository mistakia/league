# Platform Collectors

This directory contains tools for collecting raw API responses from external fantasy league platforms and saving them as test fixtures.

## Architecture Overview

### Collectors vs Adapters

**Collectors** (this directory):

- Purpose: Collect raw platform API responses for test fixtures
- Output: Raw platform responses (optionally anonymized) saved as JSON fixtures
- Use case: Generating test data, updating fixtures, debugging platform APIs

**Adapters** (`libs-server/external-fantasy-leagues/adapters/`):

- Purpose: Transform platform-specific data into canonical format for production use
- Output: Canonical format data ready for sync operations
- Use case: Production league imports, data synchronization

### File Organization

```
platform-collectors/
├── base-collector.mjs          # Abstract base class for all collectors
├── fixture-utils.mjs            # Shared utilities for fixture management
├── platform-collector-template.mjs  # Template for creating new collectors
├── espn-collector.mjs           # ESPN-specific collector
├── sleeper-collector.mjs        # Sleeper-specific collector
├── yahoo-collector.mjs          # Yahoo collector (stub)
├── mfl-collector.mjs            # MFL collector (stub)
├── fetch-external-league.mjs    # CLI tool using adapters (production)
└── README.md                    # This file
```

### Key Concepts

#### Response Types

- **Config Keys**: Internal identifiers used in code (e.g., `'league'`, `'rosters'`)
- **Normalized Types**: File-safe names for fixtures (e.g., `'league-config'`, `'rosters'`)
- The `normalize_response_type_for_path()` function converts between them

#### Fixture Structure

All fixtures follow a standardized structure:

```json
{
  "platform": "sleeper",
  "response_type": "league-config",
  "collected_at": "2024-01-01T00:00:00.000Z",
  "anonymized": true,
  "data": {
    /* raw platform response */
  },
  "season_year": 2024,
  "league_id": "123456789"
}
```

## Usage

### Using Individual Collectors

Each platform has a dedicated collector class that extends `BaseCollector`:

```javascript
import { SleeperCollector } from './platform-collectors/sleeper-collector.mjs'

const collector = new SleeperCollector({
  anonymize: true,
  save_to_fixtures: true
})

await collector.authenticate(credentials)
const fixture_data = await collector.collect_league_config(league_id)
```

### Using Collection Scripts

#### Generic Collection Script

```bash
# Collect all response types for a platform
node scripts/collect-platform-responses.mjs single sleeper 123456789

# With options
node scripts/collect-platform-responses.mjs single espn 987654 \
  --credentials-file ./creds.json \
  --include-edge-cases
```

#### Platform-Specific Scripts

```bash
# Collect ESPN fixtures
node scripts/collect-espn-fixtures.mjs \
  --league-id 987654 \
  --season-year 2024 \
  --espn-s2 <cookie> \
  --swid <cookie>

# Collect Sleeper fixtures
node scripts/collect-sleeper-fixtures.mjs \
  --league-id 123456789 \
  --week 1
```

### Creating New Collectors

1. Copy `platform-collector-template.mjs` to `[platform]-collector.mjs`
2. Replace all `[PLATFORM]` placeholders
3. Implement required methods:
   - `authenticate()` - Platform authentication
   - `collect_league_config()` - League configuration
   - `collect_rosters()` - Team rosters
   - `collect_players()` - Player data (if applicable)
   - `collect_transactions()` - Transaction history
   - `anonymize_data()` - Platform-specific anonymization
4. Register in `scripts/collect-platform-responses.mjs`
5. Test with real platform API

## Terminology

- **league_id**: Platform-specific league identifier (snake_case, consistent with codebase)
- **response_type**: Config key for response type (e.g., `'league'`, `'rosters'`)
- **normalized_type**: File-safe name (e.g., `'league-config'`, `'rosters'`)
- **season_year**: Optional season year parameter (platform-specific)
- **fixture**: Saved test data file in standardized format

## Best Practices

1. **Always anonymize** sensitive data before saving fixtures
2. **Use consistent naming** - snake_case for variables, kebab-case for file paths
3. **Document platform quirks** in `get_platform_info()` method
4. **Handle errors gracefully** - Collectors should log errors but not crash
5. **Respect rate limits** - Use delays between requests when needed
6. **Keep fixtures updated** - Regenerate fixtures when platform APIs change

## Related Files

- `test/fixtures/external-fantasy-leagues/platform-responses/` - Saved fixture files
- `libs-server/external-fantasy-leagues/adapters/` - Production adapters
- `scripts/collect-platform-responses.mjs` - Generic collection script
- `scripts/collect-espn-fixtures.mjs` - ESPN-specific collection script
- `scripts/collect-sleeper-fixtures.mjs` - Sleeper-specific collection script
