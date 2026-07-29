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
- `yarn deploy` - **API + workers only**: on each host, `git pull` from `origin/master`, `yarn install`, and `pm2 reload` the app (main) / import workers (worker-1). Does **NOT** rebuild or rsync the frontend `dist/` bundle. Frontend changes (any file under `app/`, `webpack/`, `libs-shared/` consumed by the SPA, or routes/components) require running `yarn build && yarn deploy:dist` separately. **Push to `origin/master` before running `yarn deploy`** — the servers pull from origin; an unpushed local commit will deploy the prior origin state and leave production on stale code.
- `yarn deploy:dist` - Frontend-only deploy: rsyncs locally-built `dist/` to `/root/league/dist` on the main server (excludes `*.map` — sourcemaps are never served publicly). No API restart. Pair with `yarn build` to refresh the SPA bundle.
- `yarn deploy:sourcemaps` - Ships the build's `*.js.map` files to the **private** path `/root/league/sourcemaps` on the main server (never the public `dist/`). The `/api/errors` route resolves minified client stack frames against these maps server-side (`libs-server/symbolicate-stack.mjs`), so emitted `log_error` signals carry original `file:line:col` instead of minified chunk coordinates. **Always pair this with `yarn build && yarn deploy:dist`** — a frontend deploy that ships new chunk hashes without the matching maps silently degrades symbolication to raw minified stacks for the new chunks. Full frontend deploy: `yarn build && yarn deploy:dist && yarn deploy:sourcemaps`.
- `yarn load:main` - Update code and deps on the main server and `pm2 reload` the API app
- `yarn load:worker1` - Update code and reload worker processes on worker server 1

Deploy targets (SSH hosts): `league` (main: API + frontend), `digitalocean-0` (odds/plays import workers)

**`yarn build` reads the working tree, not the pushed ref — never build a frontend deploy from a dirty shared checkout.** `yarn deploy` is safe against local dirt (each host `git pull`s from `origin/master`), but `yarn build` bundles whatever is sitting in the tree, so a sibling session's uncommitted edits ship straight to production. This is not hypothetical: a 2026-07 frontend deploy for the RFA column rename coincided with another session's uncommitted changes to `libs-shared/get-draft-window.mjs`, which reaches the SPA through `libs-shared/index.mjs`. Check `git status` before `yarn build`; if the tree is dirty with work that is not yours, build from a throwaway worktree pinned to the pushed ref (`git worktree add /tmp/<name> origin/master`, symlink `node_modules`, then `yarn build && yarn deploy:dist && yarn deploy:sourcemaps` from there, then `git worktree remove`). Do not stash a sibling's work to clean the tree.

**`yarn deploy:dist` ships whatever is already in `dist/` — a clean `git status` does NOT mean it is safe to run.** This is the companion hazard to the one above, and the check for it is different. `dist/` is a build artifact directory: it survives commits, it is not cleaned by anything, and it can hold a sibling session's _finished build of an undeployed change_ while the source tree is spotless. Running `deploy:dist` then ships that change to production early, out of its own sequence and possibly ahead of the schema or push it depends on. This is not hypothetical either: on 2026-07-28 the tree was clean while `dist/` held a built bundle of the rookie-draft hourly-window rework, which had its own gated deploy sequence and must not have shipped early. **Before any `deploy:dist`, compare the local bundle against what production actually serves** — `ls dist/main.*.js` locally against `grep -o 'main\.[a-z0-9]*\.js' /root/league/dist/index.html` on the server. A local hash that does not match production's means `dist/` holds something undeployed; find out whose it is before shipping. If your change is backend-only (`api/`, `libs-server/`, `scripts/`, `jobs/`), skip the frontend steps entirely — `yarn deploy` alone is what you want.

