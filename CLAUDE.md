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
- `yarn test` - Run all tests with Mocha
- `yarn test test/filename.spec.mjs` - Run specific test file

**Build & Deploy:**
- `yarn build` - Build production bundle
- `yarn analyze` - Build with bundle analyzer

**Testing:**
- Individual tests: `yarn test test/auth.spec.mjs`
- Test patterns: `yarn test test/common.*.spec.mjs`
- Grep patterns: `yarn test --grep "should login successfully"`

## Architecture Overview

### Frontend (`/app/`)
**React/Redux with Immutable.js state:**
- Domain-driven modules in `/app/core/` (players, leagues, teams, auction, etc.)
- Each module contains: `actions.js`, `reducer.js`, `sagas.js`, `index.js`
- Redux-Saga for async operations and WebSocket handling
- Components in `/app/views/components/` with co-located styles (`.styl`)
- React Router v6 with nested league routes: `/leagues/:lid/...`

### Backend (`/api/`)
**Express.js with PostgreSQL:**
- Modular routing with domain-specific route files
- JWT authentication with `express-jwt`
- WebSocket support for real-time auction and live updates
- Node-cache for performance optimization (10-min TTL)
- Database access via Knex.js ORM at `req.app.locals.db`

### Database
**PostgreSQL with comprehensive schema:**
- 80+ tables for fantasy football operations (leagues, rosters, trades, waivers)
- NFL data (games, plays, player stats) with partitioned tables
- Betting market integration (props, odds from 10+ sportsbooks)
- Schema managed via SQL dumps, not incremental migrations

**Schema Change Workflow:**

Preferred approach for database schema changes:
1. Run SQL ALTER commands directly on the production database
2. Export the updated schema using `yarn export:schema`
3. Do NOT commit migration files or SQL commands to the repository
4. The exported schema file (`db/schema.sql`) becomes the source of truth

## Key Development Patterns

### ES Modules
- All server-side files use `.mjs` extension
- Import path aliases configured in `package.json` imports field:
  - `#config` → `./config.js`
  - `#db` → `./db/index.mjs`
  - `#libs-server` → `./libs-server/index.mjs`
  - `#libs-shared` → `./libs-shared/index.mjs`

### Code Style
- Prettier config: single quotes, no semicolons, no trailing commas
- ESLint: extends standard, camelcase off, curly off
- Components use functional patterns with hooks

### Scripts & Jobs
**Located in `/scripts/` (161 total):**
- Data imports: projections, odds, player data, NFL games/plays
- League processing: waivers, matchups, trades, roster operations
- Calculations: points, values, baselines, percentiles
- Maintenance: backups, auditing, cleanup

**Background jobs in `/jobs/`:**
- `finalize-week.mjs` - End-of-week processing
- `import-live-odds.mjs` - Real-time odds importing  
- `import-live-plays.mjs` - Live game data

**Cron schedules in `/server/crontab-*.cron`** for different server roles

### Testing
- Mocha with Chai assertions
- Test files: `test/*.spec.mjs`
- Global setup in `test/global.mjs`
- Database seeding before tests
- MockDate for time-dependent tests
- Environment: `NODE_ENV=test`, timezone: `America/New_York`

### League Context
Most operations occur within league context (`/leagues/:lid/`). Check user permissions for team operations using helper functions from `libs-server/verify-user-team.mjs` and related utilities.

### Real-time Features
WebSocket endpoints for:
- Live auction bidding (`/sockets/auction.mjs`)
- Scoreboard updates (`/sockets/scoreboard.mjs`)
- Data view synchronization (`/sockets/data_view.mjs`)

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

### Script Execution
All scripts follow pattern:
```javascript
import { is_main } from '#libs-server'
const main = async () => { /* logic */ }
if (is_main(import.meta.url)) { main() }
```

Use `handle_season_args_for_script()` for year/week parameters.