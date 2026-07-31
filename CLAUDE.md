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

- **`yarn deploy:all` — the deploy path. Use this unless you have a specific reason not to.** Runs `preflight:deploy && deploy && build && deploy:dist && deploy:sourcemaps`: pre-flight gate, then backend to both hosts, then the frontend bundle and its sourcemaps. It exists because the individual steps below are each independently skippable and the skip is silent — the recurring production incident here is a PARTIAL deploy, someone shipping `deploy:dist` for the frontend and never running `deploy` for the backend (or the reverse). On 2026-07-16 both backend checkouts sat 6 commits behind since the last `yarn deploy` while the client `dist` had been rebuilt that same day; the app hosts drifted again to 4 behind by 2026-07-29. Running every step in one command is what makes the sequence un-skippable. It is human-gated on purpose — nothing auto-deploys these hosts, because they run the live API and the import workers and reloading them unattended is the wrong risk. Being a superset of a backend-only deploy costs one webpack build and one rsync; take that over reasoning each time about whether your change reaches the SPA.
- `yarn preflight:deploy` - The gate `deploy:all` runs first (`scripts/preflight-deploy.sh`). Refuses to deploy from a dirty working tree (`yarn build` would bundle a concurrent session's edits into production), from a HEAD that is ahead of or behind `origin/master` (the hosts `git pull` origin, so an unpushed commit deploys the prior state), or with an unpushed `private` submodule commit (the hosts `git submodule update --init private`, and `private` is a nested submodule that `sync-all` does not push). Read-only — it fetches and compares, nothing else. Safe to run on its own to check whether a deploy would be honest.
- `yarn build` - Build production bundle
- `yarn analyze` - Build with bundle analyzer
- `yarn deploy` - **API + workers only**: on each host, `git pull` from `origin/master`, `yarn install`, and `pm2 reload` the app (main) / import workers (worker-1). Does **NOT** rebuild or rsync the frontend `dist/` bundle. Frontend changes (any file under `app/`, `webpack/`, `libs-shared/` consumed by the SPA, or routes/components) require running `yarn build && yarn deploy:dist` separately — **which is exactly the split that keeps producing partial deploys, so prefer `yarn deploy:all` above.** Reach for bare `yarn deploy` only when you have positively established your change is backend-only (`api/`, `libs-server/`, `scripts/`, `jobs/`). **Push to `origin/master` before running `yarn deploy`** — the servers pull from origin; an unpushed local commit will deploy the prior origin state and leave production on stale code. (`yarn deploy:all` refuses in that situation; bare `yarn deploy` does not check.)
- `yarn deploy:dist` - Frontend-only deploy: rsyncs locally-built `dist/` to `/root/league/dist` on the main server (excludes `*.map` — sourcemaps are never served publicly). No API restart. Pair with `yarn build` to refresh the SPA bundle.
- `yarn deploy:sourcemaps` - Ships the build's `*.js.map` files to the **private** path `/root/league/sourcemaps` on the main server (never the public `dist/`). The `/api/errors` route resolves minified client stack frames against these maps server-side (`libs-server/symbolicate-stack.mjs`), so emitted `log_error` signals carry original `file:line:col` instead of minified chunk coordinates. **Always pair this with `yarn build && yarn deploy:dist`** — a frontend deploy that ships new chunk hashes without the matching maps silently degrades symbolication to raw minified stacks for the new chunks. Full frontend deploy: `yarn build && yarn deploy:dist && yarn deploy:sourcemaps`.
- `yarn load:main` - Update code and deps on the main server and `pm2 reload` the API app
- `yarn load:worker1` - Update code and reload worker processes on worker server 1

Deploy targets (SSH hosts): `league` (main: API + frontend), `digitalocean-0` (odds/plays import workers)

**`yarn build` reads the working tree, not the pushed ref — never build a frontend deploy from a dirty shared checkout.** `yarn deploy` is safe against local dirt (each host `git pull`s from `origin/master`), but `yarn build` bundles whatever is sitting in the tree, so a sibling session's uncommitted edits ship straight to production. This is not hypothetical: a 2026-07 frontend deploy for the RFA column rename coincided with another session's uncommitted changes to `libs-shared/get-draft-window.mjs`, which reaches the SPA through `libs-shared/index.mjs`. Check `git status` before `yarn build`; if the tree is dirty with work that is not yours, build from a throwaway worktree pinned to the pushed ref (`git worktree add ~/user-base/tmp/<name> origin/master`, symlink `node_modules`, then `yarn build && yarn deploy:dist && yarn deploy:sourcemaps` from there, then `git worktree remove`). Do not stash a sibling's work to clean the tree.

**`yarn deploy:dist` ships whatever is already in `dist/` — a clean `git status` does NOT mean it is safe to run.** This is the companion hazard to the one above, and the check for it is different. `dist/` is a build artifact directory: it survives commits, it is not cleaned by anything, and it can hold a sibling session's _finished build of an undeployed change_ while the source tree is spotless. Running `deploy:dist` then ships that change to production early, out of its own sequence and possibly ahead of the schema or push it depends on. This is not hypothetical either: on 2026-07-28 the tree was clean while `dist/` held a built bundle of the rookie-draft hourly-window rework, which had its own gated deploy sequence and must not have shipped early. **Before any `deploy:dist`, compare the local bundle against what production actually serves** — `ls dist/main.*.js` locally against `grep -o 'main\.[a-z0-9]*\.js' /root/league/dist/index.html` on the server. A local hash that does not match production's means `dist/` holds something undeployed; find out whose it is before shipping. If your change is backend-only (`api/`, `libs-server/`, `scripts/`, `jobs/`), skip the frontend steps entirely — `yarn deploy` alone is what you want.

**Verifying a frontend deploy over HTTP: assets live under `/dist/`, and every path OUTSIDE `/dist/` returns `index.html` with a 200.** The SPA catch-all means `curl https://xo.football/main.<hash>.js` answers `200` with 11KB of `index.html` rather than the bundle — so a verification that only checks the status code passes identically whether the asset exists, is stale, or was never deployed. On 2026-07-29 a `kickoff_at` frontend deploy was "confirmed" three ways by this shape: the new bundle, the superseded bundle, and a `.map` all returned 200, which read as success, success, and a public sourcemap leak. All three were `index.html`. Check `content_type` and body, not `%{http_code}` — the real URLs are `https://xo.football/dist/main.<hash>.js` (`application/javascript`, ~376KB). Read the referenced hash out of the deployed page (`curl -s https://xo.football/ | grep -oE 'src="[^"]*"'`) rather than guessing the path.

Since 2026-07-30 the `/dist` mount is `fallthrough: false` with its own 404 handler (matching `/static` and `/docs`), so **a missing asset under `/dist/` now 404s instead of falling through to the catch-all.** Before that fix an absent chunk was answered `200 text/html` with index.html's body, and the browser parsed `<!doctype html>` as JavaScript and reported `SyntaxError: Unexpected token '<'` with no filename and no request_url — naming neither the asset nor the deploy that dropped it (signal #123576). This changes the sourcemap check's observable: `/dist/main.<hash>.js.map` now returns **404**, where it previously returned `text/html`. Both results prove the same thing — maps are not publicly served, because `deploy:dist` excludes `*.map` — but the passing observable is now a 404, not an HTML body. A `.map` that returns `200 application/json` is still the real leak to watch for.

**Confirm a shipped bundle by executing its behavior, not by grepping the source for the fix.** "The new source contains the fix" and "the deployed bundle no longer has the defect" are different claims, and only the second is what a deploy verifies. For a defect that is a silent no-op rather than a crash — a comparator returning `NaN`, a filter matching nothing — nothing in the logs or the status codes will ever distinguish them. The durable check is to fetch the bundle production actually serves, extract the minified construct from it, and run it against a real production payload: the 2026-07-29 `kickoff_at` gamelog sort was confirmed by pulling `(e,t)=>new Date(t.kickoff_at)-new Date(e.kickoff_at)` out of the served JS and sorting a live 61-row response with it, showing the old comparator yielded `NaN` and the shipped one ordered correctly. Note that `/api/players/:pid/gamelogs` has **no `ORDER BY`** — the server returns rows unordered and the client comparator is the only thing sorting them, which is why this class of defect is display-only yet fully invisible server-side.

**Cloudflare sits in front of xo.football, so a probe of an already-published asset URL can be an edge hit rather than origin truth.** `/dist` assets are served `Cache-Control: public, max-age=31536000, immutable`, so once an edge node has a hash-named asset it keeps answering `200` for it long after `deploy:dist` deleted that file from `/root/league/dist`. On 2026-07-30 the superseded `main.f1d67453.js` and its chunks still returned `200 application/javascript` from the edge (`cf-ray` present) while all three were provably `deleted` on the host. So an edge `200` proves nothing about what origin holds, and "the old bundle is still being served" is the expected reading, not a failed deploy. A probe is origin-truthful when its URL is one the edge has never cached a success for — a brand-new content hash, or a path that does not exist — which is why the `9999.deadbeef.chunk.js` and `.map` 404 checks above stay valid. For anything about origin state (did a file actually ship, did it actually get deleted) read the host directly: `ssh league 'ls /root/league/dist'` or `grep` in that directory, and treat that as the oracle over any `curl`.

**A data-view fix is not live for users when the deploy lands — redis holds each `/data-views/<hash>` response for up to 12 hours, so the pre-fix value keeps being served to whoever requests the same payload.** `api/routes/data-views.mjs` caches the whole result set under a hash of the request body (`where`/`columns`/`sort`/`offset`/`prefix_columns`/`row_axes`), with the TTL the columns' `get_cache_info` agree on; the static 12h default is common. The cache is in redis, so `pm2 reload` does not clear it and there is no bypass parameter. This cuts both ways on verification: a probe with a payload nobody has requested before gets a fresh key and honestly executes the deployed emitter, while re-running the exact payload the page sends can return a pre-fix entry and read as a failed deploy. After fixing a column, verify with a deliberately novel payload, then check whether a stale entry still exists for the real one — `ssh league "for k in \$(redis-cli --scan --pattern '/data-views/*'); do redis-cli --raw get \"\$k\" | grep -q <column_name> && echo \"\$k \$(redis-cli ttl \"\$k\")\"; done"` — and delete only the affected keys if any hold the old value. Confirmed 2026-07-31 on the `player_league_extended_salary` extension-ladder fix, where a single key held the column and it was the verification probe's own fresh entry.

**The same redis cache INVERTS the verification advice for a CLIENT-side data-view defect: a novel payload hides the bug, and only the real one reproduces it.** The paragraph above says probe with a payload nobody has requested so the deployed emitter honestly executes; that is correct for a column's SQL and exactly wrong for anything in the SPA's request/response handling. On a cache MISS the request is queued and `handle_non_auth_request` (`api/sockets/data_view.mjs`) collapses a second request from the same client into the first, so only one result comes back; on a cache HIT both answer immediately and overlap. A 2026-07-31 defect that rendered every row of a saved view twice — two requests per direct link (`app/core/data-views/sagas.js`), plus a reducer keying its append decision on `request_id`, which is the VIEW id and not a per-request identity (`app/core/data-view-request/reducer.js`) — reproduced at 2x on a warm cache and was perfectly clean on a cold one, on the same view minutes apart. Verify a client-path fix on the payload the page actually sends, after warming it, and treat "it looked fine on a fresh probe" as no evidence at all.

Two related traps when counting rendered rows in a browser to prove such a thing. **The SPA delivers data-view results over the WEBSOCKET, not `POST /api/data-views/search`** — that route exists and answers correctly, so a network capture filtered to it shows nothing and reads as "no requests fired". Hook `WebSocket.prototype.send` and a `MessageEvent.prototype.data` getter, both of which apply to an already-open socket, rather than patching the `WebSocket` constructor (too late by the time you can evaluate). And **the table renders ~25 rows per scroll and pads the end with empty `.row` elements**, so a raw `querySelectorAll('.row').length` overcounts; key the duplicate check on the player NAME cell, never on the row-number cell, which is generated per rendered row and is unique by construction — that mistake returns a confident zero duplicates over a table that is entirely duplicated.

**When you write a grep to prove a defect is ABSENT, validate the pattern against an occurrence you know exists first.** A negative grep that cannot match is indistinguishable from a clean result, and it reads as proof. Concrete instance from 2026-07-30: `remove:[a-zA-Z_$]{1,4}\.removeTag` was used to assert the fixed bundle no longer contained the broken dispatch map, and it reported `absent` on both the fixed AND the broken chunk — the minified namespace is `h.CB`, whose `.` is not in the character class, so the pattern could never match anything. The check was vacuous in exactly the direction that looks like success. Anchor negative checks on the bare identifier with surrounding context (`grep -ohE '.{28}removeTag.{12}'`) and read the hits, rather than encoding a guess about the minified shape into the pattern.

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

**A typo'd action-creator name in `mapDispatchToProps` fails SILENTLY, and it has shipped twice.** Every connected component here uses the object form (`const map_dispatch_to_props = { remove: roster_actions.remove_tag }`), which redux passes to `bindActionCreators` — and that function copies only values that are `typeof 'function'`, skipping everything else without warning. So a reference to a creator that does not exist resolves to `undefined`, gets dropped from the props object entirely, and produces **no connect-time warning, no lint error, and no build failure**. The component renders normally; the only symptom arrives when a user fires the handler, as `TypeError: this.props.<name> is not a function`, reported through `window.onerror` with null `filename`/`lineno`/`request_url` because the browser has no usable stack for it.

The recurring cause is the project's camelCase → snake_case action rename passing over a call site: on 2026-07-30 `remove-tag-confirmation/index.js` still referenced `roster_actions.removeTag` (real name `remove_tag`, signal #123469) and `stat-qualifier-filter/index.js` still referenced `stat_actions.updateQualifier` (real name `update_qualifier`, never reported — it needs the qualifier filter opened to fire). Note that `PropTypes.func` does not catch it either; the prop is simply absent, and an absent non-required prop is valid.

When touching a dispatch map, verify each referenced name exists on the actions module rather than trusting it — `grep -nE "^\s+<name>[:(]" app/core/<domain>/actions.js`. A same-named saga or a `SCREAMING_CASE` type constant is not the creator: `removeTag` existed as both a saga export and `REMOVE_TAG`, which is exactly what made the wrong name look plausible. There is currently **no automated guard** for this class; the modules are not Node-importable as-is (they resolve webpack aliases like `@core/utils`), so a test would need its own alias harness.

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

**Twenty routers mount BEFORE the blanket auth guard, so each of their routes must self-enforce.** `api/index.mjs` mounts `docs`, `status`, `errors`, `stats`, `players`, `projections`, `plays`, `schedule`, `sources`, `auth`, `leagues`, `teams`, `markets`, `percentiles`, `seasonlogs`, `cache`, `data-views`, `u`, `wagers` and `selection-combinations` above the `if (!req.auth) return 401` catch-all, which therefore covers only what mounts after it (`scoreboard`, `me`, `settings`). Most of those routers are legitimately public NFL data, but any route in one of them that reads USER-owned rows needs its own `req.auth` check, and the guard's presence in the file makes it easy to assume otherwise. `GET /api/data-views` had neither an auth check nor a mandatory filter for that reason and returned every saved view on the platform to an anonymous caller until 2026-07-31 (`216c1a5d0`). Its sibling `GET /api/plays/views` still has the identical shape against `user_plays_views`, latent only because that table is empty. When adding a route to any pre-guard router, check whether it touches user-owned data and enforce ownership in the handler.

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

**Applying DDL to production opens a window in which ANY other session's `yarn export:schema` can commit your change for you — the one-commit rule is not yours alone to keep.** The recipe says apply, export, and sweep land in one commit precisely so master never has a schema declaring a column its code cannot name. But `yarn export:schema` dumps the whole live database, so between your apply and your commit, an unrelated cluster that exports for its own reasons will pick your column up and ship it without your sweep. That is not hypothetical: on 2026-07-29 the `nfl_games."timestamp"` -> `kickoff_at` retype was applied and its sweep still in progress when `872cfb8f` (an unrelated `projections` rename) regenerated the schema, and master went red on six tests — two in `historical-injury-index-sql.mjs`, four inserting the old column in `test/teams.reserve.spec.mjs`. The retyping session had done nothing wrong and had not yet committed anything. Two consequences worth planning around: keep the apply-to-commit window as short as you can and do not start a long consumer sweep with the DDL already applied if you can sequence it otherwise; and when it does happen, recognise the shape immediately — a schema/code disagreement on master that you did not commit — because the sync-all pre-push guard then refuses every push to the repo INCLUDING the commit that repairs it, and clearing it needs `PUSH_TO_RED_MAIN=mistakia/league cli/sync/sync-all.sh` (never a bare `=1`, never a direct push). The corollary for the exporting session: `yarn export:schema` is never a private act in a shared tree, so read the diff for columns that are not yours before committing it — though note the exporting session cannot solve this for you, since an export that refused to carry foreign DDL would produce a schema file disagreeing with the live database, a worse failure than the one it prevents. The window closes only at the applying end. **Which DDL opens it: renames and drops, not additive changes.** A new table or column makes the schema a superset of what the code needs, so nothing fails to resolve; a rename removes something committed code still names. The same 2026-07-29 window fired three times in one afternoon and only once did damage — the `kickoff_at` retype above — while the same mechanism carried two other clusters' new tables to master harmlessly. Left unrepaired it is not merely a red CI: production ran the conformed schema against stale code for an hour, and the two live GET routes naming the dropped column (`api/routes/players.mjs`, `api/routes/stats.mjs`) began returning 500s once real traffic reached them. This is strictly stronger than the deploy rule further down — a deploy can lag safely, a commit cannot.

**A staging table left in `public` on production breaks `yarn export:schema` for EVERY session, not just yours.** `pg_dump` takes `ACCESS SHARE` on every table it can see, in one `LOCK TABLE` naming all of them, so a scratch table owned by a role the export role cannot lock fails the whole dump with `permission denied for table <staging>` — not a partial export, no schema file written, and the error names a table that has nothing to do with whatever the exporting session was working on. A 2026-07-29 projection backfill loaded six `projection_backfill_*` tables as `postgres` and every subsequent export failed until they were dropped. Two rules: create bulk-load staging with the same role that runs the export, or drop it in the same session that created it — and never leave it in `public` across a commit boundary. If an export suddenly fails naming a table you have never heard of, this is why; `\dt public.*` and ask whose it is rather than debugging your own change.

**A `debug.enable()` call REPLACES the enabled namespace set — it does not add to it.** So a helper's own instrumentation is silently unreachable unless the entry-point script lists its namespace. `record-league-format-projection-value-history` logs the change rate that is the entire cost model for the projection-value history store, and it had logged **zero times** in production — including through the run that seeded 468,930 rows — because neither `process-projections.mjs` nor `process-projections-for-league-format.mjs` named it in their `debug.enable(...)`. Nothing fails; the metric just does not exist, which is the worst shape for an instrument whose job is to detect silent degradation. When adding a `libs-server` helper that logs under its own namespace, add that namespace to every entry point that calls it (note `process-projections.mjs` calls `debug.enable` twice, at module scope and again in `main()`, and the second overwrites the first).

**Column renames must sweep query call sites, not just the DDL.** A rename lands green while leaving code that still names the old column, because most such references only fail when their code path actually executes. The 2026 `year`/`seas_type` -> `season_year`/`season_type` conformance left four seasonlog and careerlog generators still filtering on `nfl_games.year` and `ng.seas_type`; each threw Postgres 42703 at runtime and had silently aborted every scoring and league format seasonlog build until it was found by a backfill months later. After renaming a column, grep the old name across `scripts/`, `libs-server/`, `jobs/`, and `api/` and run the affected generators once, rather than trusting the schema export to be the whole change. Beware unqualified object-literal predicates (`.where({ year, seas_type: 'REG' })`) — they read as local variables and do not grep like column references.

**An `onConflict([...])` target list is a column reference that does not look like one, and no gate here covers writer SQL.** A rename sweep that updates the inserted object keys and misses the upsert's conflict target produces valid-looking JS that Postgres rejects at execution with `column "<old>" does not exist`. The damage is worse than a plain failure when the writer follows the `delete().where({ lid })` then `batch_insert` shape this file uses everywhere: the delete commits, the insert throws, and the table is left EMPTY rather than stale. On 2026-07-30 conforming `league_player_season_projection_values.year` to `season_year` updated the insert keys but left `onConflict(['pid', 'lid', 'year'])` on both new period tables; `process_league lid=1` aborted with the season table emptied, so `market_salary_adj` and the `'0'` payload key vanished from `get-players` for a full cron cycle — blanking the adjusted-salary readout on league-home, the auction nomination panel and the selected-player panel. Both `yarn lint` and `check-data-view-sql-validity` were green throughout, because the former does not type-check SQL and the latter only EXPLAINs data-view column SQL, never `scripts/`. Add `onConflict` to the post-rename grep alongside `.where({ ... })`, and treat the next scheduled run of the affected writer as the real gate — not the deploy, which reports success either way.

**Sweep `docs/` and `server/crontab-*` too — documentation containing SQL is a schema consumer no gate reads.** Every other gate in this recipe examines an executable surface: the suite, the goldens, EXPLAIN, the audit. Prose is invisible to all of them, so it decays silently across every cluster and nothing ever flags it. The 2026-07-29 `nfl_games` conform found four such sites after its sweep had otherwise finished — two SQL examples in `docs/query-builder-function-reference.md`, one in `docs/player-management.md`, one crontab comment — and the query-builder examples were **already wrong on `year`/`seas_type`** from an earlier cluster, meaning two consecutive sweeps had missed them. Adding these two paths to the old-name grep costs nothing on a sweep already being run.

A doc that a script MAINTAINS decays worse than plain prose, because the rename also breaks the maintainer silently. `docs/glossary.md` keys each row on a physical column name, and `scripts/update-glossary-from-coverage-report.mjs` refreshes the coverage percentages by matching those row keys against a report built from the table's live `columnInfo()` — so a renamed column stops matching its own row, the percentage freezes at its pre-rename value, and the only symptom is a line in a `not_found_columns` list nobody reads. On 2026-07-31 all 13 rows of the glossary's Player Identification section were still on pre-conform names (`gsisid`, `sleeper_id`, `pfr_id`, ...); none of the 13 exist on `player`, so every coverage figure in that section had been stale since the `<vendor>_player_id` conform and the generator had been a no-op for the whole section. Sweep a generated or generator-maintained doc by checking its keys against `information_schema`, not by reading it — and when one row is stale, check the whole table, since these decay a section at a time rather than a line at a time.

**The schema's authoritative documentation also lives OUTSIDE this repo, in user-base, where no sweep confined to this checkout can reach it.** `guideline/nfl/`, `text/league/`, and `workflow/nfl/` in user-base carry runnable SQL and runnable CLI commands that name league columns, and they are read by analysis sessions as canonical instruction. A 2026-07-29 sweep of those trees found roughly 20 stale files tracing to at least four separate rename clusters, none of which had ever swept them: the entire `workflow/nfl/betting/` directory (8 files of SQL templates) is uniformly pre-conform and every literal query in it fails today; `guideline/nfl/league/league-player-resolution.md` documents `resolve-player-match.mjs --fname/--lname/--pos/--dob` when the script's yargs options are `--first-name/--last-name/--primary-position/--date-of-birth`, so the documented commands are wrong against execution and not merely against the schema; and `guideline/nfl/league/nfl-database-analysis.md` instructs readers to window a `player_changelog` join against `nfl_games.start_time`, a column that has never existed under that name, in the document that exists to teach that join. Note the failure is worse than in-repo doc rot because the reader is an agent treating the guideline as authoritative. Sweep these three user-base trees alongside `docs/`. Two triage rules keep the noise survivable: judge staleness per `(table, column)` and never per column name alone (`timestamp`, `year`, `position` and `team` all still legitimately exist on other tables), and treat a Completed task describing what a rename did as accurate history rather than a defect — only live instruction counts.

**Do NOT derive the old-name list by grepping `db/adhoc` for `RENAME` — that corpus is not the complete record of applied renames.** At least three clusters were executed as expand-contract instead: `ADD COLUMN`, backfill, then `DROP COLUMN` on the old name, sometimes spread across several dated files, with **zero** `RENAME` statements anywhere. `db/adhoc/2026-05-28-format-id-migration.sql` is the clearest case — 18 `ADD COLUMN`, 17 `DROP COLUMN`, 0 `RENAME` — and it is how `scoring_format_hash`/`league_format_hash` became `scoring_format_id`/`league_format_id`; `2026-06-10-adp-format-dimension.sql` (`adp_type` -> `adp_format_id`) and the `2026-05-31` nfl-coaches pfr-id re-key have the same shape. A `RENAME`-anchored grep is structurally blind to all of them, so any sweep built on one is working from a floor rather than a complete list, and the gap is invisible: the old name simply never appears in the derived list and nothing reports a miss. The heuristic "file drops a column without renaming one" recovers most of them but still assumes both the add and the drop landed in `db/adhoc` at all. **The reliable derivation is diffing `db/schema.postgres.sql` against an earlier revision of itself** (`git log --oneline -- db/schema.postgres.sql`, then diff across the window) — the schema export is the source of truth, so a column that left it is a rename or a drop regardless of which SQL verb effected it. Related caveat, since it bit the same sweep: a script's CLI flag names do not reliably track its columns in either direction — `resolve-player-match.mjs` was renamed with its columns and `import-plays-nfl-v1.mjs` was not, so check each script's argv parsing directly rather than inferring.

**The expensive defect in a prose/plan corpus is not a renamed column — it is a plan specifying a table or mechanism a later migration eliminated.** A 2026-07-30 sweep of the 261 open league task entities found two of these, and a name-anchored sweep cannot see either, because every identifier in them is internally consistent and merely describes a world that no longer exists. `plan-pff-archive-ingest` specified `CREATE TABLE pff_game_id_map` — the table `ee48e5d5` eliminated into `nfl_games.pff_game_id` — so implementing it as written would have re-added what the conform removed, along with an `esbid_resolved` flag that has nowhere to live. `334-add-bestball-adp` specified `ALTER TYPE adp_type ADD VALUE`, the exact `ALTER TYPE` blowup the `adp_format` dimension was built to eliminate; the correct step is a find-or-create on the axis tuple and involves no DDL at all. Both plans were internally coherent and would have passed any grep. The only thing that surfaces them is reading what a plan _builds_ against the current schema, not just what it _names_. Related: `points_added` did not rename, it **split** into `points_added_earned`/`points_added_net` with ranks only on the earned side, so a rename-shaped fix (one old name, one new name) silently picks the wrong semantics.

**Judging a prose sweep per `(table, column)` is not a refinement of the name-only sweep — it is the difference between fixing and breaking.** The same 2026-07-30 sweep hit five independent cases where the shorthand survived on one surface and died on another: `psr_gsis`/`trg_gsis` still exist while `psr_pid`/`trg_pid` became `passer_pid`/`target_pid` (same conform, same table, opposite outcomes); `pff_player_seasonlogs.pff_id` survives while `player.pff_id` became `pff_player_id`; `scoring_format_player_seasonlogs.year` and `league_format_player_seasonlogs.year` survive while `player_seasonlogs.year` became `season_year`, so one documented join is now correct on one side and stale on the other; `rnk` still exists on `scoring_format_player_seasonlogs`/`_gamelogs`, so the open `rename rnk to rank` task is live rather than stale; and `seas_type` survives as a **data-view param name** even though the column is `season_type`, so the tasks asking for `seas_type` column params are correct as written. Four of those five would have been actively damaged by a global rename.

**Budget for the fact that dropped league column names include ordinary English words.** Matching the derived old-name list against prose returned hits in 185 of 257 task files, almost entirely from `to`, `new`, `off`, `def`, `h`, `v`, `rec`, `int`, `order`, `desc`, `col`, `pl`, `prop`, `pts` and `round` — all genuinely dropped columns, all unusable as bare patterns. Two filters made the corpus tractable without losing signal: require a **code context** (the token inside backticks, or dot-qualified as `table.column`) and carry an explicit stopword set for the English collisions. That cut 185 files to 29 candidates, which matched what manual review found. A complementary pass that needs no stopwords at all: extract every `table.column` pair from the corpus and check each against the parsed schema — it is the only pattern that catches the ambiguous names (`year`, `timestamp`, `week`) that a global list must exclude.

**Validate a sweep pattern against a site you already know exists before trusting its zeros.** A grep that returns nothing is indistinguishable from a grep that cannot match, and the second failure is invisible precisely when it matters most. A 2026-07-29 sweep for `year`-to-`year` join predicates returned a confident zero because the pattern required the two column literals to be adjacent (`.on('a.year', 'b.year')`) and so missed every three-argument form (`.andOn('a.year', '=', 'b.year')`) — which is how this codebase actually writes join predicates. The false negative hid a `teams`↔`users_teams` coupling entirely, and was caught only by re-running the pattern against a known-existing site. This is the same failure class as a proving join missing a discriminating column, but located in the sweep rather than in the data: in both cases the error is invisible in the aggregate and only a positive control exposes it. Any sweep whose zero would let you skip work needs that control. Corollary: a table with rows and a reported consumer count of zero should be disbelieved until the bare table name has been grepped too — table names held in constants (`const HISTORY_TABLE = '...'`) defeat reference-shaped matchers.

**A table-name-anchored count is not blast radius when a wrapper module fronts the table.** One step further out than the constants case, and it does not need a constant to bite: if the only code naming a table is a module that exports functions taking the grain columns as NAMED PARAMETERS, the object keys a sweeper must change live in that module's CALLERS, which never name the table at all. No matcher keyed on the table name can reach them at any level of care. On 2026-07-29 `league_notifications` was scoped as a 2-site cluster on exactly that basis — 2 sites do name the table, both in `libs-server/league-notifications.mjs` — but its two exported helpers take `{ year, event_timestamp }` and four scripts call them at **14 sites**, so the real sweep was 5 files. Note the count was not wrong on its own terms; `entry` accurately reports query sites to open. What failed was reading it as work. The cheap discriminator, worth running before sizing any rename: grep for exported functions in `libs-server` that query the target table AND take the grain column as a named parameter, then add those modules' importers to the sweep surface. Run against the remaining `season_grain` class it flags `libs-server/simulation/*` (~20 such functions chained several layers deep, spanning `rosters_players`, `playoffs`, `matchups`, `teams`, `seasons`), `libs-server/get-roster.mjs`, and `libs-server/context-docs/*`. Refine before trusting it: a `year` parameter is a rename site only where it becomes an object KEY (`.where({ year })`), not where it is a bound value (`.where('t.year', year)`) — so that list is files to open, not a work count, and treating it as one would repeat the original mistake.

**A retype's blast radius escapes a wrapper even when a rename does not.** Same cluster, and the asymmetry is the point. A rename can be contained inside the module that builds the query — only if you accept a translation layer there, which the no-shims rule forbids. A retype cannot be contained at all: callers pass the old representation and pg rejects it at the bind (an integer bound to `timestamptz` is a type error, not a coercion), so every caller is in scope regardless of how the query is written. When folding a retype in with a rename to save an apply window, size the cluster on the retype.

**Check a proving join for its own false matches before believing what it proves.** A join used as evidence — "this table's data all exists over there, so the drop is lossless" — is itself a query that can be wrong, and when it is, the error hides in the aggregate. On 2026-07-29 two separate approved instructions rested on joins missing a discriminating column. The `schedule` drop was to be preceded by backfilling 2 "unique" `surf` values; the finding behind it joined on `(season, week, v, h)` without `season_type`, and since `schedule` holds no preseason at all, its regular-season week-1 rows had matched **preseason** week-1 rows for the same teams. Both values already existed on the correct rows, and performing the approved backfill would have invented surface data for two games the source never described. The tell was never visible in a count — it took looking at the individual rows the join had paired, and re-matching on `(season, teams, nearest date)` to absorb the OAK/LV code drift and postseason renumbering that broke the naive form.

**A retype must preserve UNIT semantics, and re-deriving a number with a different query shape does not test the population it was scoped to.** Two lessons from one defect, both live for the remaining retype clusters. First: `b09fdbce` restated `to_timestamp(gm."timestamp" - 7*86400)` as `kickoff_at - interval '7 days'` and described the forms as equivalent. They are not — a day-unit interval on a `timestamptz` is calendar arithmetic in the session timezone (production is `America/New_York`), so across the November fall-back it spans 169 hours. Hour units are absolute; day, week, and month units are not. When a retype moves epoch-integer arithmetic onto a `timestamptz`, state offsets in hours (`interval '168 hours'`, pinned in `8684b569`) and assert the calendar form is ABSENT, or the drift is invisible: it fires for one week of every season and no other, which is a seasonal artifact rather than a uniform widening. Second, and the more general one: the impact of that drift was first measured at **155 flipped rows and re-derived with a differently-shaped query that agreed**, but both shapes omitted the `player_gamelogs gl_inner` join the CTE actually performs, so both measured a population the CTE never sees — the real figure is **5**, and 580 of the 616 "extra" changelog rows belong to players with no gamelog for the game whose window they fell into. Independent derivation only catches an error the derivations do not share, and scoping is exactly what two readings of the same SQL will share. It is also not what a positive control fixes by default: the control used here (a game on the fall-back date) validated the timestamp arithmetic, which was never in doubt. Aim the control at the step that could be wrong, and anchor it on the artifact you are making the claim about — name a row, predict its value, then look for it in the output table. Doing that surfaced both the corrected count and an unrelated defect, because the predicted row was not in the table at all.

**An executed-result oracle is only as good as where its expected values came from.** The result-equivalence fixtures are the gate meant to catch semantics that valid SQL cannot, but their `expected_rows` are hand-written, and one authored by reading the current output is a screenshot rather than an oracle. `game-opponent-range-year-offset-fanout-result-equivalence.json` asserted `game_is_home: true` for a subject team its own `seed` SQL places at `away_nfl_team` in both games, so it executed happily and blessed an inverted flag alongside four query-match goldens. Derive an oracle's values from the fixture's seed data, and note that `update-data-view-snapshots.mjs` only rewrites `expected_query` — regeneration structurally cannot repair an oracle, so a wrong one must be hand-corrected.

**A regenerated data-view golden cannot catch a rename you missed.** `scripts/update-data-view-snapshots.mjs` overwrites `expected_query` with whatever the current code emits, so a golden regenerated from buggy code agrees with the buggy code and the suite goes green over a live defect. This is not hypothetical: the 2026-07 plays/snaps conformance left `build_role_union_period_cte` emitting `nfl_plays.year` against the renamed table — a 42703 on every data view carrying a rate type — and eight regenerated goldens blessed it. Auditing the regeneration diff does not help either, because that only proves each _change_ was intended; it says nothing about an old name that stayed _unchanged_. After regenerating, grep the goldens for the old names directly (they escape quotes, so match `nfl_plays\\".\\"<old>`), and treat executed result-equivalence — not query-match — as the gate.

**A golden carrying `skip_query_match: true` asserts NOTHING about its SQL — regenerating one is bookkeeping, not coverage.** The mocha harness branches on that flag: when set, it logs the SQL diff to the working-tier catalog for hand review and continues, so `expected_query` is inert and the fixture cannot fail on a query change. The trap is that every other signal still looks like coverage — the file lives in `test/data-view-queries/`, `data-view-test-cli.mjs` _does_ compare it and prints `✓ Queries match!`, and `--update` rewrites it — so a session fixes a defect, regenerates the one golden that exercises the shape, sees green, and has added no gate at all. On 2026-07-31 the week-row-axis fix landed against exactly this: `keeptradecut-value-year-week-split.json` was the only golden in the corpus requesting a `week` param, and it is `skip_query_match`. Check the flag before treating a fixture as your gate; when it is set, the coverage has to be a spec asserting on the generated SQL (or a result-equivalence fixture), and the honest proof is that the new test **fails at HEAD** — run it in a clean worktree at HEAD and confirm it goes red before trusting it green in your tree.

**Beware the inverse grep error: a pattern that matches as a SUBSTRING of a longer identifier, making dead code look live.** The documented hazard above is a pattern that cannot match; this is one that matches too much, and it reads as confirmation rather than as a zero. Grepping the goldens for `week_timestamp` to check whether a join was exercised returns 11 files — every one of them a hit on the _table_ name `nfl_year_week_timestamp`, which contains the column name as a substring. The column `nfl_year_week_timestamp.week_timestamp` appears in **zero** goldens, and the join using it is unreachable: `group_tables_by_supported_row_axes` intersects the request `row_axes` against the column's `source.grain` identity, so a `player_year`-grain column never sees a `week` axis and its week branch cannot execute. A plan had been written to fix a type error in that branch. Anchor a reachability grep on a delimiter (`\.week_timestamp`, `"week_timestamp"`) and confirm the emitted SQL, not just the file list.

**Never conclude a column is absent from a pattern-filtered `information_schema` query.** The same failure class as the grep note below, in the one place it reads as authoritative. On 2026-07-29 a session checked whether `projections` retained dated history with `information_schema.columns WHERE table_name='projections' AND column_name ~ 'time|date|year|week'`, got no timestamp back, and reported that no point-in-time projection history existed anywhere. The column is `generated_at`, which contains none of those four substrings. It is `NOT NULL` and part of the unique key, so the table had been appending 4.69M rows across 2,064 daily snapshots for two years. The wrong conclusion drove a design decision -- projections demoted to live-only, their benefit "asserted rather than measured" -- that had to be reversed. List a table's columns in full before concluding a capability is missing; a pattern filter is for reading convenience on a table you already know, never for proving a negative.

**Grep proves the absence of a string; only EXPLAIN proves the query is valid.** The golden-grep above is necessary but not sufficient, and on 2026-07-27 it missed a live defect twice. Correlated-subquery predicates are emitted as raw SQL against a generated CTE alias, so they appear _unquoted_ and _hash-named_ — `t22c9a76f62c8a62fec52ad076663a982.year IN (2024,2025)` — and match neither `nfl_plays\\".\\"<old>` nor any table-qualified pattern. A reviewer sweeping for `prop_markets_index.year` plus a fixed alias list that omitted `pmi.` likewise returned a confident zero on `pmi.year` in `update-market-settlement-status.mjs`, which had thrown 42703 on every game finalize for four days.

The gate that does work is now committed as **`db/adhoc/check-data-view-sql-validity.mjs`**, and it must run per cluster on any grain-column rename:

```
yarn test:db:up
node db/adhoc/check-data-view-sql-validity.mjs      # exit 1 on any invalid statement
```

It provisions its own database on the shared :5433 container (so it cannot collide with a sibling's suite run), loads `db/schema.postgres.sql`, generates SQL for all 551 data-view columns across the plain and `year_offset` range shapes, and `EXPLAIN`s each of the 1102 statements in about five seconds. Run ad hoc on 2026-07-27 it found six defects that 232 goldens and a fully green 2214-test suite did not; on its first committed run it found two more, both pre-existing (`player_pro_bowl_selections` naming a physical column that does not exist, and a `NaN` interpolated raw into the keeptradecut `year_offset` range SQL).

**Run it from a clean worktree at your HEAD, not from the shared tree — it reads the working tree, so a sibling's uncommitted edits are indistinguishable from your defects.** The script imports the column definitions live and loads `db/schema.postgres.sql` off disk, both from whatever is sitting in the checkout. So a sibling mid-cluster — emitter already renamed, DDL still `PENDING`, schema export not yet regenerated — makes the gate fail on _their_ transient inconsistency, reported against column names that have nothing to do with your change. On 2026-07-31 a schedule-route cluster ran the gate and got `GATE FAIL: 8` on `espn_team_win_rates_index.nfl_team does not exist`; HEAD had the correct `key_columns: { team: 'team' }` and the `nfl_team` was an uncommitted edit belonging to the live time-series-feeds session, staged ahead of its own `db/adhoc/2026-07-31-conform-espn-win-rates-feeds.sql`. The findings were real SQL failures and entirely not the running session's — and read as a pre-existing defect worth reporting. The tell is a finding on a table your cluster never touched; the check is `git status` plus `git show HEAD:<emitter>` against your tree. Get the honest number the same way you would for a build: `git worktree add ~/user-base/tmp/<name> HEAD`, symlink `node_modules`, run there, `git worktree remove`. It costs one command and the gate still provisions its own database, so it cannot collide.

**A bare import that is not in this repo's `package.json` still resolves — from user-base's ROOT `node_modules`, one level up — and no gate here catches it.** Node walks parent directories, so a package absent from `repository/active/league/node_modules` is found at `/Users/<you>/user-base/node_modules` and everything looks fine from the real checkout. It breaks only where that ancestor is missing: a worktree under `/tmp`, a CI checkout, a production host. `league-import/espn.mjs` imported `node-fetch` this way until 2026-07-31, and a `/tmp` worktree therefore killed the **whole suite at load** with `ERR_MODULE_NOT_FOUND` before a single test ran — while the SQL-validity gate and individual golden specs still passed, because neither loads `test/importer-espn.spec.mjs`. So `/tmp` appeared to work right up until you asked for the number that mattered.

That import is gone (the file now uses Node's global `fetch`), and `node-fetch` was the only such package — every other unresolved bare specifier in the tree is a webpack alias or a Node builtin. A worktree at `/tmp` runs the full suite green today. The recipes above still say `~/user-base/tmp/` because it costs nothing and keeps the scratch under one root; that is preference now, not a constraint. What is worth keeping is the check: **before adding an import, confirm the package is in this repo's `package.json`** — a parent-resolved dependency produces no error, no lint failure, and no gate finding on the machine you develop on.

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
ssh league "cd /root/league && git rev-parse --short HEAD"           # against origin/master
ssh digitalocean-0 "cd /root/league && git rev-parse --short HEAD"   # odds/plays import workers
ssh base-storage "cd /home/user/league && git rev-parse --short HEAD" # seasonal Underdog ADP ingest
```

**Check all THREE checkouts — `base-storage` is the one that bites.** It is a functional code checkout running a production importer, but it sits outside the `yarn deploy` fan-out entirely, so nothing auto-pulls it and no deploy step touches it. On 2026-07-29 it was 238 commits behind: its `find_player_row` still named `player.formatted` after the rename to `formatted_name`, so every player lookup threw. Because the Underdog best-ball ADP importer catches per-player lookup failures and counts them as unmatched, the run produced zero inserts, exited 0, and reported success **daily for three weeks** while writing nothing — the rename's blast radius reached a host the sweep never considered, and the exit-code oracle could not see it. A rename sweep that checks only `league` is not complete. See [[user:task/league/keep-base-storage-league-checkout-current.md]].

Note the cron schedules make this class of defect latent until the season starts (`0 9 * 1,2,9-12 2` for the injury index), which is the same shape as the prop-settlement 42703 — offseason silence is not evidence that a sweep landed.

When a rename does turn up a bad golden: **fix the code first, regenerate second, EXPLAIN third.** Regenerating first only re-blesses the defect. And declare `key_columns: { pid, year }` on any data-view source whose CTE projects `season_year` — `param-utils.mjs` silently defaults `year_column` to `'year'` when a source omits it, which is a rename that no grep of the source tree will ever surface.

Before regenerating, prove the golden is the thing that is wrong. A golden that disagrees with your change may be encoding semantics you just broke: on 2026-07-27 a `.year BETWEEN` predicate that was invalid without a year split turned out to be **valid and load-bearing** with one (the CTE projects `season_year as year` only when a year row axis is present), and the golden that failed was the only signal. The fix was to guard the predicate on `year_reference`, not to regenerate. Confirm the delta is exactly what you intended by reversing your change on the generated string and checking it reproduces the old golden byte for byte.

**String-level reversal only works for a change that SUBSTITUTES text — for one that adds structure, reverse the code instead, in a worktree at HEAD.** A change that appends a UNION arm, a CTE, or a join cannot be undone by deleting the matching text: on 2026-07-30 two new role-union arms were stripped by splitting the generated SQL on `union all` and dropping the arms naming the new roles, which also deleted the trailing `) as "role_union" inner join "nfl_games" ...` that belonged to the last arm, and the "reversal" then differed from the golden at char 0 on several fixtures. The rig looked like it had found a problem when it had only mangled the SQL. The reliable form costs one command: `git worktree add ~/user-base/tmp/<name> HEAD`, symlink `node_modules`, run the golden spec there against its own database, and confirm it is **fully green**. That proves the committed goldens encode current-master behaviour, so every failure in your tree is your change alone — which is the claim you actually need before regenerating, and it holds no matter what shape your change takes. Pair it with reading the first divergence point of each failing golden to confirm the inserted text is only what you added.

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

**`yarn deploy` does NOT update cron — the crontab is a separate deploy.** A code deploy ships the scripts but leaves the schedule and its ARGUMENTS untouched, so a script whose flags changed will keep running under the old ones with no error anywhere. On 2026-07-29 an external-league importer was deployed with new `--import_limit`/`--resync_limit` budgets while the installed crontab still passed a removed `--limit 250`; the job would have run weekly with stale arguments indefinitely. Ship both: `yarn deploy` then `server/deploy-crontab.sh league server/crontab-main`. Note the installed file is machine-built (`base crontab build`, which injects `JOB_SCHEDULE`/`JOB_SCHEDULE_TYPE`), so never hand-edit `~/crontab/*` on the host — and before deploying, diff the installed job lines against the source with the injection stripped, since the crontab directory is shared and carries every session's committed changes, not just yours.

**A fixed sleep between requests does not rate-limit anything.** It ADDS to network latency rather than bounding a rate, so the achieved rate depends entirely on which host runs the job — and the fast host is always the one that ships. Measured 2026-07-29 on the Sleeper importer with a fixed 120ms sleep: round trip was ~670ms from a workstation (~76 req/min) but ~43ms from the production VPS, which would have run the identical code at ~350 req/min, roughly 4x the vendor's conservative published figure. The workstation measurement looked reassuring and was pure artifact of a slow link, which is the real trap: it is easy to "verify" a throttle somewhere it will never run. Pace against elapsed time instead — hold a `next_request_at` timestamp and advance it from `max(now, next_request_at) + interval`, so the ceiling is deterministic on any host and a slow response cannot bank credit toward a later burst. See `scripts/import-sleeper-external-league-trades.mjs`.

**A bare `.merge()` on an upsert asserts EVERY column the insert names, including ones another pipeline owns.** A generator that hardcodes a constant for such a column silently reverts the owner's writes on every run, and nothing fails — the row is simply wrong afterward. `generate-player-gamelogs.mjs` hardcodes `active: true` (correct for a player with counting stats) while `player_gamelogs.active` is owned by `import-nflverse-weekly-rosters.mjs`, which maps game-day roster status onto it (ACT -> true; INA / RES / DEV -> false). With a bare `.merge()` the UPDATE half reverted every game-day-inactive flag the run touched: regenerating one 2014 game flipped six. Fixed by merging every column except `active`, which keeps the insert value for a new row and leaves an existing one to its owner. Before adding a column to any upsert here, ask which script is the writer of record for it — the INSERT and the UPDATE halves of an upsert do not need the same column set, and for a foreign-owned column they must not have it.

**A `--esbid`-style narrowing flag has to filter the collection the writes are derived FROM.** The same script's flag filtered only `unique_esbids`, which feeds the routes / dropbacks / snap loads, while every gamelog was built from an unfiltered `playStats` — so it wrote the whole week and logged one game. It also compared a numeric column against a yargs `type: 'string'` option, so the filter matched nothing and reduced the auxiliary loads to zero games while the full-week write proceeded regardless. Two rules for a scoping flag on a backfill tool: filter the source collection, not a derived index, and throw when the scope selects nothing rather than falling through to the unscoped write.

### Testing

- Mocha with Chai assertions
- Test files: `test/*.spec.mjs`
- Global setup in `test/global.mjs` drops all tables, loads schema, runs seeds
- MockDate for time-dependent tests
- Environment: `NODE_ENV=test`, timezone: `America/New_York`

**The suite does not run on Node > 22 — honor `.nvmrc` (22.22.1) before debugging anything else.** mocha 11.0.1's bundled yargs is CJS loaded from an ESM context, so on Node 26 every invocation dies at load with `ReferenceError: require is not defined in ES module scope` before a single test executes. The failure is not a database problem and names no spec, so it reads like a broken harness or a broken change; it reproduces identically on an untouched spec, which is the cheapest way to tell it apart from your own work. Nothing in `yarn test`, `yarn test:local`, or a direct mocha invocation checks the running Node version, and a shell that has drifted off the pinned version gives no other signal. Run `node --version` first, and `. "$HOME/.nvm/nvm.sh" && nvm use` to pin it (`nvm use` is not inherited across Bash tool calls, so re-source it in each one).

**Local test database requires Postgres >= 15.** `db/schema.postgres.sql` uses `NULLS NOT DISTINCT` (Postgres 15+); loading it against an older server fails in `test/global.mjs` with `syntax error at or near "NULLS"`. `config/config-test.json` connects to `127.0.0.1:5432`; `db/index.mjs` honors `LEAGUE_DB_HOST`/`LEAGUE_DB_PORT`/`LEAGUE_DB_USER`/`LEAGUE_DB_PASSWORD`/`LEAGUE_DB_DATABASE` overrides (note: the `yarn test` script blanks `LEAGUE_DB_HOST`/`LEAGUE_DB_PORT`, so to target a non-default port invoke mocha directly rather than through `yarn test`).

**With nothing listening on :5432, `yarn test` HANGS rather than failing.** The connection pool retries until its timeout instead of surfacing `ECONNREFUSED`, and `--reporter min` prints nothing until the run ends, so a suite that will never start is indistinguishable from a slow one — on 2026-07-30 this ate a 15-minute background task before anyone checked. If a `yarn test` run produces no output for more than a minute, check `psql -h 127.0.0.1 -p 5432 -c 'select 1'` before debugging the suite, and use the `:5433` container path below.

**A reachable :5432 does not clear this — the hang also happens when the server is up but lacks the test ROLE, and the documented `select 1` check does not discriminate it.** A Homebrew Postgres on :5432 has no `league_test` role (only the `:5433` container creates the roles, via `db/test/init-roles.sql`), so `test/global.mjs` dies immediately on `role "league_test" does not exist` and then hangs exactly as it does with nothing listening. The `select 1` probe answers `FATAL: database "<you>" does not exist` — reachable server, unrelated-looking psql quirk — so the documented check passes while the suite is already dead. On 2026-07-31 this ran for two hours and was nearly reported as an unverified test result. Two rules: probe with the credentials the suite actually uses (`psql -h 127.0.0.1 -p 5432 -U league_test -d league_test -c 'select 1'`), not a bare `select 1`; and prefer the `:5433` container path unconditionally, giving your run its own database (`LEAGUE_DB_DATABASE=league_test_<slug>`) so it neither collides with a sibling nor depends on local role state. The same suite that hung for two hours on :5432 ran green in **2 minutes** on the container.

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