**Deploy tree topology:** the main host runs a **single** `/root/league` clone. The long-lived PM2 app (`server.mjs`, registered from `/root/league` via the absolute `script` path in `server.pm2.config.js`) and all scheduled scripts (crontab invokes `/root/league/scripts/*.mjs`; SSH-in wrappers `cd /root/league`) share that one tree; `digitalocean-0` mirrors the shape for its import workers. `yarn deploy` = `yarn load:main && yarn load:worker1`, each a `git pull` + `yarn install` + `pm2 reload` on its host. (Historically the main host carried a second `/root/league/source` pm2-deploy tree; in 2026-07 a `pm2 start` from the wrong tree silently served a months-old bundle, so the layout was collapsed to one tree and pm2-deploy was dropped — see `user:text/league/league-server.md` § Deployment Topology.)

**Submodule policy:** Only `private` is initialized on the production servers. The `data` submodule is **dev-only** — it is a large git-lfs reference dataset and git-lfs is not installed on production. Never run plain `git submodule update --init` (without an explicit path) on a production server; always target `private` specifically. The `load:main`, `load:worker1`, and `load:logrotate:main` scripts use `--init private` for this reason.

**Running a script host-side against the live database:** `NODE_ENV=development` does not work — `config/config-development.json` carries an empty password and names the production host directly, so `#db` fails with either a connection-pool timeout or `SASL: client password must be a string`. Use the production config (sops-decrypted at load) redirected onto the `base db` league SSH tunnel:

```bash
NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 node scripts/<script>.mjs
```

The tunnel's local port comes from `config.databases.instances.league.tunnel.local_port` in user-base and is what `base db query league` already uses, so a working `base db query league` means the tunnel is up. Never pass a credential on the command line.

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

1. Author the SQL in `db/adhoc/YYYY-MM-DD-<slug>.sql`, including a `-- STATUS: PENDING` line in the header
2. Run it against production with `yarn db:exec db/adhoc/<file>.sql` (wraps the file in a single transaction with `ON_ERROR_STOP=1`)
3. Export the updated schema using `yarn export:schema`
4. Commit both the adhoc file (audit trail, banner now rewritten to APPLIED) and the schema diff
5. The exported schema file (`db/schema.postgres.sql`) is the source of truth; `db/adhoc/` is the append-only history of how it got there

**The status banner is machine-owned — `db:exec` refuses a `db/adhoc` file without one.** It rewrites `-- STATUS: PENDING` to `-- STATUS: APPLIED <date> against league_production` in place on success, so there is no window where the apply has happened and the file still reads pending, and it REFUSES a file already marked APPLIED (`--reapply` overrides). That refusal is the real point: three headers advertised applied work as pending until 2026-07-27, one of them a non-idempotent two-`DROP COLUMN` file that a second run would have failed or half-applied. Commit the rewritten header in the same commit as the apply; the script prints the command.

**Column renames must sweep query call sites, not just the DDL.** A rename lands green while leaving code that still names the old column, because most such references only fail when their code path actually executes. The 2026 `year`/`seas_type` -> `season_year`/`season_type` conformance left four seasonlog and careerlog generators still filtering on `nfl_games.year` and `ng.seas_type`; each threw Postgres 42703 at runtime and had silently aborted every scoring and league format seasonlog build until it was found by a backfill months later. After renaming a column, grep the old name across `scripts/`, `libs-server/`, `jobs/`, and `api/` and run the affected generators once, rather than trusting the schema export to be the whole change. Beware unqualified object-literal predicates (`.where({ year, seas_type: 'REG' })`) — they read as local variables and do not grep like column references.

**Sweep `docs/` and `server/crontab-*` too — documentation containing SQL is a schema consumer no gate reads.** Every other gate in this recipe examines an executable surface: the suite, the goldens, EXPLAIN, the audit. Prose is invisible to all of them, so it decays silently across every cluster and nothing ever flags it. The 2026-07-29 `nfl_games` conform found four such sites after its sweep had otherwise finished — two SQL examples in `docs/query-builder-function-reference.md`, one in `docs/player-management.md`, one crontab comment — and the query-builder examples were **already wrong on `year`/`seas_type`** from an earlier cluster, meaning two consecutive sweeps had missed them. Adding these two paths to the old-name grep costs nothing on a sweep already being run.

