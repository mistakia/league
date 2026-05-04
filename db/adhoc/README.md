# db/adhoc

Append-only audit log of one-shot SQL run against `league_production` via `yarn db:exec`.

## Conventions

- Filename: `YYYY-MM-DD-<slug>.sql` where the date is the run date.
- One file per logical change. If statements must succeed atomically, put them in one file -- `yarn db:exec` wraps each invocation in a single transaction.
- Files are committed and never edited after running. If a follow-up correction is needed, add a new file.
- After running ad-hoc DDL, run `yarn export:schema` to update `db/schema.postgres.sql`.

## Workflow

```bash
# 1. Author the SQL (e.g. db/adhoc/2026-05-04-rename-pp-columns.sql)
# 2. Review locally
# 3. Run against prod (wrapped in BEGIN/COMMIT, halts on first error)
yarn db:exec db/adhoc/2026-05-04-rename-pp-columns.sql

# 4. Refresh the schema dump
yarn export:schema

# 5. Commit both the adhoc file and the schema diff
git add db/adhoc/2026-05-04-rename-pp-columns.sql db/schema.postgres.sql
git commit -m "Rename pp/ppp/pp_pct/doi columns"
```
