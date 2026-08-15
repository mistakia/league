-- STATUS: APPLIED 2026-08-15 against league_production
--
-- The manager vetting questionnaire's responses table.
--
-- Feeds the Article IV waiting-list ranking vote: a prospective manager submits
-- once from the public form at /waitlist, and the league's existing managers
-- read the submissions to rank candidates. See
-- user:task/home-dynasty-league/league-operations/build-manager-vetting-questionnaire.md
--
-- ONE TYPED COLUMN PER QUESTION rather than a `responses` jsonb blob. The
-- question set is nine items and settled, so a blob would only relocate the
-- schema into application code and make the reading surface do key lookups
-- against names nothing validates. `questionnaire_version` is what makes a
-- later revision of the question set detectable in the rows themselves.
--
-- NO IP ADDRESS, HASHED OR OTHERWISE. Abuse control is rate limiting at the
-- route plus a honeypot, both of which live in the request path and store
-- nothing. An IP hash is still PII about a stranger and it would be the only
-- column here with no answer behind it.
--
-- RETENTION. These rows are candidate PII from people who are not league
-- members and may never become one, and unlike the gitignored-scratch plan this
-- replaced, `league_production` is backed up. The round's rows are deleted when
-- the round closes, by db/adhoc/2026-08-15-purge-manager-waitlist-submissions.sql
-- -- authored alongside this file so the deletion is a prepared step rather than
-- a promise in prose.

CREATE TABLE public.manager_waitlist_submissions (
  submission_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Bumped when the question set changes, so a mixed table stays readable.
  questionnaire_version smallint NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now(),

  -- Contact. `contact_handle` is whatever they prefer to be reached on
  -- (Discord, a phone, a forum name) and is optional; the email is not.
  candidate_name text NOT NULL,
  contact_email text NOT NULL,
  contact_handle text,

  -- Availability against the 11am-11pm EDT pick window.
  timezone_name text NOT NULL,

  -- The fit axes, in the order the form asks them.
  commitment_intent text NOT NULL,
  dynasty_experience text NOT NULL,
  salary_cap_experience text NOT NULL,
  contract_mechanics_comfort text NOT NULL,
  offseason_activity text NOT NULL,
  rules_tolerance text NOT NULL,
  commissioner_disagreement text NOT NULL,

  -- The strongest available signal on attrition risk.
  prior_league_history text NOT NULL,

  -- Which vacant seat they want, against the published team sheets. Optional:
  -- only one seat is confirmed vacant this round, so a candidate with no
  -- preference is a normal answer rather than an incomplete one.
  requested_seat text
);

COMMENT ON TABLE public.manager_waitlist_submissions IS
  'Prospective manager questionnaire responses feeding the Article IV waiting-list ranking vote. Candidate PII: readable by league_writer only, and deleted when the recruiting round closes.';

-- The reading surface orders newest first and nothing else queries this table.
CREATE INDEX manager_waitlist_submissions_submitted_at_index
  ON public.manager_waitlist_submissions (submitted_at DESC);

-- REVOKE, not an omitted GRANT. `ALTER DEFAULT PRIVILEGES FOR ROLE
-- league_writer IN SCHEMA public GRANT SELECT ON TABLES TO league_reader` is
-- standing, so every new table this role creates is readable by league_reader
-- on arrival -- which is the role every ad-hoc analysis session and every
-- `base db query league` connects as. Simply not writing a GRANT here would
-- leave candidate PII readable from any of them. The API's read route is the
-- only intended reader, and it connects as league_writer.
REVOKE SELECT ON TABLE public.manager_waitlist_submissions FROM league_reader;
