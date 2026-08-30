# Dead code (knip)

`yarn knip` reports files and exports nothing reaches. Load this before acting on what it says.

## Nothing outside league imports league

There is no `#league/*` alias in user-base and no sibling repo depends on this tree, so an unused file here really is unused. The base repo is the opposite case — its `libs-server/` is consumed cross-repo — and its own `docs/guides/dead-code.md` explains the trap that creates.

## What knip cannot see here, and is told about

Four categories have no static importer and are declared as entries rather than ignored. Each entry glob in `knip.json` carries the reason:

- **`db/gates/`, `db/tools/`, `db/adhoc/`, `db/archive/`** — standalone programs invoked by PATH from `.github/workflows/` and `yarn check:*`, never imported.
- **`db/migrations/`, `db/fixtures/`** — loaded by knex from the directory.
- **`private/scripts/`** — the submodule mirrors the public layout, so it is an entry surface exactly like `scripts/`. Leaving it out made `private/libs-server/` read as unused too, because nothing traversed its only callers.
- **`app/core/worker/index.js`** — reached only as `import('workerize-loader?inline!../worker')`. knip cannot resolve a loader-prefixed specifier, so it reported the live shared web worker as dead. This is the shape to watch for: a false positive that looks exactly like a genuine one.

Add another registry of any of those shapes and it gets an entry glob with a comment, not an `ignore`.

## `private/` is absent on the runner

`private/` is a submodule no workflow checks out, so in CI it is an empty directory. That is benign for knip — the files are missing rather than unreferenced, and core may never statically import `#private`, so the rest of the graph is unchanged. It does mean CI covers everything except `private/`, which has to be checked from a local clone.

## Current state

Not a CI gate, because the count is not yet zero. As of 2026-08-29 it reports 41 unused files, all genuine candidates rather than config gaps. The bulk is orphaned UI: about 29 files forming self-contained component islands under `app/views/components/` — `toggle/`, `editable/`, `checkbox-item/`, `age-filter/`, `settings-switch/`, `generate-schedule/` and the `selected-player-team-*` set — each an `index.js` plus its component with no importer outside its own directory. `age-filter` is the honest one: `app/views/pages/players/players.js` still carries its import commented out with a TODO.

The rest is a handful of server modules plus two dead `app/core/*/index.js` barrels whose siblings (`actions`, `reducer`) are imported directly.

Clear those and knip is safe to wire into `test.yml` alongside the other checks, in an existing job so it costs no extra runner.
