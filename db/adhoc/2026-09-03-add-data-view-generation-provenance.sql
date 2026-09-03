-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Provenance for agentic data view generation, in two halves.
--
-- ON THE JOB ROW: which inference provider served the run. The job table is
-- already the audit record (see its own DDL, 2026-09-02), and it carried the
-- trajectory -- tool calls, tokens, duration -- but not what produced them. A
-- cost figure with no provider beside it cannot be compared across a model
-- change, which is the comparison the whole benchmark exists to make. League
-- reads it off base's thread record, not from the agent: the container does not
-- know which provider the gateway routed it to.
--
-- ON THE SAVED VIEW: whether a view was built by the agent, and by what.
-- Deliberately mirroring the existing llm_tags_generated_at vocabulary rather
-- than introducing a parallel generation_ one, so a reader of this table finds
-- one naming convention for "an LLM did this" rather than two.
--
-- WHY NOT A BOOLEAN. `llm_generated_at` answers "was it generated" and "when"
-- with one column, and the when is what makes an old generated view legible
-- after the generator has changed underneath it.
--
-- Both are NULLABLE with no default and no backfill. Every existing view was
-- built by a human by construction -- the agent has never had a delivery path
-- until now -- so NULL is the true value for all of them, and a default would
-- assert something about rows nobody generated.

ALTER TABLE data_view_generation_jobs
  ADD COLUMN IF NOT EXISTS inference_provider character varying(100);

COMMENT ON COLUMN data_view_generation_jobs.inference_provider IS
  'Which inference provider served the agent, read off the base thread record rather than self-reported by the container.';

ALTER TABLE user_data_views
  ADD COLUMN IF NOT EXISTS llm_generated_at timestamp with time zone;

ALTER TABLE user_data_views
  ADD COLUMN IF NOT EXISTS llm_inference_provider character varying(100);

COMMENT ON COLUMN user_data_views.llm_generated_at IS
  'When an agent generated this view. NULL means a human built it; the whole table was NULL at the time this column was added.';

COMMENT ON COLUMN user_data_views.llm_inference_provider IS
  'The inference provider behind llm_generated_at, copied from the generation job rather than asserted by the client.';
