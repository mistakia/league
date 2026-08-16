-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Two repairs to the manager waitlist edit-link mechanism, both surfaced by
-- driving the feature end to end against a real mailbox on 2026-08-16.
--
-- 1. admission_vote_candidates.submission_id was ON DELETE RESTRICT.
--
--    The edit token carries no expiry by design -- api/routes/waitlist.mjs says
--    so, and the reasoning is sound: a link that dies while the round is open
--    strands the candidate it was sent to. What makes that safe is the stated
--    revocation, which is that the table is EMPTIED when the recruiting round
--    closes. Under RESTRICT that delete fails outright for exactly the rows you
--    most want to revoke -- the candidates who reached a ballot -- so the only
--    revocation the design has could not be performed.
--
--    SET NULL rather than CASCADE: the vote is a record of what the managers
--    did and must survive the application being purged. admission_vote_candidates
--    already stores candidate_name NOT NULL and already declares submission_id
--    NULLABLE, so the vote row stays readable with the link to the purged
--    application severed, which is the intended end state.
--
-- 2. contact_email had no index at all, so POST /waitlist/edit-link was a
--    sequential scan. The route now normalises every address to lowercase on
--    write and on lookup (a candidate who applied as `Kia@Example.com` and asked
--    for his link as `kia@example.com` was told it was on its way and got
--    nothing), which makes the column directly indexable -- a lower() predicate
--    would not have used a plain index.
--
--    Not UNIQUE: nothing stops a candidate applying twice, and the route
--    deliberately reads the newest row for an address.
--
-- No backfill is needed for either. manager_waitlist_submissions held ZERO rows
-- when this was written, which is also why the lowercase normalisation could be
-- introduced without rewriting stored addresses.

ALTER TABLE admission_vote_candidates
  DROP CONSTRAINT admission_vote_candidates_submission_id_fkey;

ALTER TABLE admission_vote_candidates
  ADD CONSTRAINT admission_vote_candidates_submission_id_fkey
  FOREIGN KEY (submission_id)
  REFERENCES manager_waitlist_submissions (submission_id)
  ON DELETE SET NULL;

CREATE INDEX manager_waitlist_submissions_contact_email_index
  ON manager_waitlist_submissions (contact_email);
