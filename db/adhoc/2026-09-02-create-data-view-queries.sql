-- The persistence half of a query-backed data view: a saved view REFERENCES a
-- statement rather than embedding one.
--
-- STATUS: APPLIED 2026-09-02 against league_production
--
-- WHY A SEPARATE TABLE AND NOT A COLUMN ON table_state. SQL is a PRODUCTION
-- mechanism; table_state is a pure DISPLAY contract the client renders without
-- knowing SQL exists. A view definition already has five representations --
-- the validator, this json column, local history, and the share-link URL
-- parsed on both sides -- and the two URL parsers are key-driven, so any field
-- added to table_state that they do not carry degrades a shared view silently.
-- One scalar query_id crosses all five; an embedded statement crosses none of
-- them.
--
-- NO OWNER COLUMN, DELIBERATELY. Generation requires authentication at launch
-- with anonymous access the eventual goal, and the rule that makes opening up a
-- deletion rather than a re-keying is that nothing STRUCTURAL keys on user_id.
-- Ownership lives on user_data_views, whose user_id is already nullable. The
-- consequence is that an unreferenced row has nothing to attribute it to, which
-- is why the sweep ships with the table rather than after it.
--
-- ONE STEP AFTER THIS FILE, IN THE SAME COMMIT. Run `yarn export:schema`, and
-- add `data_view_queries` to EXCLUDED_RELATIONS in
-- db/tools/generate-reader-role-grants.mjs with the reason "every other user's
-- saved SQL statement". That generator grants every relation it is not told to
-- exclude, so this table becomes readable by the sandbox role -- the very role
-- the statements were written against -- the moment it enters the schema dump.
-- The exclusion cannot be added earlier: the tool refuses an exclusion naming a
-- relation the schema does not have.

CREATE TABLE public.data_view_queries (
    query_id character varying(36) NOT NULL,
    sql_text text NOT NULL,
    -- Per-projected-alias, and ONLY the non-derivable fields: column_title,
    -- header_label, fixed, size, and data_type in the one case where the pg
    -- type resolver cannot bucket an OID. column_id, projection order and
    -- data_type are read off the pg field descriptors, so a declared type that
    -- the resolver could have supplied is a contract violation rather than a
    -- hint -- it re-opens the entire class of failure where a declared type
    -- disagrees with the column's real one.
    column_annotations json NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT data_view_queries_pkey PRIMARY KEY (query_id)
);

CREATE INDEX idx_data_view_queries_created_at
  ON public.data_view_queries (created_at DESC);

-- Nullable, and no foreign key. The sweep collects unreferenced queries, so the
-- reference has to be droppable from this side without the sweep having to
-- reason about a constraint; and a view whose query row was collected must read
-- as a named error at render rather than as a failed DELETE at collection time.
ALTER TABLE public.user_data_views
  ADD COLUMN query_id character varying(36);

CREATE INDEX idx_user_data_views_query_id
  ON public.user_data_views (query_id)
  WHERE query_id IS NOT NULL;
