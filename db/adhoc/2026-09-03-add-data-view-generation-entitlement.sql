-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Per-user entitlement for agentic data view generation.
--
-- ON THE NAME. The task plan specified `data_view_generation_enabled`, and the
-- schema conformance ratchet rejects it: a boolean must carry `is_`/`has_` as a
-- prefix or an infix. The `_is_` infix is the form that keeps this column
-- sorting beside data_view_export_max_rows in the same per-user capability
-- family, which is the whole reason that column is the precedent here.
--
-- WHY A COLUMN RATHER THAN A CONFIG LIST. users.data_view_export_max_rows is
-- the precedent, in this same data-view family: a per-user capability on the
-- row, set by an adhoc and read at admission. A list in config-production.json
-- would need a DEPLOY to add one person; this is one UPDATE, with no deploy and
-- no restart.
--
--   UPDATE users SET data_view_generation_is_enabled = true WHERE id = ...;
--
-- DEFAULT false, AND THAT IS THE POINT. Until this column exists the only
-- admission check is "signed in", so a frontend deploy would open generation to
-- every account on the platform at a concurrency of one -- a cost surface and a
-- queue every user shares. The window between the deploy and the first UPDATE
-- is exactly the state the gate is being added to prevent, so the gate has to
-- be closed the moment it exists rather than opened and then narrowed.
--
-- NOT NULL, unlike data_view_export_max_rows, which reads NULL as "no ceiling".
-- There is no third state here: an account either may generate or may not, and
-- a nullable boolean would put the answer for a row nobody has touched in the
-- hands of whatever the reading code does with undefined.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS data_view_generation_is_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.data_view_generation_is_enabled IS
  'Whether this account may run agentic data view generation. Closed by default; opened one account at a time with an UPDATE, never a deploy.';
