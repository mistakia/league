-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Give the schema the stadium entity it already identifies, conform the two
-- nfl_games venue identifiers to {system}_{entitytype}_id, and DROP
-- nfl_plays.sportradar_event_id outright. Clears 3 of the 8 external_id findings
-- on the repaired ruler (league cc50e2a49 / 60495ef2d): audit 24 -> 21.
--
-- WHAT THE TWO VENUE COLUMNS ACTUALLY IDENTIFY, established before naming them.
-- Both are stadium identifiers, and both importers write them in the same object
-- literal as stadium_name, which is the schema's own vocabulary for the entity:
--
--   scripts/import-nfl-games-nfl.mjs:74-75  stadium_name: item.venue.name,
--                                           stad_nfl_id:  item.venue.id
--   scripts/import-nfl-games-ngs.mjs:94-95   stadium_name: item.site.siteFullName,
--                                           ngs_site_id:   item.site.siteId
--
-- Measured against production 2026-08-08: stad_nfl_id is populated on 15,195 of
-- 15,622 games across 105 distinct values, ngs_site_id on 8,257 across 69.
--
-- WHY THIS NEEDS A TABLE AND NOT JUST A RENAME.
-- Renaming alone does NOT clear the findings, which was verified rather than
-- assumed: running the audit against a candidate schema carrying exactly
-- nfl_stadium_id and ngs_stadium_id still reports both. The entity-type
-- vocabulary is DERIVED from the schema's own table-name tokens (60495ef2d), and
-- this schema stored no stadium anywhere -- so the ruler was correctly refusing
-- to bless an identifier for an entity the schema does not state exists. The
-- column parser has surfaced a structural gap, which is the instrument working.
--
-- The alternative considered and REJECTED ON MEASUREMENT was widening the
-- derivation to read `*_name` columns, so that stadium_name would admit
-- `stadium`. Measured against this schema, that admits 17 novel tokens including
-- `column`, `table`, `first`, `last`, `display`, `full`, `short` and `event` --
-- which would let x_column_id and x_event_id conform and so reinstates exactly
-- the false-conformance class 60495ef2d was written to close. A vocabulary
-- widening is the one direction that can make this rule LOOSER, and it does not
-- earn that on a 17-token blast radius.
--
-- THE DIMENSION IS DELIBERATELY MINIMAL, and ngs_stadium_id deliberately stays
-- on nfl_games rather than moving onto it. nfl_games already carries six vendor
-- keys for the game side by side (esbid, gsis_game_id, espn_game_id,
-- ngs_game_id, pfr_game_id, sportradar_game_id); two vendor keys for the venue
-- sitting beside them is that same established pattern, not duplication. Moving
-- the NGS key onto the dimension would also lose it for the 425 games that carry
-- an NGS site id and no NFL venue id.
--
-- Three data tails were measured and none needs adjudicating, because the
-- dimension is keyed on the NFL venue id and a game without one simply keeps a
-- NULL, exactly as it does today:
--   - 29 of 105 venue ids appear under more than one stadium_name. These are
--     ordinary venue renamings over time. The dimension takes the most recently
--     observed name (SCD type 1); nfl_games.stadium_name is left in place and
--     remains the as-of-game name, which is a real distinction rather than
--     residue.
--   - 425 games carry ngs_site_id with no stad_nfl_id; they keep ngs_stadium_id
--     and take a NULL FK.
--   - 1 NGS site id spans 2 NFL venue ids, so no uniqueness is declared on
--     ngs_stadium_id.
-- Seed is 105 rows, every one named; max id length 36 and max name length 40,
-- so both column widths are inherited from nfl_games unchanged.
--
-- WHY sportradar_event_id IS DROPPED RATHER THAN RENAMED.
-- Sportradar calls a play an "event", so the conformed name would have been
-- sportradar_play_id -- and the name is irrelevant, because the column holds
-- nothing and nothing writes it. Measured 2026-08-08:
--
--   SELECT EXISTS (SELECT 1 FROM nfl_plays WHERE sportradar_event_id IS NOT NULL)
--     -> false, across all 27 year partitions
--
-- and a tree-wide grep of league plus private finds the name in exactly two
-- places, db/schema.postgres.sql and the conformance baseline. No writer, no
-- reader, no index, no view, no PL/pgSQL body. Third application of the
-- 2026-08-04 derivability test in its dead-column form, after
-- pff_team_gamelogs.wins/losses/ties and leagues.groupme_id/groupme_token.
-- The sibling sportradar_game_id on the same table IS populated (285 distinct
-- games in 2025) and is untouched.
--
-- SAFETY CHECKS RUN BEFORE AUTHORING, all clean:
--   - pg_proc: zero function bodies name any of the three columns.
--   - pg_views / matviews: zero view definitions name any of the three.
--   - Indexes: no index on nfl_games names either venue column; no index on
--     nfl_plays names sportradar_event_id.
--   - New-name collision: git grep of nfl_stadium_id and ngs_stadium_id against
--     HEAD returns zero, so neither rename activates a dormant diff-based write
--     the way espn_game_id/pfr_game_id would have (operation-log 009/010).
--
-- THE FK IS SAFE ONLY BECAUSE THE IMPORTER NOW SEEDS THE DIMENSION FIRST.
-- scripts/import-nfl-games-nfl.mjs upserts nfl_stadium from item.venue ahead of
-- its nfl_games upsert, in the same commit as this file. Without that, the first
-- game played at a new venue -- an international game or a new build, which the
-- NFL adds most seasons -- would fail the whole week's import on a constraint
-- violation.
--
-- DEPLOY WINDOW IS TIGHT AND MEASURED. import-nfl-games-ngs.mjs runs
-- `0 3 * 5-8 0` on digitalocean-0, so it fires Sunday 2026-08-09 03:00. Both
-- importers write through a diff-based upsert that drops unmatched keys
-- silently, so a stale deploy stops the venue write with no error. worker-1 must
-- be deployed before that fire.
--
-- nfl_plays is partitioned by season_year; DROP COLUMN on the parent cascades to
-- all 27 children as a catalog operation. nfl_games is not partitioned.
--
-- No BEGIN/COMMIT here -- db-exec.sh runs this under --single-transaction.

CREATE TABLE public.nfl_stadium (
    nfl_stadium_id character varying(36) NOT NULL,
    stadium_name character varying(45),
    CONSTRAINT nfl_stadium_pkey PRIMARY KEY (nfl_stadium_id)
);

INSERT INTO public.nfl_stadium (nfl_stadium_id, stadium_name)
SELECT stad_nfl_id, stadium_name
FROM (
    SELECT
        stad_nfl_id,
        stadium_name,
        row_number() OVER (
            PARTITION BY stad_nfl_id
            ORDER BY kickoff_at DESC NULLS LAST, season_year DESC
        ) AS name_rank
    FROM public.nfl_games
    WHERE stad_nfl_id IS NOT NULL
) ranked
WHERE name_rank = 1;

ALTER TABLE public.nfl_games RENAME COLUMN stad_nfl_id TO nfl_stadium_id;
ALTER TABLE public.nfl_games RENAME COLUMN ngs_site_id TO ngs_stadium_id;

ALTER TABLE public.nfl_games
    ADD CONSTRAINT nfl_games_nfl_stadium_id_fkey
    FOREIGN KEY (nfl_stadium_id) REFERENCES public.nfl_stadium (nfl_stadium_id);

ALTER TABLE public.nfl_plays DROP COLUMN sportradar_event_id;
