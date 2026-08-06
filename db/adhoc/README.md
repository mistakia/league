# db/adhoc

Append-only audit trail of one-shot SQL run against `league_production` via
`yarn db:exec`. **Every file here is dated, was run once, and is never edited
again.**

Nothing else belongs in this directory. The durable tooling that used to live
alongside this history moved out on 2026-08-06 — see [../README.md](../README.md)
for the four-way split and the rule for each directory. The test is lifecycle,
not subject matter: if a file would ever be edited after it runs, it is not an
adhoc migration.

## Conventions

- Filename: `YYYY-MM-DD-<slug>.sql`, where the date is the RUN date.
- One file per logical change. Statements that must succeed atomically go in one
  file — `yarn db:exec` wraps each invocation in a single transaction.
- Do NOT wrap a file in `BEGIN`/`COMMIT`. The wrapper supplies the transaction
  and a nested `BEGIN` only emits a warning. Some older files carry the redundant
  pair; they are not the pattern to copy.
- Include a `-- STATUS: PENDING` header line. It is machine-owned: `db:exec`
  rewrites it to `-- STATUS: APPLIED <date> against league_production` on success
  and REFUSES a file already marked applied. Commit the rewritten header in the
  same commit as the apply.
- A correction is a NEW dated file. Never edit a file that has already run.

A handful of `.mjs` and `.py` files carry dates too. Those are one-shot data
repairs that needed more than SQL; same rule, equally spent.

## A dated file may name a tool path that no longer resolves

Several files here carry a header comment telling you to run something like
`node db/adhoc/audit-schema-conformance.mjs`. That path moved on 2026-08-06 and
those comments were deliberately NOT rewritten — a file here is a record of what
was done at the time, and editing it to stay current is exactly the thing this
directory's contract forbids. Treat such a line as history, not as an
instruction you can paste.

The tooling is where `../README.md` says it is: durable gates under `db/gates`,
standing tools under `db/tools`, and closed-cluster scripts under `db/archive`.
`audit-schema-conformance.mjs` is now `db/tools/audit-schema-conformance.mjs`,
`check-*.mjs` is now `db/gates/check-*.mjs` unless it is in `db/archive`.

At least one such reference (`check-migration-coverage.mjs`) named a file that
had already ceased to exist before the split, which is the same class and a
reminder that this is not new: a comment in an append-only file is dated the day
it was written.

## Workflow

```bash
# 1. Author the SQL, including the -- STATUS: PENDING banner
# 2. Review locally; dry-run it if it deletes or rewrites rows (see below)
yarn db:exec db/adhoc/2026-05-04-rename-pp-columns.sql

# 3. Refresh the schema dump
yarn export:schema

# 4. Commit the adhoc file (banner now APPLIED) and the schema diff TOGETHER
git add -- db/adhoc/2026-05-04-rename-pp-columns.sql db/schema.postgres.sql
git commit -m "Rename pp/ppp/pp_pct/doi columns"
```

Step 4 is one commit on purpose. Between the apply and the commit, any other
session's `yarn export:schema` will pick your column up and ship it without your
sweep — that window is how master went red on six tests in 2026-07 for a session
that had done nothing wrong and committed nothing.

## Two traps this directory's own rules create

**A dry-run copy must live OUTSIDE this directory.** The banner check applies to
anything under `db/adhoc` and accepts exactly `PENDING` — it refuses `APPLIED`
outright and refuses anything else as carrying no machine-readable status. So a
copy here either cannot run or is indistinguishable from the real file. Put it in
`tmp/`, pass the absolute path, and end it with an unconditional
`RAISE EXCEPTION` so the transaction rolls back after executing every statement
against real data.

**The `CONCURRENTLY` guard greps the whole file, including comments.** The word
in a comment refuses a file that must stay transactional, and the suggested
`--no-transaction` fix is actively dangerous there. Reword the comment; reach for
`--no-transaction` only when a real `CONCURRENTLY` statement is present and every
statement is independently re-runnable.

## Before relocating anything under db/

Check the path depth. Most of the tooling resolves the repo root as
`path.join(__dirname, '..', '..')` and then filters its scan directories through
`fs.existsSync`. Moved to a DIFFERENT depth without fixing that constant, the
scan set silently becomes empty and the script reports zero findings and exits 0
— a green over nothing, which is the failure mode most of that tooling exists to
prevent.

The 2026-08-06 split was safe precisely because `db/gates`, `db/tools` and
`db/archive` sit at the same depth as `db/adhoc`, so every one of those constants
still resolves. A future `db/gates/rename/` subdirectory would not be.
