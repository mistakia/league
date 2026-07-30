-- Conform the two league_player period projection tables to season_year.
--
-- Repairs a RED master that I caused. db/adhoc/2026-07-30-league-player-period-projection-tables.sql
--   created these tables with a bare `year` column, reasoning that they should match
--   the per-week table they sit beside (league_player_projection_values.year).
--   That reasoning lost to an enforced gate: db/adhoc/check-schema-conformance-ratchet.mjs
--   fails on any non-baseline season_grain violation, and it reported exactly two --
--   league_player_season_projection_values.year and
--   league_player_rest_of_season_projection_values.year. Its guidance for new debt is
--   to fix the name rather than rebaseline, since --rebaseline is reserved for a
--   deliberate audit widening over pre-existing debt.
--
-- How it reached master ahead of this repair, since the sequence matters for anyone
--   reading the history: the additive DDL was applied to league_production at 05:45Z
--   and an unrelated session ran yarn export:schema about a minute later, which
--   dumped the whole live database and carried these two tables into its own commit
--   (c4dacc74f) before I had committed mine. That is the apply-to-commit-window
--   hazard the league CLAUDE.md documents. The window is the applying session's to
--   keep short, so this is my defect and not that session's.
--
-- Leaves league_player_projection_values.year alone. That column is pre-existing
--   baseline debt for the whole projection-points/values family and conforming it is
--   separate work with its own consumer sweep. Nothing joins the week table to either
--   period table on the year column -- get-players reads all three independently and
--   each data-view column resolves its own source -- so the two names coexisting
--   costs nothing at runtime. Conforming the new tables is forward progress; matching
--   them to the old name would have been new debt.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-07-30 against league_production

ALTER TABLE public.league_player_season_projection_values
    RENAME COLUMN year TO season_year;

ALTER TABLE public.league_player_rest_of_season_projection_values
    RENAME COLUMN year TO season_year;