**A regenerated data-view golden cannot catch a rename you missed.** `scripts/update-data-view-snapshots.mjs` overwrites `expected_query` with whatever the current code emits, so a golden regenerated from buggy code agrees with the buggy code and the suite goes green over a live defect. This is not hypothetical: the 2026-07 plays/snaps conformance left `build_role_union_period_cte` emitting `nfl_plays.year` against the renamed table — a 42703 on every data view carrying a rate type — and eight regenerated goldens blessed it. Auditing the regeneration diff does not help either, because that only proves each _change_ was intended; it says nothing about an old name that stayed _unchanged_. After regenerating, grep the goldens for the old names directly (they escape quotes, so match `nfl_plays\\".\\"<old>`), and treat executed result-equivalence — not query-match — as the gate.

**Grep proves the absence of a string; only EXPLAIN proves the query is valid.** The golden-grep above is necessary but not sufficient, and on 2026-07-27 it missed a live defect twice. Correlated-subquery predicates are emitted as raw SQL against a generated CTE alias, so they appear _unquoted_ and _hash-named_ — `t22c9a76f62c8a62fec52ad076663a982.year IN (2024,2025)` — and match neither `nfl_plays\\".\\"<old>` nor any table-qualified pattern. A reviewer sweeping for `prop_markets_index.year` plus a fixed alias list that omitted `pmi.` likewise returned a confident zero on `pmi.year` in `update-market-settlement-status.mjs`, which had thrown 42703 on every game finalize for four days.

The gate that does work is now committed as **`db/adhoc/check-data-view-sql-validity.mjs`**, and it must run per cluster on any grain-column rename:

```
yarn test:db:up
node db/adhoc/check-data-view-sql-validity.mjs      # exit 1 on any invalid statement
```

