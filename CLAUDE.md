# CLAUDE.md

Guidance for Claude Code working in this repository.

For graph context (related task directory, system docs, sibling repos), see [ABOUT.md](ABOUT.md). System architecture, data model, deploy topology and data sources are canonical in user-base under `text/league/` — link to them rather than restating here.

## What belongs in this file

This is the only file in the repo an agent reads **involuntarily**. Everything else is elected — a session opens it because it knows what it is about to do. That property, not importance, decides what may live here.

Before adding anything, ask: **what would a session have to already know it was doing, in order to look this up?**

- **There is an answer.** That answer is the trigger. The content belongs in the guide for that undertaking, and this file gets one line routing to it.
- **There is no answer**, because a session hits it without choosing to — the shared tree, the push queue, a suite invocation. That is what this file is for.

Two consequences worth stating outright. **This file must be true without verification**, because a session reading it did not choose to be here and will not stop to check: no commit hashes, no counts, no dated incidents, no identifier a conform could move. And **the rule lives here, the instance lives in the guide** — an instance on this surface is a defect regardless of how short it is.

## Where the rules live

| Before you...                                                        | Read                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Apply any DDL — a rename, retype, drop, or grain-widening change     | [docs/guides/schema.md](docs/guides/schema.md)       |
| Commit for production, push, or deploy                               | [docs/guides/ship.md](docs/guides/ship.md)           |
| Run or write a test                                                  | [docs/guides/test.md](docs/guides/test.md)           |
| Touch anything under `app/`                                          | [docs/guides/spa.md](docs/guides/spa.md)             |
| Change how anything LOOKS — a `.styl` file, a token, a page's layout | [STYLE.md](STYLE.md)                                 |
| Touch a data-view column, param, field factory or golden             | [docs/guides/data.md](docs/guides/data.md)           |
| Touch anything under `api/`                                          | [docs/guides/api.md](docs/guides/api.md)             |
| Touch `scripts/`, `jobs/` or a crontab                               | [docs/guides/scripts.md](docs/guides/scripts.md)     |
| Touch the free agency auction, its sockets, routes or components     | [docs/guides/auction.md](docs/guides/auction.md)     |
| Add a gate, check, ratchet or negative control                       | [docs/guides/gates.md](docs/guides/gates.md)         |
| Edit any file carrying `//@ts-check`, add the pragma, or opt one out | [docs/guides/gates.md](docs/guides/gates.md)         |
| Act on a `yarn knip` finding, or delete a module that looks unused   | [docs/guides/dead-code.md](docs/guides/dead-code.md) |

Each guide carries the full arc of its undertaking, incidents included. They are long on purpose: a session doing one of these needs all of it at once, and none of it otherwise.

## Project Overview

**xo.football**, an open-source fantasy football league management platform: live auctions, advanced analytics, betting market integration, and configurable data views. React/Redux frontend, Express.js/PostgreSQL backend.

## Rules that hold for every session

These are the ones you cannot route to, because you hit them without deciding to.

**The working tree is shared with concurrent sessions.** Attribute uncommitted changes before acting on them, and never stash or revert work you did not author. `dist/` is a build artifact directory that survives commits and can hold a sibling's finished build of an undeployed change, so a clean `git status` is not evidence it is safe to ship.

**A red master defers every session's push, not just yours.** The pre-push guard reads the latest run on the branch regardless of workflow, so a failure in one commit parks unrelated work behind it. The block is time-bounded — it lifts on its own once the branch has been red for an hour — so a queued fix that cannot push itself is a wait, not a deadlock. If you turn master red, post a bulletin naming the cause so siblings do not debug your gate. Read which workflow and which step failed before attributing anything — an install failure and a real one are indistinguishable from a run's status alone.

**DDL, the schema export, and the code that depends on them ship in ONE commit.** Between the apply and the commit, any other session's `yarn export:schema` will carry your change without your sweep. This is stricter than the deploy rule: a deploy can lag, a commit cannot.

**Use `yarn test:isolated`, never `yarn test:db:up && yarn test`.** The test database is a shared singleton and the suite drops every table in it, so two concurrent runs destroy each other and the wreckage reads as a regression in whatever you were editing rather than as a collision. `test:isolated` gives your run its own database and drops it afterwards; `yarn test:local` still shares. Never hand-assemble the invocation from environment variables — pointing at a database that does not exist hangs indefinitely rather than failing, printing nothing, as does the port mismatch above. If a run produces no output for more than a minute, treat it as a hang and check before waiting.

