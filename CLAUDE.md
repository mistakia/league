# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **xo.football**, an open-source fantasy football league management platform featuring live auctions, advanced analytics, betting market integration, and comprehensive data views. Built with React/Redux frontend and Express.js/PostgreSQL backend.

## Development Commands

**Development:**

- `yarn dev` - Start both frontend and API in development mode
- `yarn start` - Frontend development server only
- `yarn start:api` - API development server only

**Code Quality:**

- `yarn lint` - Run ESLint
- `yarn prettier` - Format code with Prettier
- `yarn test --reporter min` - Run all tests with Mocha
- `yarn test --reporter min test/filename.spec.mjs` - Run specific test file

**Build & Deploy:**

- `yarn build` - Build production bundle
- `yarn analyze` - Build with bundle analyzer

**Testing:**

- Individual tests: `yarn test --reporter min test/auth.spec.mjs`
- Test patterns: `yarn test --reporter min test/common.*.spec.mjs`
- Grep patterns: `yarn test --reporter min --grep "should login successfully"`

## Architecture Overview

### Frontend (`/app/`)

**React/Redux with Immutable.js state:**

- Domain-driven modules in `/app/core/` (players, leagues, teams, auction, etc.)
- Each module contains: `actions.js`, `reducer.js`, `sagas.js`, `index.js`
- Centralized selectors in `/app/core/selectors.js` using reselect
- Redux-Saga for async operations and WebSocket handling
- Components in `/app/views/components/` with co-located styles (`.styl`)
- React Router v6 with nested league routes: `/leagues/:lid/...`

**Frontend Import Aliases** (configured in webpack):

- `@core` → `app/core`
- `@libs-shared` → `libs-shared`
- `@constants` → `libs-shared/constants`
- `@components` → `app/views/components`

### Backend (`/api/`)

**Express.js with PostgreSQL:**

- Modular routing: `/api/routes/` with domain-specific files
- Route index exports all route modules from `/api/routes/index.mjs`
- JWT authentication with `express-jwt`
- WebSocket support via `/api/sockets/` (auction, scoreboard, data_view, external-league-import)
- Node-cache for performance optimization (10-min TTL)
- Database access via Knex.js ORM at `req.app.locals.db`

### Shared Libraries

**`libs-shared/`** - Isomorphic code (runs on both client and server):

- Business logic: `roster.mjs`, `calculate-points.mjs`, `calculate-values.mjs`
- Constants: `constants/` subdirectory with season, roster, transaction constants
- Data view field definitions: `data-view-fields-index.mjs`
- League format utilities: `generate-league-format-hash.mjs`, `generate-scoring-format-hash.mjs`

**`libs-server/`** - Server-only code:

- Data source integrations: `espn.mjs`, `sleeper.mjs`, `draftkings/`, `fanduel/`
- Roster operations: `process-poach.mjs`, `process-release.mjs`, `submit-acquisition.mjs`
- Database helpers: `batch-insert.mjs`, `get-data-view-results.mjs`
- External APIs: `sportradar/`, `prizepicks.mjs`, `fantasypros.mjs`

### Database

**PostgreSQL with comprehensive schema:**

- 80+ tables for fantasy football operations (leagues, rosters, trades, waivers)
- NFL data (games, plays, player stats) with partitioned tables
- Betting market integration (props, odds from 10+ sportsbooks)
- Schema managed via SQL dumps, not incremental migrations

**Schema Change Workflow:**

1. Run SQL ALTER commands directly on the production database
2. Export the updated schema using `yarn export:schema`
3. Do NOT commit migration files or SQL commands to the repository
4. The exported schema file (`db/schema.postgres.sql`) becomes the source of truth

## Key Documentation

| Document                                                                             | Description                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [docs/player-management.md](docs/player-management.md)                               | Player lookup, creation, updates, and external ID management |
| [docs/data-views-system.md](docs/data-views-system.md)                               | Dynamic table configuration and data view field definitions  |
| [docs/api-documentation.md](docs/api-documentation.md)                               | API endpoints and authentication                             |
| [docs/glossary.md](docs/glossary.md)                                                 | Fantasy football terminology and abbreviations               |
| [docs/named-formats.md](docs/named-formats.md)                                       | League scoring format definitions                            |
| [docs/fantasy-points-column-definition.md](docs/fantasy-points-column-definition.md) | Fantasy points calculation system                            |

## Key Development Patterns

### ES Modules

