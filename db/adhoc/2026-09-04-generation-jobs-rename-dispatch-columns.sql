-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Rename the two generation dispatch columns to say whose harness and model.
--
-- Added earlier today as bare `harness` and `model`, which the schema
-- conformance ratchet correctly flagged as shorthand: neither name says whose
-- harness or whose model, and `data_view_generation_jobs.model` could as
-- easily mean a projection model as an inference one. The ratchet caught this
-- on the committed sha and blocked every league push fleet-wide until it
-- cleared, which is the rule working rather than a false positive.
--
-- `requested_` is the honest prefix. The value is what the CALLER asked to
-- dispatch on, not what ended up serving the turns -- base resolves the
-- request against the identity's allowlists and may answer with its default,
-- so the request and the outcome are different facts and only the request
-- lives here. The benchmark row already spells the pair this way.

ALTER TABLE data_view_generation_jobs
  RENAME COLUMN harness TO requested_harness;

ALTER TABLE data_view_generation_jobs
  RENAME COLUMN model TO requested_model;

COMMENT ON COLUMN data_view_generation_jobs.requested_harness IS
  'Harness the caller asked to dispatch this job on; NULL means the dispatching identity''s default. Set by the benchmark sweep, never by production callers.';

COMMENT ON COLUMN data_view_generation_jobs.requested_model IS
  'Model the caller asked to dispatch this job on; NULL means the dispatching identity''s default. Set by the benchmark sweep, never by production callers.';
