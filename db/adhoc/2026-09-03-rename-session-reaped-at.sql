-- STATUS: APPLIED 2026-09-03 against league_production
-- Rename session_reaped_at -> session_termination_requested_at.
--
-- Two reasons, and the second is why the rename is worth a second file rather
-- than an edit to the first (which is already stamped APPLIED, and rewriting it
-- would make the audit trail lie about what ran).
--
-- NAMING. "reaped" is base's jargon for tearing down a session and is not an
-- ordinary word in this schema's vocabulary; the schema-conformance ratchet
-- flagged both it and "session" as shorthand. "termination" and "requested" are
-- already vocabulary members, so the new name costs exactly one reviewed word
-- ("session") rather than two, and it does not import jargon from another
-- system into a column name a league reader has to interpret.
--
-- ACCURACY, which the rename gets for free. The column records that league ASKED
-- base to tear the session down -- it is stamped whether or not base obliged,
-- because a refusal retried every 5 seconds is the runaway the column exists to
-- prevent. "reaped" asserts an outcome the row cannot vouch for;
-- "termination_requested" says exactly what happened.
--
-- Safe as a bare rename: the column shipped minutes earlier in the same session
-- and nothing outside this change has ever read it.

ALTER TABLE public.data_view_generation_jobs
  RENAME COLUMN session_reaped_at TO session_termination_requested_at;

COMMENT ON COLUMN public.data_view_generation_jobs.session_termination_requested_at IS
  'When league last asked base to tear down this generation''s agent session. Set on the request, not on its success, so a refusal cannot loop.';