- All server-side files use `.mjs` extension
- Import path aliases configured in `package.json` imports field:
  - `#config` → `./config.js`
  - `#db` → `./db/index.mjs`
  - `#libs-server` → `./libs-server/index.mjs`
  - `#libs-shared` → `./libs-shared/index.mjs`
  - `#constants` → `./libs-shared/constants/index.mjs`

### Configuration

- Environment-based config: `config.js` loads `config.{NODE_ENV}.js`
- Separate configs for development, production, test environments

### Code Style

- Prettier config: single quotes, no semicolons, no trailing commas
- ESLint: extends standard, camelcase off, curly off
- Components use functional patterns with hooks

### Scripts & Jobs

**Located in `/scripts/`:**

- Data imports: projections, odds, player data, NFL games/plays
- League processing: waivers, matchups, trades, roster operations
- Calculations: points, values, baselines, percentiles
- Maintenance: backups, auditing, cleanup

**Background jobs in `/jobs/`:**

- `finalize-week.mjs` - End-of-week processing (scheduled via crontab-worker-1.cron)
- `import-live-odds-worker.mjs` - Continuous odds import with per-bookmaker throttling (PM2)
- `import-live-plays-worker.mjs` - Continuous live play import with per-game finalization (PM2)

**Cron schedules in `/server/crontab-*.cron`** for different server roles

### Testing

- Mocha with Chai assertions
- Test files: `test/*.spec.mjs`
- Global setup in `test/global.mjs` drops all tables, loads schema, runs seeds
- MockDate for time-dependent tests
- Environment: `NODE_ENV=test`, timezone: `America/New_York`

### League Context

Most operations occur within league context (`/leagues/:lid/`). Check user permissions for team operations using helper functions from `libs-server/verify-user-team.mjs` and related utilities.

### Poaching System

**Practice Squad Poaching:**

Teams can poach players from other teams' practice squads with automatic roster space handling:

- **Normal Flow**: Poached player added to bench, removed from original team
- **Immediate Release Flow**: When poaching team lacks space (after designated releases):
  1. Creates `POACHED` transaction (preserves history)
  2. Immediately releases player to waivers via `processRelease()`
  3. Marks poach as successful (not failed)

**Super Priority System:**

When a poached player is released, `handle_super_priority_on_release()` (in `process-release.mjs`) automatically:

- Creates `super_priority` record tracking eligibility
- **Auto-creates waiver** (type: `FREE_AGENCY_PRACTICE`) if original team has practice squad space
- **Requires manual waiver** if no space available

This preserves transaction history and gives original teams first rights to reclaim poached players.

**Key Files**:

- `/libs-server/process-poach.mjs` - Poach orchestration
- `/libs-server/process-release.mjs` - Super priority handling

### Real-time Features

WebSocket endpoints in `/api/sockets/`:

- `auction.mjs` - Live auction bidding
- `scoreboard.mjs` - Scoreboard updates
- `data_view.mjs` - Data view synchronization
- `external-league-import.mjs` - External league import progress

## Data Flow Patterns

### API Requests

- Standard pattern: Express route → database query → response
- Authentication via JWT tokens
- Rate limiting on resource-intensive endpoints
- Caching with node-cache for expensive queries

### Data Views System

Dynamic table configurations in `/app/core/data-views/` allow users to create custom data tables with:

- Configurable columns and filters
- Real-time data updates via WebSocket
- Export capabilities (CSV)
- Saved view preferences
- Field definitions in `libs-shared/data-view-fields-index.mjs`

### Script Execution

All scripts follow pattern:

```javascript
import { is_main } from '#libs-server'
const main = async () => {
  /* logic */
}
if (is_main(import.meta.url)) {
  main()
}
```

Use `handle_season_args_for_script()` for year/week parameters.

### Season Constants

Current season info from `libs-shared/constants/season-constants.mjs`:

- `current_season.year`, `current_season.week`
- `is_offseason`, `is_regular_season`
- `fantasy_weeks`, `nfl_weeks`

## Player Management

See [docs/player-management.md](docs/player-management.md) for comprehensive documentation.

### Quick Reference

```bash
# Multi-source lookup (searches Sleeper, ESPN, NFL Pro, PFR in parallel)
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Player Name" --sources all

# Lookup with filters
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --pos QB --team KC

# Update player with external IDs
NODE_ENV=production node scripts/resolve-player-match.mjs update --pid "PID" --gsisid "00-0012345"

# Create player (use suggested command from lookup)
NODE_ENV=production node scripts/resolve-player-match.mjs create --fname "First" --lname "Last" --pos QB
```

### Player ID Format

Player IDs are generated as: `FNAM-LNAM-YEAR-DOB` (e.g., `PATR-MAHO-2017-1995-09-17`)
