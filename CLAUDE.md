# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For graph context (related task dir, system docs, sibling repos), see [ABOUT.md](ABOUT.md). System architecture, data model, deploy topology, and data sources are canonical in user-base under `text/league/` — link to them rather than restating here.

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
- `yarn deploy` - **API + workers only**: pulls code on main server from `origin/master`, installs deps, reloads PM2 server process. Does **NOT** rebuild or rsync the frontend `dist/` bundle. Frontend changes (any file under `app/`, `webpack/`, `libs-shared/` consumed by the SPA, or routes/components) require running `yarn build && yarn deploy:dist` separately. **Push to `origin/master` before running `yarn deploy`** — pm2 deploy pulls from origin; an unpushed local commit will deploy the prior origin state and leave production on stale code.
- `yarn deploy:dist` - Frontend-only deploy: rsyncs locally-built `dist/` to `/root/league/source/dist` on the main server. No API restart. Pair with `yarn build` to refresh the SPA bundle.
- `yarn load:main` - Update code and deps on main server without PM2 reload
- `yarn load:worker1` - Update code and reload worker processes on worker server 1

Deploy targets (SSH hosts): `league` (main: API + frontend), `league-worker-1` (odds/plays import workers)

**Deploy tree topology (important):** the main host has **two** independent git checkouts. `/root/league/source` (`current` → it) is the **pm2-deploy** tree updated by `pm2 deploy` — the long-lived PM2 app runs here. `/root/league` is a **standalone clone** updated by `yarn load:main` — **all scheduled scripts run from here** (the crontab invokes `/root/league/scripts/*.mjs`; SSH-in wrappers `cd /root/league`). `yarn deploy` chains `pm2 deploy && yarn load:main && yarn load:worker1`, so a full deploy syncs both trees to `origin/master`. Running only one (e.g. `yarn load:main` alone, or `pm2 deploy` alone) is a **partial deploy** that leaves the other tree on stale code — when hand-deploying a fix that cron jobs need, run full `yarn deploy` or `git pull` both trees. Full topology: `user:text/league/league-server.md` (Deployment Topology).

**Submodule policy:** Only `private` is initialized on the production servers. The `data` submodule is **dev-only** — it is a large git-lfs reference dataset and git-lfs is not installed on production. Never run plain `git submodule update --init` (without an explicit path) on a production server; always target `private` specifically. The `pre-deploy` hook in `server.pm2.config.js` defensively runs `git submodule deinit -f data` before pulling so that any accidental prior initialization is undone before the pull tries to fetch its refs. The same rule applies to the `load:main`, `load:worker1`, and `load:logrotate:main` scripts — they use `--init private` for this reason.

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
- League format catalog: `named-format-catalog.mjs`, `default-format-ids.mjs` (server-side find-or-create lives in `libs-server/find-or-create-format.mjs`)

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

1. Author the SQL in `db/adhoc/YYYY-MM-DD-<slug>.sql`
2. Run it against production with `yarn db:exec db/adhoc/<file>.sql` (wraps the file in a single transaction with `ON_ERROR_STOP=1`)
3. Export the updated schema using `yarn export:schema`
4. Commit both the adhoc file (audit trail) and the schema diff
5. The exported schema file (`db/schema.postgres.sql`) is the source of truth; `db/adhoc/` is the append-only history of how it got there

Format identities (`league_scoring_formats.id`, `league_formats.id`) are opaque -- snake_case slugs for the named catalog, `gen_random_uuid()` for the long tail. Dedup is enforced by a `UNIQUE` index across the full config-field tuple on each table. Adding a new scoring or roster metric is a normal additive `ALTER TABLE ADD COLUMN` plus an index rebuild; existing identities are untouched. Never reintroduce a content-derived hash as an identifier -- see `user:guideline/schema/avoid-content-derived-identity.md`.

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

- `current_season.year`, `current_season.week` (week is the **continuous counter** from `regular_season_start`, not per-type)
- `current_season.nfl_seas_type` (`PRE`/`REG`/`POST`), `current_season.nfl_seas_week` (resets to 1 in POST), `current_season.stats_season_year` (Super Bowl gap / offseason stable)
- `is_offseason`, `is_regular_season`
- `fantasy_weeks`, `nfl_weeks`

Never reconstruct an `nfl_week_id` locally. Use canonical helpers in `libs-shared/nfl-week-identifier.mjs`: `current_nfl_week_identifier()`, `current_nfl_week_params()`, `nfl_week_offset_params({ offset })`. See `docs/data-views-system.md` "Live current_season semantics" for the choke-point rules.

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
