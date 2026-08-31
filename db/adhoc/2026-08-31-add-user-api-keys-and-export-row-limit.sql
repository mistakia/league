-- Per-user API keys for the data-view export endpoint, and the per-user row
-- ceiling that endpoint enforces.
--
-- STATUS: APPLIED 2026-08-31 against league_production
--
-- A key AUTHENTICATES its owner for the export route: the request runs as that
-- user, so viewer-scoped columns resolve exactly as they would for the same
-- person signed in through the browser. The key buys a higher row ceiling, not
-- a wider disclosure.
--
-- Only the SHA-256 of a key is stored. The plaintext is shown once, at
-- generation, and is unrecoverable afterwards -- a leaked database row cannot
-- be replayed as a credential.
--
-- users.data_view_export_max_rows is the ceiling, and NULL means NO CEILING.
-- It is deliberately not a "not set" state: the column default supplies the
-- ordinary ceiling at insert, so every row states its own policy and NULL is
-- reachable only by someone deciding it. The column is admin-owned -- nothing
-- in the settings API writes it, because a user who could raise their own
-- ceiling would make it decorative.

CREATE TABLE public.user_api_keys (
    api_key_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    -- Hex SHA-256 of the plaintext key. Unique, so authentication is one index
    -- lookup rather than a scan comparing every stored key.
    key_hash character(64) NOT NULL UNIQUE,
    -- The leading characters of the plaintext, shown in settings so a user can
    -- tell two keys apart without the platform holding either one.
    key_prefix character varying(12) NOT NULL,
    name character varying(60) NOT NULL DEFAULT '',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone
);

CREATE INDEX user_api_keys_user_id_idx ON public.user_api_keys (user_id);

-- league_reader only. league_writer owns the table and needs no grant, and the
-- sandboxed data-view role (league_data_view_reader) is deliberately NOT granted:
-- no data-view column reads credentials, and generated SQL must not be able to.
GRANT SELECT ON TABLE public.user_api_keys TO league_reader;

ALTER TABLE public.users
    ADD COLUMN data_view_export_max_rows integer DEFAULT 100000;

-- koalatystats runs bulk exports of whole result sets; NULL lifts the ceiling.
UPDATE public.users
   SET data_view_export_max_rows = NULL
 WHERE username = 'koalatystats';
