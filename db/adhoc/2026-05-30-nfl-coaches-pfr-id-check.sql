-- Enforce the PFR coach-id basename contract documented at
-- user:guideline/nfl/league/nfl-database-analysis.md ## Coaching Attribution.
--
-- The samhoppen yearly_coaching_history.csv occasionally ships path-prefixed
-- ids (e.g. `/executives/BeliBi0` for head coaches who also held GM roles).
-- scripts/import-nfl-coaches.mjs strips the prefix at ingest; this CHECK
-- defends the invariant at the DB boundary so a future importer regression
-- cannot silently land a malformed id.
--
-- Shape: starts with a letter, ends with a digit, body is letters/digits
-- with an apostrophe permitted (e.g. O'LeGe0 for George O'Leary -- PFR
-- itself uses an apostrophe in that basename). No slashes, no whitespace,
-- no other punctuation. Verified against all 471 rows on 2026-05-30.

ALTER TABLE nfl_coaches
  ADD CONSTRAINT nfl_coaches_pfr_coach_id_basename
  CHECK (pfr_coach_id ~ '^[A-Za-z][A-Za-z0-9'']*[0-9]$');
