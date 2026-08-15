-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Corrects the table comment written minutes earlier by
-- db/adhoc/2026-08-15-add-manager-waitlist-submissions.sql, which claimed the
-- responses are "readable by league_writer only". They are not, and the
-- correction matters because the false claim is the kind someone relies on.
--
-- That file revoked SELECT from league_reader, and the revoke DID land -- the
-- table's ACL is `{league_writer=arwdDxt/league_writer}` with no league_reader
-- entry at all. league_reader can still read every row anyway, because it is a
-- member of `pg_read_all_data`, a built-in role that carries SELECT on every
-- table in every schema and is not defeated by any per-table REVOKE. So the
-- REVOKE is correct and inert: it is the right posture for the table and it
-- buys nothing while that membership stands.
--
-- The consequence to know: any `base db query league` session, and any other
-- consumer connecting as league_reader, can read candidate PII. Narrowing that
-- means removing `pg_read_all_data` from league_reader and granting per-table
-- SELECT instead, which changes what every read-only analysis session in the
-- fleet can see -- deliberately out of scope here, and the operator's call.
--
-- The REVOKE is left in place. It is not load-bearing today and it is what the
-- table's access should be if the membership is ever narrowed.

COMMENT ON TABLE public.manager_waitlist_submissions IS
  'Prospective manager questionnaire responses feeding the Article IV waiting-list ranking vote. Candidate PII: the API exposes it only to the league''s sitting managers, but league_reader can read it directly via pg_read_all_data. Deleted when the recruiting round closes.';