**Nothing auto-deploys. Deploys are human-gated, and the recurring incident is a partial one.** Prefer `yarn deploy:all` over the individual steps, which are each independently skippable and skip silently.

**Nothing destructive runs against a target it has not verified.** `db/guard-destructive-target.mjs` refuses on the live database's own identity rather than on `NODE_ENV`, and there is deliberately no bypass flag.

**`debug()` is dark in production, so a `log(...)` line is not a report.** The deployed API sets no `DEBUG`, which makes every `debug`-namespaced call — including the `this.logger` on a socket — write nothing at all on the server. An error handler whose only outward surface is such a line is silent, and a degraded subsystem then looks exactly like a healthy one from outside the process. Anything a human needs to learn about needs `emit_signal`, and anything that can recover needs `resolve_signal` beside it. Both no-op outside production, so a spec that does not inject them passes with the call site deleted.

**Never put a secret value as a literal in any command.** Tool calls are recorded verbatim in a synced, indexed timeline. Use indirection; if a literal was emitted, treat it as exposed and rotate.

**This repository is PUBLIC, and every file in it is published — including entity files.** Two consequences that catch sessions without warning:

- **`public_read: false` on an entity here means nothing.** That field governs the base API; it has no bearing on GitHub. An entity file tracked in this repo is world-readable whatever its frontmatter says, so `base entity observe` against one is a publishing action. Anything private — infrastructure topology, a security finding before it is fixed and deployed, credentials of any kind — belongs in an entity under `text/` in the user base, never here.
- **Every value in `config/config-development.json` and `config/config-test.json` is published.** Only `config-production.json` is encrypted. Those two hold placeholders only: never a real credential, and never a value shared with production.

### The verification rule

Stated once here because it applies to every undertaking, and it is the single most repeated lesson in this repo's history:

- **A green you have not shown can go red is not evidence.** Before trusting a gate, a grep, a spec or a deploy check, make it fail on a case you know is broken. A check that cannot report is indistinguishable from a clean result, and it fails in the direction that looks like success.
- **A red you have not diffed against the baseline is not evidence either.** The rule above says make the check fail; this one says prove YOUR break is what failed it. Run the control and the unperturbed case as a pair and require the two readings to DIFFER — a check already red for an unrelated reason swallows your injected fault and reports the same number both times, which looks exactly like a control that fired.
- **Validate a negative pattern against a match you know exists.** A pattern that cannot match returns a confident zero.
- **Anchor on the syntactic role, not the token.** A name present in a different role proves nothing about the one you are testing.
- **Prefer executing the behavior over reading the source.** "The fix is in the source" and "the deployed artifact no longer has the defect" are different claims.
- **An input that cannot distinguish the old rule from the new one makes the check vacuous**, however real the data is. Run it as a pair against a control and require the two to differ.
- **Enumerate an affected class from the code that defines it, not from the names of its first symptoms.** A defect in shared machinery reaches everything routed through that machinery, and the cases you noticed first share a naming convention rather than a cause. Scoping by name finds whatever fraction happens to be named alike, reports a confident total, and leaves the rest in place.
- **Sample anything time-dependent at more than one instant.** A value read once cannot be distinguished from one that recedes, drifts or resets on every read — at any single instant both produce exactly the answer you expect, so the assertion passes and keeps passing. Walk the input that moves it and assert on the trajectory.
- **Check an inherited count against the population that contains it before you act on it.** The rules above govern checks you run; this one governs figures you are handed, in a plan or a brief, which arrive with no check attached and get spent as premises. A subset cannot exceed its superset, a graded count cannot exceed the rows that exist, and a per-book figure cannot exceed that book's total — so one containment query refutes a wrong number outright, costs nothing, and needs no theory about where it came from. Run it before designing anything on top, because a plan built on an impossible measurement points confidently at the wrong subsystem.

## Development Commands

**Development**

- `yarn dev` — frontend and API together; `yarn start` / `yarn start:api` for one at a time

**Code quality**

- `yarn lint` — ESLint, carrying the local `no-bare-container-jsdoc` ratchet
- `yarn check:types` — the opt-in `//@ts-check` tier
- `yarn check:jsdoc-baseline`, `yarn check:test-collection`, `yarn check:cluster` — the gate runners
- `yarn prettier` rewrites the WHOLE tree and ignores extra arguments. Scope with the binary: `npx prettier --check <files>`

**Testing**

- `yarn test:isolated` — the suite against a private database on the shared `:5433` container, dropped afterwards; takes mocha arguments
- `yarn test:db:up` / `yarn test:local` / `yarn test:db:down` — throwaway Postgres 16 on `:5433` and the suite against its shared default database. `test:db:up` only reaches for docker when nothing is already serving the port, so the suite runs unchanged inside a container that has no docker

