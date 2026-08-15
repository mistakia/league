-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Moves the vetting questionnaire's answers out of one-typed-column-per-question
-- and into a jsonb column keyed by question id.
--
-- WHY, a few hours after the table was created: the original shape made
-- rewording a question free and made adding, removing or reordering one a
-- production migration plus a schema export plus a fixture change. That was the
-- wrong trade for a questionnaire, and it was wrong immediately rather than
-- eventually -- two questions were cut and one rewritten before the form had
-- taken a single response. A question set is content, so it now lives in
-- libs-shared/manager-waitlist-questions.mjs and nowhere else.
--
-- DROP AND RECREATE rather than nine ALTERs. The table holds ZERO rows
-- (verified immediately before this ran), it is committed but not deployed, and
-- nothing outside this cluster references it -- so there is no data to preserve
-- and no reason to leave the column-per-question history in the table's
-- definition. Rebuilding is the clean end state; a pile of DROP COLUMNs would
-- reach the same place while making the schema read like an apology.
--
-- WHAT STAYS A COLUMN. Contact details, timezone and the commitment
-- affirmation are not questionnaire content -- they are how the Commissioner
-- reaches someone and what the league needs on record -- so they stay typed and
-- queryable. `requested_seat` stays for the same reason: it is the one answer
-- that gets matched against a team sheet rather than read as prose.
--
-- RETENTION and the pg_read_all_data caveat are unchanged; see
-- 2026-08-15-add-manager-waitlist-submissions.sql and its correction.

DROP TABLE public.manager_waitlist_submissions;

CREATE TABLE public.manager_waitlist_submissions (
  submission_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Which question set produced these answers. Bumped in
  -- libs-shared/manager-waitlist-questions.mjs when two rounds' answers stop
  -- being comparable, which is what makes a mixed table readable.
  questionnaire_version smallint NOT NULL DEFAULT 2,
  submitted_at timestamptz NOT NULL DEFAULT now(),

  candidate_name text NOT NULL,
  contact_email text NOT NULL,
  contact_handle text,
  timezone_name text NOT NULL,

  -- The commitment is stated on the form and affirmed with a checkbox rather
  -- than asked as a question, so what is worth recording is the affirmation.
  -- NOT NULL with no default: a row that cannot say whether the person agreed
  -- is worse than a refused write.
  has_affirmed_commitment boolean NOT NULL,

  -- Free text matched against the published team sheets rather than read as
  -- prose, which is why it is a column and not a questionnaire answer.
  requested_seat text,

  -- One key per question id. jsonb rather than json so a key lookup is indexable
  -- and so duplicate keys cannot survive a write.
  responses jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.manager_waitlist_submissions IS
  'Prospective manager questionnaire responses feeding the Article IV waiting-list ranking vote. Answers are keyed by question id from libs-shared/manager-waitlist-questions.mjs. Candidate PII: the API exposes it only to the league''s sitting managers, but league_reader can read it directly via pg_read_all_data. Deleted when the recruiting round closes.';

COMMENT ON COLUMN public.manager_waitlist_submissions.responses IS
  'Question id -> answer text. The id set is defined in libs-shared/manager-waitlist-questions.mjs; an id is a stored key and must not be reused for a different question.';

-- The reading surface orders newest first and nothing else queries this table.
CREATE INDEX manager_waitlist_submissions_submitted_at_index
  ON public.manager_waitlist_submissions (submitted_at DESC);

-- Inert while league_reader holds pg_read_all_data, and kept for the same
-- reason as before: it is the access this table should have if that membership
-- is ever narrowed. See 2026-08-15-correct-manager-waitlist-submissions-comment.sql
REVOKE SELECT ON TABLE public.manager_waitlist_submissions FROM league_reader;
