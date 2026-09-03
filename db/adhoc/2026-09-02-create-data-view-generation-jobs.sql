-- STATUS: APPLIED 2026-09-03 against league_production
--
-- The generation-job table for agentic data view generation.
--
-- This file is the ONE home for the design rationale; the module and the spec
-- point here rather than restating it.
--
-- WHY A DURABLE TABLE AND NOT THE EXISTING ADMISSION GATE. That gate holds its
-- counters at module scope, so an API restart drops every waiter; its cap is
-- sized for Postgres concurrency rather than for generation; it is timed for
-- seconds where generation runs minutes; and its abort reaches a queued waiter
-- only. A generation job must survive a restart and stay collectable after the
-- client disconnects, so it needs a row.
--
-- WHY generation_id AND NOT user_id. Generation requires authentication at
-- launch and anonymous access is the eventual goal, so nothing structural keys
-- on the user. The opaque id is what lets a client reconnect and collect a
-- result it did not wait for, and it is the whole of what anonymous delivery
-- needs later. user_id is attribution and may be NULL.
--
-- THIS ROW IS ALSO THE AUDIT AND TRAJECTORY RECORD. Instruction, outcome,
-- branch, tool-call count, token spend and duration are each a property of
-- exactly one job and share this primary key, so a second table would be a 1:1
-- join carrying no fact this one cannot hold.

CREATE TABLE public.data_view_generation_jobs (
  generation_id uuid DEFAULT gen_random_uuid() NOT NULL,

  principal_key text NOT NULL,
  user_id bigint,

  instruction text NOT NULL,
  -- The edit case: the current table_state goes in, a complete one comes back.
  input_table_state jsonb,

  status character varying(20) DEFAULT 'queued'::character varying NOT NULL,

  thread_id text,

  queued_at timestamp with time zone DEFAULT now() NOT NULL,
  dispatched_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,

  -- The wall-clock bound. It cannot be the socket: a disconnect must not cancel
  -- a job the client can still collect by generation_id, so "the client went
  -- away" and "the run should stop" are different events and this is the second
  -- one. Defaulted on the SERVER clock because it is swept against the server
  -- clock -- an API host computing it locally makes the bound drift with host
  -- skew.
  deadline_at timestamp with time zone DEFAULT now() + interval '15 minutes' NOT NULL,

  -- The emitted envelope: expressible / explanation / inexpressible_reason,
  -- plus table_state, or sql_text and column_annotations.
  result jsonb,

  error_code character varying(50),
  error_message text,

  -- Which capability answered. Named generation_branch rather than branch,
  -- which reads as a git branch in a repository.
  generation_branch character varying(20),
  tool_call_count integer,
  total_tokens integer,
  duration_milliseconds integer,

  -- No created_at/updated_at: the four lifecycle timestamps already say when
  -- this row was made and when it last moved, and this schema has no generic
  -- update_updated_at_column() -- every table using that idiom carries its own
  -- trigger function.

  CONSTRAINT data_view_generation_jobs_pkey PRIMARY KEY (generation_id),

  -- Only the statuses code actually writes. 'refused' is deliberately absent:
  -- a refusal is a COMPLETED job carrying generation_branch = 'refusal', since
  -- filing it as its own terminal state folds a legitimate agent answer in with
  -- the provider being unreachable and makes both metrics meaningless.
  -- 'cancelled' is absent because no cancel path exists; adding a value here
  -- when one does is a one-line change.
  CONSTRAINT data_view_generation_jobs_status_check CHECK (
    (status)::text = ANY ((ARRAY[
      'queued'::character varying,
      'dispatched'::character varying,
      'running'::character varying,
      'completed'::character varying,
      'failed'::character varying,
      'expired'::character varying
    ])::text[])
  ),
  CONSTRAINT data_view_generation_jobs_generation_branch_check CHECK (
    generation_branch IS NULL OR (generation_branch)::text = ANY ((ARRAY[
      'registry'::character varying,
      'query'::character varying,
      'refusal'::character varying
    ])::text[])
  ),
  CONSTRAINT data_view_generation_jobs_tool_call_count_check CHECK (
    tool_call_count IS NULL OR tool_call_count >= 0
  ),
  CONSTRAINT data_view_generation_jobs_total_tokens_check CHECK (
    total_tokens IS NULL OR total_tokens >= 0
  )
);

COMMENT ON TABLE public.data_view_generation_jobs IS
  'Agentic data view generation jobs: queue, delivery record, and audit trajectory. Keyed on an opaque generation_id so a result outlives the connection that asked for it.';

COMMENT ON COLUMN public.data_view_generation_jobs.principal_key IS
  'Rate-limit and token-budget principal: user_id when authenticated, CF-Connecting-IP otherwise.';

-- The claim predicate: oldest queued first.
CREATE INDEX idx_data_view_generation_jobs_queued
  ON public.data_view_generation_jobs (queued_at)
  WHERE (status)::text = 'queued'::text;

-- The depth count and the deadline sweep both read the live set. Partial, so it
-- stays small however many terminal rows accumulate -- and they do accumulate,
-- because this table is also the audit record and is never swept.
CREATE INDEX idx_data_view_generation_jobs_live
  ON public.data_view_generation_jobs (deadline_at)
  WHERE (status)::text = ANY (ARRAY['queued'::text, 'dispatched'::text, 'running'::text]);

-- NO INDEX ON principal_key. An earlier draft carried one "for the limiter",
-- and no limiter exists. Measured at 200k rows it was 11 MB against 16 kB for
-- each partial index above, it doubled insert time, and it never served a
-- query -- while every status transition kept re-inserting into it. Add it with
-- the limiter that needs it, not before.
