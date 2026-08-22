-- STATUS: PENDING
--
-- Contribution pipeline: the submission of record and its audit trail.
--
-- Four tables behind the report surface on xo.football. The submission row is
-- the system of record and stays in league Postgres, so the surface survives a
-- base outage and a submitter's status read is a local query rather than a
-- round trip across the SSH tunnel. Base holds identifiers only -- never the
-- title, the body, or any captured context.
--
-- submitter_user_id is bigint REFERENCES public.users(id), NOT users.uid. The
-- planning document named users.uid; that column does not exist. The users
-- primary key is the bigint id (constraint "idx_25127_PRIMARY"), and the three
-- existing foreign keys into users -- external_league_connections.created_by,
-- external_league_import_jobs.initiated_by, invite_codes.created_by -- all
-- reference public.users(id). An integer column would also silently narrow a
-- bigint key.
--
-- The column is NULLABLE by design and that is the whole admission model: a
-- logged-out visitor on /data-views or /plays sees the most breakage and must
-- be able to report it. What authentication buys is not admission but autonomy.
-- submission_trust_tier is resolved at insert and is a DATA value read by the
-- poller, not a code branch, so the operator can demote an authenticated
-- submitter who floods the queue and promote a known anonymous reporter without
-- a deploy. ON DELETE SET NULL rather than CASCADE: a submission outlives the
-- account that filed it, and deleting a user must not silently erase the audit
-- trail of work already shipped from their report.
--
-- captured_context carries a check constraint rather than trusting the client
-- to respect its own byte budget. The client allowlists and truncates, but the
-- client is the untrusted party here -- an attacker posts whatever they like to
-- /api/contributions, and a JSONB column with no ceiling is an unbounded write
-- amplified by TOAST. 256 KB is well above a legitimate allowlisted snapshot
-- and far below a useful denial-of-service.
--
-- claim_token_hash is the anonymous submitter's only route back to their own
-- report, stored as a sha256 hex digest and never in the clear. A token that
-- leaks from this table would expose another submitter's body and captured
-- context, which is precisely the personally-identifying surface the purge path
-- exists to bound.
--
-- purged_at is what makes deletion observable. A purge redacts the body, the
-- captured context and the screenshot reference while preserving the event
-- trail, so without a timestamp a purged row and a row that never carried
-- content are indistinguishable.
--
-- Additive and reversible: DROP TABLE IF EXISTS public.contribution_answers,
-- public.contribution_questions, public.contribution_events,
-- public.contribution_submissions CASCADE;

BEGIN;

CREATE TABLE IF NOT EXISTS public.contribution_submissions (
    submission_id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitter_user_id bigint,
    submission_kind character varying(20) NOT NULL,
    submission_trust_tier character varying(20) DEFAULT 'untrusted'::character varying NOT NULL,
    submission_title character varying(200) NOT NULL,
    submission_body text NOT NULL,
    captured_context jsonb,
    screenshot_reference text,
    claim_token_hash character varying(64),
    submission_status character varying(30) DEFAULT 'received'::character varying NOT NULL,
    autonomy_class character varying(20),
    base_task_uri text,
    pull_request_number integer,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purged_at timestamp with time zone,
    CONSTRAINT contribution_submissions_pkey PRIMARY KEY (submission_id),
    CONSTRAINT contribution_submissions_submitter_user_id_fkey
        FOREIGN KEY (submitter_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT contribution_submissions_submission_kind_check
        CHECK (submission_kind IN ('bug_report', 'feature_idea')),
    CONSTRAINT contribution_submissions_submission_trust_tier_check
        CHECK (submission_trust_tier IN ('untrusted', 'standard', 'trusted')),
    CONSTRAINT contribution_submissions_submission_status_check
        CHECK (submission_status IN ('received', 'awaiting_information', 'accepted',
                                     'rejected', 'duplicate', 'in_progress', 'shipped', 'expired')),
    CONSTRAINT contribution_submissions_autonomy_class_check
        CHECK (autonomy_class IS NULL OR autonomy_class IN ('auto_ship', 'agent_implement',
                                                            'plan_only', 'product_decision')),
    CONSTRAINT contribution_submissions_captured_context_size_check
        CHECK (captured_context IS NULL OR octet_length(captured_context::text) <= 262144)
);

-- The poller's drain query is (submission_status, submission_trust_tier): it
-- reads open rows and splits them by lane. A composite serves that scan; the
-- separate trust-tier index serves the operator's "show me everything
-- untrusted" review, which is not status-scoped.
CREATE INDEX IF NOT EXISTS idx_contribution_submissions_status_trust_tier
    ON public.contribution_submissions (submission_status, submission_trust_tier);

CREATE INDEX IF NOT EXISTS idx_contribution_submissions_submission_trust_tier
    ON public.contribution_submissions (submission_trust_tier);

-- Partial: the status page lists one author's submissions, and the anonymous
-- rows that dominate the table by construction have no author to list under.
CREATE INDEX IF NOT EXISTS idx_contribution_submissions_submitter_user_id
    ON public.contribution_submissions (submitter_user_id, submitted_at DESC)
    WHERE submitter_user_id IS NOT NULL;

-- Follow-up questions are drawn from a fixed template set, never generated, and
-- capped at three per submission. question_template_key records which template
-- was used so the cap and the "no fourth question" rule are enforceable against
-- the table rather than only in the code that writes it.
CREATE TABLE IF NOT EXISTS public.contribution_questions (
    question_id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    question_template_key character varying(50) NOT NULL,
    question_text text NOT NULL,
    asked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT contribution_questions_pkey PRIMARY KEY (question_id),
    CONSTRAINT contribution_questions_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.contribution_submissions(submission_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contribution_questions_submission_id
    ON public.contribution_questions (submission_id);

-- One answer per question. The unique constraint is the enforcement, not a
-- convention: the detail route accepts an answer from anyone holding the claim
-- token, and a repeat POST must not silently append a second body.
CREATE TABLE IF NOT EXISTS public.contribution_answers (
    answer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    answer_body text NOT NULL,
    answered_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contribution_answers_pkey PRIMARY KEY (answer_id),
    CONSTRAINT contribution_answers_question_id_key UNIQUE (question_id),
    CONSTRAINT contribution_answers_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES public.contribution_questions(question_id) ON DELETE CASCADE
);

-- The audit trail the purge routine preserves. Nothing may mutate a submission
-- without recording an event here, which is what lets a purged row still prove
-- what happened to it after its body is gone.
--
-- No ON DELETE CASCADE from submissions is wanted in spirit -- the trail should
-- outlive the row -- but a hard delete of a submission is not a supported
-- operation (purge is), so CASCADE is correct for the one case that remains:
-- dropping test data.
CREATE TABLE IF NOT EXISTS public.contribution_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    contribution_event_type character varying(50) NOT NULL,
    previous_submission_status character varying(30),
    new_submission_status character varying(30),
    event_context jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contribution_events_pkey PRIMARY KEY (event_id),
    CONSTRAINT contribution_events_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.contribution_submissions(submission_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contribution_events_submission_id
    ON public.contribution_events (submission_id, occurred_at);

COMMIT;
