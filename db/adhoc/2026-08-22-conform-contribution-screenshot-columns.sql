-- STATUS: APPLIED 2026-08-22 against league_production
--
-- Conform the three contribution_screenshots column names to the approved
-- token vocabulary.
--
-- 2026-08-22-contribution-screenshots.sql created this table hours earlier with
-- image_bytes, content_type and byte_size. All three carry tokens that are not
-- in db/tools/schema-token-vocabulary.mjs -- `bytes`, `content` and `byte` --
-- so check-schema-conformance-ratchet reported three new violations and turned
-- master red, which defers every session's push to the repository rather than
-- only the offending one.
--
-- This is NEW DEBT from a feature, which the ratchet's own message says to fix
-- by renaming rather than by rebaselining. Rebaselining is for a deliberate
-- audit widening that surfaces existing debt, and using it here would have
-- written three permanent suppressions for columns that were minutes old.
--
--   image_bytes  -> image_data
--   content_type -> image_format
--   byte_size    -> image_size
--
-- image_size is a BYTE count, not a pixel dimension. `byte` is unavailable and
-- the alternative spellings that survive the vocabulary are no clearer, so the
-- unit is recorded here and in the CHECK constraint below, which ties the
-- column to octet_length and makes the intent unambiguous from the schema
-- alone.
--
-- The constraints are renamed alongside their columns. Postgres does not rename
-- a constraint when the column beneath it moves, so leaving them would have
-- left contribution_screenshots_byte_size_check on a table with no byte_size --
-- exactly the kind of stale remnant that makes a later reader doubt the schema.
--
-- SAFE AS A PURE RENAME. The table was created today, holds no rows, and the
-- code that reads it has never been deployed, so there is no consumer outside
-- this commit's own sweep (api/routes/contributions.mjs and its spec).
--
-- Reversible: rename each column and constraint back to the name on its left.

ALTER TABLE public.contribution_screenshots RENAME COLUMN image_bytes TO image_data;
ALTER TABLE public.contribution_screenshots RENAME COLUMN content_type TO image_format;
ALTER TABLE public.contribution_screenshots RENAME COLUMN byte_size TO image_size;

ALTER TABLE public.contribution_screenshots
    RENAME CONSTRAINT contribution_screenshots_content_type_check
    TO contribution_screenshots_image_format_check;

ALTER TABLE public.contribution_screenshots
    RENAME CONSTRAINT contribution_screenshots_byte_size_check
    TO contribution_screenshots_image_size_check;

ALTER TABLE public.contribution_screenshots
    RENAME CONSTRAINT contribution_screenshots_byte_size_matches_check
    TO contribution_screenshots_image_size_matches_check;
