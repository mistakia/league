-- Drop the 35 dead per-stat contribution columns from
-- scoring_format_player_projection_points.
--
-- What these columns actually are: NOT raw projected stats, despite the names.
--   scripts/process-projections-for-scoring-format.mjs spreads
--   ...calculatePoints({ stats, position, league, use_projected_stats: true })
--   straight into the insert, and libs-shared/calculate-points.mjs:60-95 assigns
--   result[stat] = factor * statValue -- i.e. each column holds the FANTASY POINT
--   CONTRIBUTION of that stat category, and the 35 of them sum to `total`.
--   Confirmed against data: a row with 3,408 raw passing yards carries
--   passing_yards = 136.3, which is 3408 x 0.04.
--
-- Why they can go: written every run, read by nothing.
--   Enumerated every select against the table:
--     libs-server/simulation/load-projection-data.mjs   .select('pid','total')
--     libs-server/simulation/load-data-with-fallback.mjs 'total as projection' (:170),
--                                                        ('pid','total as projection') (:193),
--                                                        .where(...'total','>',0) (:289)
--     libs-server/get-players.mjs:381                    the ONLY whole-row select
--     scripts/process-projections-for-scoring-format.mjs the writer itself
--   get-players attaches the whole row to points[week], so these columns do reach
--   the client payload today -- but nothing reads them there. Sweep over app/ for
--   points.<key>.<stat> returns zero, and the pattern was validated against a
--   positive control first: points.<key>.total returns 5 hits including
--   points.ros.total and points.0.total. So the zero is meaningful rather than a
--   pattern that cannot match. Additionally app/core/worker/index.js:55-65
--   OVERWRITES player.points[week] wholesale with a client-side calculatePoints
--   result whenever a raw projection exists for that week, discarding the server's
--   contribution columns outright.
--
-- Not a loss of anything irrecoverable: the values are a pure function of the raw
--   grain (projections_index / ros_projections) and the scoring format's weights,
--   which is exactly what the in-query scorer at
--   libs-server/data-views-column-definitions/player-projected-column-definitions.mjs:366-384
--   already computes for `total`. Raw coverage is intact for every affected year:
--   projections_index week=0 holds 2020-2026 and ros_projections holds 2024-2026.
--
-- Sequencing note: the writer change (insert only `total`) ships BEFORE this DDL,
--   per the league CLAUDE.md rule about the apply-to-commit window on drops --
--   a drop removes something committed code still names, so the sweep must already
--   be in place. Code-first is safe here because the columns are nullable: a writer
--   that stops populating them simply leaves NULLs in rows about to be dropped.
--
-- Relation before: 1,272,035 rows, 748 MB, 35 of 40 columns dead.
--
-- Deliberately NO VACUUM FULL here, on two grounds. It cannot run in this file at
--   all -- db-exec.sh invokes psql with --single-transaction and VACUUM cannot run
--   inside a transaction block, so including it fails the whole apply. And it is
--   unnecessary: DROP COLUMN only marks the columns dead and leaves the tuples at
--   their old width, but the period-tables cutover that follows issues
--   ALTER COLUMN week TYPE smallint on this same table, which requires a full
--   relation rewrite and reclaims the ~650 MB as a side effect. Until then the
--   space stays allocated, which costs nothing but disk.
--
-- Precedes db/adhoc/2026-07-30-projection-period-tables.sql deliberately: shrinking
--   the table first shortens that cutover's INSERT ... SELECT and week-narrowing,
--   and therefore the window the projection cron must stay paused.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-07-30 against league_production

ALTER TABLE public.scoring_format_player_projection_points
    DROP COLUMN passing_attempts,
    DROP COLUMN passing_completions,
    DROP COLUMN passing_yards,
    DROP COLUMN passing_interceptions,
    DROP COLUMN passing_touchdowns,
    DROP COLUMN rushing_attempts,
    DROP COLUMN rushing_yards,
    DROP COLUMN rushing_touchdowns,
    DROP COLUMN targets,
    DROP COLUMN receptions,
    DROP COLUMN receiving_yards,
    DROP COLUMN receiving_touchdowns,
    DROP COLUMN fumbles_lost,
    DROP COLUMN two_point_conversions,
    DROP COLUMN field_goals_made,
    DROP COLUMN field_goals_made_0_19_yards,
    DROP COLUMN field_goals_made_20_29_yards,
    DROP COLUMN field_goals_made_30_39_yards,
    DROP COLUMN field_goals_made_40_49_yards,
    DROP COLUMN field_goals_made_50_plus_yards,
    DROP COLUMN extra_points_made,
    DROP COLUMN defensive_sacks,
    DROP COLUMN defensive_interceptions,
    DROP COLUMN defensive_forced_fumbles,
    DROP COLUMN defensive_recovered_fumbles,
    DROP COLUMN defensive_three_and_outs,
    DROP COLUMN defensive_fourth_down_stops,
    DROP COLUMN defensive_points_against,
    DROP COLUMN defensive_yards_against,
    DROP COLUMN defensive_blocked_kicks,
    DROP COLUMN defensive_safeties,
    DROP COLUMN defensive_two_point_returns,
    DROP COLUMN defensive_touchdowns,
    DROP COLUMN kickoff_return_touchdowns,
    DROP COLUMN punt_return_touchdowns;
