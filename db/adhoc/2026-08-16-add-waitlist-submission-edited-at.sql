-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Records when a waitlist application was last rewritten by its candidate.
--
-- Until 2026-08-16 a submission was write-once, so the row's own submitted_at
-- was the whole story. The edit-link feature makes every answer rewritable up
-- until the candidate is named on an admission vote, which opens a window the
-- managers' page could not see: a manager reads an application, the candidate
-- rewrites it, and the card still shows the original date and looks untouched.
-- The 409 vote lock protects the BALLOT; this protects the pre-vote READING.
--
-- NULLABLE with no default, and that is the semantics rather than laziness: NULL
-- means "never edited", which is not the same as "edited at the moment it was
-- submitted". Backfilling it from submitted_at would make every untouched
-- application read as edited.
--
-- No backfill is needed -- the table holds zero rows.

ALTER TABLE manager_waitlist_submissions
  ADD COLUMN edited_at timestamptz;

COMMENT ON COLUMN manager_waitlist_submissions.edited_at IS
  'When the candidate last replaced his answers through his emailed edit link. NULL means the application has never been edited.';