**Build and deploy**

- `yarn deploy:all` — the deploy path: preflight, backend to both hosts, then bundle and sourcemaps
- `yarn preflight:deploy` — read-only; safe to run alone to check whether a deploy would be honest
- `yarn build`, `yarn deploy`, `yarn deploy:dist`, `yarn deploy:sourcemaps` — the individual steps
- Deploy targets: `league` (API and frontend), `digitalocean-0` (odds and plays workers)

**Schema**

- `yarn db:exec db/adhoc/<file>.sql` — apply an adhoc file as one transaction
- `yarn export:schema` — regenerate `db/schema.postgres.sql`, the source of truth

## Architecture

**Frontend (`/app/`)** — React/Redux with Immutable.js. Domain modules in `app/core/` (`actions.js`, `reducer.js`, `sagas.js`, `index.js`), centralized selectors in `app/core/selectors.js`, Redux-Saga for async and WebSocket handling, components in `app/views/components/` with co-located `.styl`. React Router v6 with nested league routes under `/leagues/:lid/`.

Webpack aliases: `@core` → `app/core`, `@libs-shared` → `libs-shared`, `@constants` → `libs-shared/constants`, `@components` → `app/views/components`.

**Backend (`/api/`)** — Express with modular routing in `api/routes/`, JWT auth via `express-jwt`, WebSockets in `api/sockets/` (auction, scoreboard, data view, external league import), Knex at `req.app.locals.db`.

**`libs-shared/`** — isomorphic: business logic (`roster.mjs`, `calculate-points.mjs`, `calculate-values.mjs`), constants, data-view field definitions, the league format catalog.

**`libs-server/`** — server-only: data source integrations, roster operations, database helpers, external APIs.

**`private/` is a downstream plugin, and dependencies run one way.** It is a submodule no workflow checks out, so on the runner and in any clone it is an empty directory. Core — `libs-shared/`, `libs-server/`, `api/`, `app/` — must never STATICALLY import `#private`, because a module that cannot resolve aborts the suite during load and reports zero tests rather than one failure. `scripts/` and `jobs/` are entry points the suite never loads and may import it freely; a vendor wrapper in core may reach it through a lazy `await import()` inside the function that needs it. Enforced by `local/no-private-import-in-core`, baseline-free. When a core module needs private, ask which half needs it and move that half to a script rather than deferring the import — see [docs/guides/test.md](docs/guides/test.md).

**Database** — PostgreSQL: fantasy operations, NFL data (with partitioned play, snap and gamelog tables) and betting markets. Managed via SQL dumps, not incremental migrations. Every table sits in one of four layers — source, identity resolution, canonical, time-series — or outside the model in application state, and which one it is decides whether an importer may overwrite it and whether it needs a changelog; the map is `user:text/league/database-architecture.md`. `db/` is split by LIFECYCLE, not subject matter — read `db/README.md` before adding a file to it.

**ES modules** — all server-side files are `.mjs`. Import aliases in the `package.json` imports field: `#config`, `#db`, `#libs-server`, `#libs-shared`, `#constants`.

**Configuration** — `config.js` loads `config.{NODE_ENV}.js`; separate development, production and test configs.

**Code style** — Prettier with single quotes, no semicolons, no trailing commas. ESLint extends standard, camelcase off, curly off. Components use functional patterns with hooks.

## Key Documentation

| Document                                                                             | Description                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [docs/player-management.md](docs/player-management.md)                               | Player lookup, creation, updates, external ID management      |
| [docs/data-views-architecture.md](docs/data-views-architecture.md)                   | Row-grain identities, bridges, source attach, column contract |
| [docs/data-views-system.md](docs/data-views-system.md)                               | Dynamic table configuration and field definitions             |
| [docs/api-documentation.md](docs/api-documentation.md)                               | API endpoints and authentication                              |
| [docs/glossary.md](docs/glossary.md)                                                 | Fantasy football terminology and abbreviations                |
| [docs/named-formats.md](docs/named-formats.md)                                       | League scoring format definitions                             |
| [docs/context-documents.md](docs/context-documents.md)                               | Server-generated league and team context docs                 |
| [docs/fantasy-points-column-definition.md](docs/fantasy-points-column-definition.md) | Fantasy points calculation system                             |

## Domain reference

### League context

Most operations occur within league context (`/leagues/:lid/`). Verify permissions for team operations with the helpers in `libs-server/verify-user-team.mjs`.

