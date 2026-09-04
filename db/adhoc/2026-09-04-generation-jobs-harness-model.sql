-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Let a generation job name the harness and model it runs on.
--
-- Both NULL in production, which means "the identity's own default" -- base
-- resolves that, and league deliberately does not restate what the default is.
-- The columns exist so the benchmark can sweep one axis at a time against the
-- real dispatch path: the drainer runs inside the league API on the league host,
-- so a sweep on another machine has no env it could pass these through, and
-- dispatching around the drainer would measure a path production does not use.
--
-- Not constrained to an enum here. The permitted values are the identity's
-- session_options allowlists on the base side, which is where they are already
-- validated on every create-session; a CHECK here would be a second copy of that
-- vocabulary with no way to stay in step with it.

ALTER TABLE data_view_generation_jobs
  ADD COLUMN harness character varying(50),
  ADD COLUMN model character varying(100);

COMMENT ON COLUMN data_view_generation_jobs.harness IS
  'Harness to dispatch this job on; NULL means the dispatching identity''s default. Set by the benchmark sweep, never by production callers.';

COMMENT ON COLUMN data_view_generation_jobs.model IS
  'Model to dispatch this job on; NULL means the dispatching identity''s default. Set by the benchmark sweep, never by production callers.';