It provisions its own database on the shared :5433 container (so it cannot collide with a sibling's suite run), loads `db/schema.postgres.sql`, generates SQL for all 551 data-view columns across the plain and `year_offset` range shapes, and `EXPLAIN`s each of the 1102 statements in about five seconds. Run ad hoc on 2026-07-27 it found six defects that 232 goldens and a fully green 2214-test suite did not; on its first committed run it found two more, both pre-existing (`player_pro_bowl_selections` naming a physical column that does not exist, and a `NaN` interpolated raw into the keeptradecut `year_offset` range SQL).

**Read its findings by reachability, not by how broken the SQL looks.** Every finding carries a tier — `system_view` (ships in a default view, so it is on a page-load path), `saved_view`, `golden`, `catalog_only` — and the report sorts by it. Ranking the 2026-07-27 findings by severity alone inverted the call: a dormant seasonal path was ranked BLOCKER above `GET /api/markets/players/:pid`, which had been returning 500 on every call for a year. A `catalog_only` failure still fails the gate; the tier orders triage, it does not excuse anything. Feed the `saved_view` tier from production with `--saved-view-columns` (see `check-saved-view-param-coverage.mjs --column-ids`).

To validate a single golden by hand, extract its `expected_query` and run `EXPLAIN` against the container directly (`docker exec -u postgres -i league-test-pg psql -U league_test -d league_test`; the `postgres` and `league_writer` DB roles are GRANT targets and cannot log in, so `-U league_test` is the only usable login role).

**A renamed column PARAM silently drops the filter — sweep saved views at apply time, not authoring time.** `apply_play_by_play_column_params_to_query` iterates the param registry and skips any key it does not recognise, so a param renamed code-side leaves every saved view still persisting the old key with a filter that is quietly ignored: no error, no failed test, just a wrong answer. `db/adhoc/check-saved-view-param-coverage.mjs` finds them against production:

```
NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
  node db/adhoc/check-saved-view-param-coverage.mjs
```

The remedy for anything it reports is a rule in `libs-shared/data-views-saved-view-migration.mjs`, which rewrites persisted params at read time. A one-shot SQL migration written when the rename is AUTHORED cannot cover a view saved between that check and cutover — which is precisely the hole the 2026-07-24 plays/snaps saved-view migration left. This check found 196 orphaned occurrences across 13 saved views from a 2025-07-24 rename that shipped with no saved-view migration at all.

**`apply_scope_to_query` resolves physical column names by table name; do not hardcode them.** `libs-server/data-views/physical-season-columns.mjs` maps physical tables to their conformed `season_year` / `season_type` columns, and `apply_scope_to_query` consults it by default, so an emitter that simply omits `year_column` gets the right name instead of the vocabulary `year`. Any cluster that conforms a physical table an emitter targets must register it there — `test/libs-server.physical-season-columns.spec.mjs` scans `libs-server` for `apply_scope_to_query` call sites and fails the suite when a table one of them names carries `season_year` but is absent from the map. Note the criterion is that an emitter targets the table, not that the table carries the column: 70 base tables carry `season_year` and only the handful an emitter names belong in the map. A call site passing a variable rather than a literal cannot be resolved statically, so those are pinned in a reviewed list and a new one fails until it is reviewed. Tables with no season-type column at all (`nfl_snaps`, the `nfl_plays_*` participant tables) are declared explicitly and throw rather than falling back, so a `seas_type` predicate against them is a loud error rather than a runtime 42703.

**A cluster is not done when its sweep lands — it is done when the sweep is DEPLOYED.** Every gate above examines the working tree or master; none of them can see what production is actually executing. So an applied DDL plus a correct, committed, undeployed consumer sweep leaves production running stale code against a conformed schema, and the whole suite stays green while it does. This is not hypothetical: on 2026-07-29 production was 20 commits behind with `practice` already conformed to `season_year`/`season_type` while the deployed `historical-injury-index-sql.mjs` still queried `practice.seas_type` — a 42703 waiting on that script's next cron fire in early September. Treat the DDL apply and its consumer deploy as one unit, and before declaring a cluster complete check what production is on:

```bash
ssh league "cd /root/league && git rev-parse --short HEAD"   # against origin/master
```

Note the cron schedules make this class of defect latent until the season starts (`0 9 * 1,2,9-12 2` for the injury index), which is the same shape as the prop-settlement 42703 — offseason silence is not evidence that a sweep landed.

When a rename does turn up a bad golden: **fix the code first, regenerate second, EXPLAIN third.** Regenerating first only re-blesses the defect. And declare `key_columns: { pid, year }` on any data-view source whose CTE projects `season_year` — `param-utils.mjs` silently defaults `year_column` to `'year'` when a source omits it, which is a rename that no grep of the source tree will ever surface.

Before regenerating, prove the golden is the thing that is wrong. A golden that disagrees with your change may be encoding semantics you just broke: on 2026-07-27 a `.year BETWEEN` predicate that was invalid without a year split turned out to be **valid and load-bearing** with one (the CTE projects `season_year as year` only when a year row axis is present), and the golden that failed was the only signal. The fix was to guard the predicate on `year_reference`, not to regenerate. Confirm the delta is exactly what you intended by reversing your change on the generated string and checking it reproduces the old golden byte for byte.

**A golden that embeds a clock-derived value must be a template, not a literal.** `expected_query` is run through `libs-server/process-expected-query.mjs`, which evaluates it as a template literal with `current_season`, `constants`, `all_years`, `last_3_years`, and `next_week` in scope (`next_week` mirrors the `next_week_opponent_total` branch of `get-data-view-results.mjs`). Any golden containing `${` is also skipped by the regeneration script, so templating is what protects a fixture from being re-blessed. `pff-team-grades-next-week-opponent.json` was a literal `"week" = 0` until 2026-07-28, when the date rolled over, the derived week moved to 1, and the golden broke on master with no code change; it is now `"week" = ${next_week.week}`.

**`scripts/update-data-view-snapshots.mjs` rewrites every fixture that currently mismatches unless you name the ones you want.** Pass filenames (`node scripts/update-data-view-snapshots.mjs some-fixture.json`) — unfiltered, it will also bless unrelated drift from a sibling session's uncommitted edits in this shared tree. Always `git status -- test/data-view-queries/` after regenerating and revert anything you did not intend to touch. The script runs outside `test/global.mjs` and so has no clock mock of its own; both it and the suite honor `LEAGUE_MOCK_DATE`, which pins the clock for a regeneration or a verification run.

**Regenerating goldens cannot fix a fixture's `setup` SQL — those are hand-edited.** Result-equivalence fixtures carry raw statements like `INSERT INTO nfl_games (esbid, season_year, week, season_type, v, h) VALUES (...)` in their setup block. `update-data-view-snapshots.mjs` only rewrites `expected_query`, so a rename sweep that regenerates every affected golden still leaves the setup SQL on old column names, and the fixture then fails at seed time rather than at compare time. The 2026-07-29 `nfl_games` conform hit exactly this in 9 fixtures. After any rename, `grep -rn "INSERT INTO <table>" test/data-view-queries/` as a separate step.

**Grep the goldens for the BARE quoted projection, not just the table-qualified form.** The emitters produce both shapes, and a sweep keyed to one silently misses the other. The documented pattern `nfl_games\".\"<old>` finds table-qualified references, but CTE builders like `rate-type-per-game.mjs` project `"h" as "team"` with no table prefix — so 7 affected goldens looked clean under the table-qualified grep and were caught only when the suite failed on them. Sweep both: `\\"<old>\\" as \\"` as well as `<table>\\".\\"<old>`.

**Verify a clock-derived golden across a week boundary, not just against today.** Regenerating until green only re-blesses whatever the clock says now. Run the suite at several mocked instants spanning PRE/REG/POST — e.g. `LEAGUE_MOCK_DATE=2026-09-22T12:00:00Z LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=5433 TZ=America/New_York NODE_ENV=test TEST=all node_modules/.bin/mocha --exit --require test/global.mjs --reporter min test/libs-server.data-view-queries.mjs`.

Format identities (`league_scoring_formats.id`, `league_formats.id`) are opaque -- snake_case slugs for the named catalog, `gen_random_uuid()` for the long tail. Dedup is enforced by a `UNIQUE` index across the full config-field tuple on each table. Adding a new scoring or roster metric is a normal additive `ALTER TABLE ADD COLUMN` plus an index rebuild; existing identities are untouched. Never reintroduce a content-derived hash as an identifier -- see `user:guideline/schema/avoid-content-derived-identity.md`.

## Key Documentation

| Document                                                                             | Description                                                             |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [docs/player-management.md](docs/player-management.md)                               | Player lookup, creation, updates, and external ID management            |
| [docs/data-views-system.md](docs/data-views-system.md)                               | Dynamic table configuration and data view field definitions             |
| [docs/api-documentation.md](docs/api-documentation.md)                               | API endpoints and authentication                                        |
| [docs/glossary.md](docs/glossary.md)                                                 | Fantasy football terminology and abbreviations                          |
| [docs/named-formats.md](docs/named-formats.md)                                       | League scoring format definitions                                       |
| [docs/context-documents.md](docs/context-documents.md)                               | Server-generated markdown league/team context docs (human-path + `.md`) |
| [docs/fantasy-points-column-definition.md](docs/fantasy-points-column-definition.md) | Fantasy points calculation system                                       |

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

**Local test database requires Postgres >= 15.** `db/schema.postgres.sql` uses `NULLS NOT DISTINCT` (Postgres 15+); loading it against an older server fails in `test/global.mjs` with `syntax error at or near "NULLS"`. `config/config-test.json` connects to `127.0.0.1:5432`; `db/index.mjs` honors `LEAGUE_DB_HOST`/`LEAGUE_DB_PORT`/`LEAGUE_DB_USER`/`LEAGUE_DB_PASSWORD`/`LEAGUE_DB_DATABASE` overrides (note: the `yarn test` script blanks `LEAGUE_DB_HOST`/`LEAGUE_DB_PORT`, so to target a non-default port invoke mocha directly rather than through `yarn test`).

If your local default Postgres on :5432 is < 15, use the bundled throwaway PG16 (`compose.test.yaml`, listens on :5433). It auto-creates the roles the schema GRANTs to (`postgres`/`league_writer`/`league_reader`) via `db/test/init-roles.sql`, so no manual `docker exec` step is needed:

```
yarn test:db:up      # start the PG16 container (blocks until healthy)
yarn test:local      # start DB + run the full suite against :5433
yarn test:local test/auth.spec.mjs   # ...or a single spec / mocha args
yarn test:db:down    # stop and remove the container (data volume persists)
```

To run mocha directly against the :5433 container (e.g. a custom reporter or `--grep`), set the port override and the standard requires yourself — `yarn test:local` is just this with `test:db:up` chained in front:

```
LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=5433 TZ=America/New_York NODE_ENV=test TEST=all \
  node_modules/.bin/mocha --exit --require test/global.mjs --reporter min test/<file>.spec.mjs
```

**The test container is a shared singleton — check for a concurrent run before trusting a result.** `mochaGlobalSetup` drops every table and reloads the schema, so a sibling session starting the suite mid-run pulls the tables out from under yours. It does not fail cleanly: you get a scatter of `relation "player" does not exist` and duplicate-key errors across unrelated specs, which reads like a real regression in whatever you happened to be editing. On 2026-07-28 this produced a 65-failure run that was entirely an artifact of two sessions sharing :5433. Check `ps aux | grep [m]ocha` first, and re-run alone before concluding anything. Better than waiting for the container to go idle: give your run its own database on the same container, which removes the collision entirely and does not disturb the sibling. `db/index.mjs` honors `LEAGUE_DB_DATABASE`, and `mochaGlobalSetup` loads the schema into whatever database it is pointed at, so `docker exec -u postgres league-test-pg psql -U league_test -d league_test -c 'CREATE DATABASE league_test_<slug> OWNER league_test;'` then adding `LEAGUE_DB_DATABASE=league_test_<slug>` to the direct-mocha invocation above runs the full suite in isolation (drop it when done). This turned a contaminated 68-failure run into a clean one on 2026-07-28. For the same reason, treat single-run timings as unreliable — this is a shared workstation and load averages above 50 are normal, so compare a change against a baseline measured back-to-back, not against a number from an hour ago.

**Timeouts are the suite's dominant failure mode, and they lie about their cause.** `.mocharc.yml` sets a 10000ms floor because mocha's 2000ms default is a unit-test budget and these specs query a real Postgres. When a test does exceed its budget, mocha fails it but cannot cancel its in-flight queries, so the abandoned work keeps writing and collides with the next test's fixture reset — surfacing as a duplicate-key violation on a later, innocent spec. Read a `transactions_pkey` error in the suite as a downstream symptom of a timeout, not as the defect. `test/global.mjs` prints unhandled rejections with their Postgres `detail`/`constraint` so the real error is visible rather than swallowed.

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
NODE_ENV=production node scripts/resolve-player-match.mjs lookup --name "Mahomes" --primary-position QB --team KC

# Update player with external IDs
NODE_ENV=production node scripts/resolve-player-match.mjs update --pid "PID" --gsis-player-id "00-0012345"

# Create player (use suggested command from lookup)
NODE_ENV=production node scripts/resolve-player-match.mjs create --first-name "First" --last-name "Last" --primary-position QB
```

### Player ID Format

Player IDs are `FNAM-LNAM-<serial>` (e.g., `PATR-MAHO-000123`): a frozen 4+4-letter name prefix (a courtesy snapshot, never recomputed, carries no identity) plus an opaque immutable zero-padded serial from a dedicated sequence that IS the identity. The pid does not depend on `dob`/`nfl_draft_year` and is never regenerated. DST pids are the bare team abbreviation (`NE`). See [docs/player-management.md](docs/player-management.md).