### Season constants

From `libs-shared/constants/season-constants.mjs`:

- `current_season.year`, `current_season.week` (the continuous counter from `regular_season_start`, not per-type)
- `current_season.nfl_seas_type` (`PRE`/`REG`/`POST`), `nfl_seas_week` (resets to 1 in POST), `last_completed_season_year` (stable across the Super Bowl gap and offseason)
- `current_season.active_fantasy_week` — the week fantasy operations target, floored to 1 so it is never the season-long 0 slot. `.week` and `.fantasy_season_week` can both be 0; this one cannot, and that is what its name says. Never re-derive it inline — `local/no-week-reconstruction` forbids it.
- `current_season.is_offseason`, `current_season.is_regular_season`, `current_season.is_waiver_period`
- `fantasy_weeks`, `nfl_weeks` — module exports, not members of `current_season`

Every member of `current_season` is snake_case, and every clock-dependent one is a GETTER. Read them off the object at the point of use; never copy one into a module-level const, which freezes it at import and never moves again.

**Two week concepts, and they are a whole season apart for half the year.** The CURRENT week is the one in play or next up (`current_season.year`, `current_nfl_week_params()`); the LAST COMPLETED week is the most recent one with results (`current_season.last_completed_season_year`, `last_completed_nfl_week_params()`). They are equal during the season and differ for the six offseason months, so reaching for the wrong half is invisible from August to February and then silently serves the prior season. Anything forward-looking — salaries, projections, betting markets, practice reports, schedules — wants the current half.

Never reconstruct an `nfl_week_id` locally — use the canonical helpers in `libs-shared/nfl-week-identifier.mjs`. See `docs/data-views-system.md` for the choke-point rules, and [docs/guides/scripts.md](docs/guides/scripts.md) for what these getters read in the offseason and preseason.

### Format identity

`league_scoring_formats.id` and `league_formats.id` are opaque — snake_case slugs for the named catalog, `gen_random_uuid()` for the long tail. Never reintroduce a content-derived hash as an identifier; see `user:guideline/schema/avoid-content-derived-identity.md`.

### Player IDs

`FNAM-LNAM-<serial>` (for example `PATR-MAHO-000123`): a frozen four-plus-four letter name prefix that is a courtesy snapshot carrying no identity, plus an opaque immutable zero-padded serial from a dedicated sequence that IS the identity. Never regenerated, and independent of date of birth or draft year. DST pids are the bare team abbreviation. See [docs/player-management.md](docs/player-management.md).

### Poaching

Teams can poach from practice squads. Normal flow adds the player to the bench and removes them from the original team. When the poaching team lacks space after designated releases, the poach creates a `POACHED` transaction, immediately releases the player to waivers, and is still marked successful.

When a poached player is released, `handle_super_priority_on_release()` in `process-release.mjs` creates a `super_priority` record and auto-creates a `FREE_AGENCY_PRACTICE` waiver if the original team has practice squad space, or requires a manual waiver if not. Orchestration is in `libs-server/process-poach.mjs`.

### Real-time

WebSocket endpoints in `api/sockets/`: `auction.mjs`, `scoreboard.mjs`, `data_view.mjs`, `external-league-import.mjs`.

### Data views

Dynamic table configurations in `app/core/data-views/` with configurable columns and filters, WebSocket updates, CSV export and saved views. Field definitions in `libs-shared/data-view-fields-index.mjs`. Service objectives live at [[user:text/league/data-views/data-view-service-objectives.md]].

A second tier executes generated SQL under a sandbox — the `league_data_view_reader` role on its own connection pool, guarded by a `libpg-query` parse. Before touching it, read [docs/data-views-system.md](docs/data-views-system.md#sandboxed-sql-tier): the controls are load-bearing individually and two of them stop attacks the others cannot.

Views can also be built by a tool-using agent from a natural-language instruction. **League runs no model and no agent loop** — the loop is a harness session in a container on base's managed rail, and league supplies a job row, a dispatch seam, six CLI tools and a socket. Before touching any of it, read [docs/data-views-system.md](docs/data-views-system.md#agentic-view-generation): access is gated per account and closed by default, and several of its guarantees are narrower than their names suggest.

### Script pattern

```javascript
import { is_main } from '#libs-server'
const main = async () => {
  /* logic */
}
if (is_main(import.meta.url)) {
  main()
}
```

Use `handle_season_args_for_script()` for year and week parameters. Scripts under `db/` are invoked by relative path and must call `main()` bare instead — see [docs/guides/scripts.md](docs/guides/scripts.md).

### Player management quick reference

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
