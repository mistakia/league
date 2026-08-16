-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Removes the test data left by the 2026-08-15/16 end-to-end exercise of the
-- waitlist form and the Admission Vote: two submissions named
-- "ZZ TEST CANDIDATE ..." and the one vote held over them, with its candidates,
-- sponsors, eligibility snapshot, ballots and preferences.
--
-- WHY THIS IS NOT 2026-08-15-purge-manager-waitlist-submissions.sql. That file
-- is the RETENTION step, prepared unapplied so that closing a real recruiting
-- round is an execution rather than a decision, and its header says to run it
-- when the round closes. Running it to sweep test rows would mark it APPLIED
-- and leave the real round with no pending step -- the prepared artifact spent
-- on a rehearsal. It stays PENDING; this file is the rehearsal's own cleanup.
--
-- ORDER IS LOAD-BEARING. Everything under admission_votes cascades
-- (confdeltype 'c'), so deleting the vote takes its five child tables with it.
-- admission_vote_candidates.submission_id is RESTRICT ('r'), so the submissions
-- cannot go first: while a candidate still cites one, the delete raises.
--
-- SCOPED, NOT UNCONDITIONAL. The sibling retention file is deliberately
-- unconditional because after a real round there is nothing to keep; this one
-- runs while the table may hold live applications, so it names the test rows.
-- A vote qualifies only when EVERY one of its candidates is test data, so a
-- real vote that happened to include a test candidate would be left alone.

DELETE FROM public.admission_votes
WHERE admission_vote_id IN (
  SELECT admission_vote_id
  FROM public.admission_vote_candidates
  GROUP BY admission_vote_id
  HAVING bool_and(candidate_name LIKE 'ZZ TEST CANDIDATE %')
);

DELETE FROM public.manager_waitlist_submissions
WHERE candidate_name LIKE 'ZZ TEST CANDIDATE %';
