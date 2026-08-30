-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Conform three column names on nfl_player_play_charting and drop a fourth.
--
-- The companion file that created this table went red on
-- check-schema-conformance-ratchet with eleven findings. That gate is a CI step
-- and a red master defers EVERY session's push to mistakia/league, so this is
-- not cosmetic. Nothing here had reached a consumer: the table is empty and the
-- importer is in the same unpushed change.
--
-- Two different rules were firing, and they want different remedies.
--
-- BARE SHORT NAME. `role` and `route` are five characters or fewer with no
-- underscore, which the audit flags unconditionally -- a bare noun on a wide
-- table says nothing about which of several senses it carries. Both are
-- qualified rather than abbreviated, so this is a rename and not a vocabulary
-- question:
--
--   role  -> snap_role   the player's job on the snap: COVERAGE, PASS RUSH,
--                        RUN BLOCK, PASS ROUTE
--   route -> route_run   the route itself: CROSS, GO, HITCH, DIG. Matches the
--                        house term, which nfl_matchup_stats already spells
--                        receiving_routes from the vendor's receivingRoutesRun
--
-- INTERIOR TOKEN NOT IN THE VOCABULARY. `vendor`, `technique`, `break`,
-- `responsibility`, `assignment` and `hitter` are ordinary English words the
-- committed dictionary happens not to carry. The vocabulary is a positive list
-- by design, and its own header states the trade: a genuinely new English word
-- costs one reviewed line. Five of them are added there rather than renamed
-- around, because renaming would make the column say something less true.
--
-- `vendor` is the exception and is renamed instead. `source_row_index` uses a
-- token the schema already ratifies and says the same thing in this repo's own
-- vocabulary, where `source` is what an incoming feed is called.
--
-- DROP is_shift. The vendor returns the `shift` key on every row and its value
-- was NULL on all 6,976 rows sampled across four team-games spanning two
-- seasons and both season types. A column NULL everywhere is the has_charting_data
-- shape this same task is dropping, and it is the isMotion ruling one grain
-- down. If the vendor ever populates it, adding the column back is one line --
-- cheaper than carrying it empty across the ~1.1M rows the backfill will write.
--
-- The table is empty, so every statement here is metadata-only.

SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.nfl_player_play_charting RENAME COLUMN role TO snap_role;
ALTER TABLE public.nfl_player_play_charting RENAME COLUMN route TO route_run;
ALTER TABLE public.nfl_player_play_charting
  RENAME COLUMN vendor_row_index TO source_row_index;

ALTER TABLE public.nfl_player_play_charting DROP COLUMN is_shift;

DO $$
DECLARE
  rows_present bigint;
BEGIN
  SELECT count(*) INTO rows_present FROM public.nfl_player_play_charting;
  IF rows_present <> 0 THEN
    RAISE EXCEPTION
      'table holds % row(s); this file assumed it was empty and the drop is not reversible',
      rows_present;
  END IF;
END $$;
