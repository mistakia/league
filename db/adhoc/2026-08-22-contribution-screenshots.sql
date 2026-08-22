-- STATUS: APPLIED 2026-08-22 against league_production
--
-- The screenshot attached to a contribution submission, stored as bytes.
--
-- WHY POSTGRES AND NOT THE FILESYSTEM. Triage runs on base-storage and reaches
-- league through the SSH tunnel to Postgres and through nothing else. It has no
-- filesystem path to the league host, so a screenshot written to league's disk
-- is unreadable by the one process that exists to look at it. The database is
-- not the convenient channel here, it is the only channel.
--
-- WHY A SEPARATE TABLE RATHER THAN A COLUMN ON contribution_submissions. The
-- submission row is read by the poller's drain query and by the status page's
-- per-author list, neither of which wants the image. A bytea column on that
-- table would be TOASTed out of line anyway, but it would still widen every
-- `select *` on the hot path and every row the triage tunnel pulls across.
-- Keeping the bytes behind their own primary key means the image is fetched
-- exactly when something intends to look at it.
--
-- The PRIMARY KEY is submission_id, so a submission carries at most one
-- screenshot. That matches the dialog, which captures once per opening rather
-- than accumulating attachments, and it makes the purge path a keyed delete
-- rather than a scan.
--
-- contribution_submissions.screenshot_reference already existed and was never
-- written. It becomes the POINTER: non-null means a row is here. It is not a
-- filesystem path and never was one -- the purge routine's original fs.unlink
-- branch was written against a storage design that was never built, and is
-- replaced in the same change that creates this table.
--
-- byte_size is stored rather than derived because the triage list wants to show
-- and sort by attachment size without reading the bytes, which is the entire
-- reason the bytes are in a separate table. The CHECK keeps it honest against
-- octet_length so the denormalized copy cannot drift from what is stored.
--
-- The 1 MB ceiling sits above the client's own 600000-byte budget
-- (app/core/contribution-screenshot.js) with headroom, and far below anything
-- that would make this table a write-amplification problem. As with
-- captured_context, the client is the untrusted party: an attacker posts
-- whatever they like to /api/contributions, so the ceiling is enforced here as
-- well as at the route.
--
-- Additive and reversible: DROP TABLE IF EXISTS public.contribution_screenshots;

CREATE TABLE IF NOT EXISTS public.contribution_screenshots (
    submission_id uuid NOT NULL,
    image_bytes bytea NOT NULL,
    content_type character varying(40) DEFAULT 'image/jpeg'::character varying NOT NULL,
    byte_size integer NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contribution_screenshots_pkey PRIMARY KEY (submission_id),
    CONSTRAINT contribution_screenshots_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.contribution_submissions(submission_id) ON DELETE CASCADE,
    CONSTRAINT contribution_screenshots_content_type_check
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT contribution_screenshots_byte_size_check
        CHECK (byte_size > 0 AND byte_size <= 1048576),
    CONSTRAINT contribution_screenshots_byte_size_matches_check
        CHECK (byte_size = octet_length(image_bytes))
);
