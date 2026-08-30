# Dead code (knip)

`yarn knip` reports files and exports nothing reaches. Load this before acting on what it says.

## Nothing outside league imports league

There is no `#league/*` alias in user-base and no sibling repo depends on this tree, so an unused file here really is unused. The base repo is the opposite case — its `libs-server/` is consumed cross-repo — and its own `docs/guides/dead-code.md` explains the trap that creates.

## What knip cannot see here, and is told about

Six categories have no static importer and are declared as entries rather than ignored. Each entry glob in `knip.json` carries the reason:

- **`db/gates/`, `db/tools/`, `db/adhoc/`, `db/archive/`** — standalone programs invoked by PATH from `.github/workflows/` and `yarn check:*`, never imported.
- **`db/migrations/`, `db/fixtures/`** — loaded by knex from the directory.
- **`private/scripts/`** — the submodule mirrors the public layout, so it is an entry surface exactly like `scripts/`. Leaving it out made `private/libs-server/` read as unused too, because nothing traversed its only callers.
- **`app/core/worker/index.js`** — reached only as `import('workerize-loader?inline!../worker')`. knip cannot resolve a loader-prefixed specifier, so it reported the live shared web worker as dead.
- **`libs-server/prop-market-settlement/worker/market-calculator-worker.mjs`** — a `worker_threads` entry. `scripts/process-market-results.mjs` builds its path as a string and spawns it with `new Worker(worker_path)`. Its sibling `market-data-handlers.mjs` is reached through it and needs no entry of its own.
- **`libs-server/data-views/generation/generate-data-view.mjs`** — the emit contract for data-view generation, with no in-repo importer BY DESIGN. Generation is an agentic container session rather than a league module, so the consumer of `generated_table_state_schema`, `SHAPE_PROMPT` and `AGENT_INSTRUCTIONS` lives outside this repo.

Add another registry of any of those shapes and it gets an entry glob with a comment, not an `ignore`.

**The two worker cases are the shape to watch for.** Both were live and both reported as dead, indistinguishably from a genuine finding, because the only reference to each is a string. Before trusting any single unused-file result, grep for the filename as a STRING as well as as an import specifier.

## `private/` is absent on the runner

`private/` is a submodule no workflow checks out, so in CI it is an empty directory. That is benign for knip — the files are missing rather than unreferenced, and core may never statically import `#private`, so the rest of the graph is unchanged. It does mean CI covers everything except `private/`, which has to be checked from a local clone.

## The gate

`yarn knip --include files` runs as its own step in `test.yml`, in the existing job so it costs no extra runner, and separate from `yarn lint` and `yarn test` so the three signals cannot mask each other. The count is zero and must stay there.

**Only the unused-FILES report gates.** The unused-EXPORTS report is not trustworthy and must never be acted on. Dependency reports are a separate cleanup that is not clean yet. Configuration hints are printed but do not affect the exit code — measured, not assumed.

## What a commented-out import proves

Nothing on its own, and it is the trap that makes an abandoned component look paused. Five of the deleted components carried one: `age-filter` under a `TODO — fix` in `players.js`, `auction-transaction` in `auction.js`, and the three `selected-player-team-*` under a `temp disable` block in `selected-player.js`. Every one of those comments dated to 2022 or 2023, and every touch to the components since was a mechanical sweep — a rename, an alias migration, a `parseInt` replacement — never intent.

`age-filter` settled it beyond the dates: it read `players.get('age')` and `players.get('allAges')`, and neither key exists in the players reducer, so uncommenting the import would have thrown rather than restored a filter. **Check whether the commented-out code could still run.** A stale comment is a claim about the past; whether its dependencies survive is a fact about the present.

Delete the comment with the component. A commented-out import naming a file that no longer exists is worse than either alone.

## Current state

Zero unused files. The 41 reported on 2026-08-29 resolved as 39 deleted and 2 kept as entries — the `worker_threads` worker and the generation emit contract, both above.

Of the 39: about 29 were orphaned UI component islands under `app/views/components/`; the rest were three dead barrels (`app/core/plays-view-request/`, `app/core/selected-player-plays-request/` and `private/libs-server/draftkings/`, each with siblings imported directly), a never-mounted 2022 stub route at `api/routes/leagues/sync.mjs`, a superseded `private/libs-server/betmgm.mjs`, a comment-only placeholder at `libs-server/wager-analysis/prop-combination-utilities.mjs`, an unimported barrel at `libs-server/external-fantasy-leagues/utils/index.mjs`, `libs-server/composite-market-value/resolve-format-category.mjs`, and `libs-shared/validators/personnel-group.mjs` — which imported `create_object_preset_validator` from `react-table`, a name that package does not export, so it would have thrown on import had anything imported it.

Deleting a component means deleting its `.styl` too. knip does not track stylesheets, so nothing will tell you.
