-- STATUS: APPLIED 2026-08-05 against league_production
--
-- The three scoring primitives Scott Fish Bowl 2026 (SFB16) needs, plus the two
-- gamelog stats one of them reads.
--
-- SFB16 needs three things no existing format needs: a milestone / big-play
-- bonus rule list, a tight-end first-down premium, and a toggle for whether a
-- touchdown also counts as a first down. All three are additive and
-- default-inert: every one of the 65 existing formats keeps its exact meaning,
-- its slug, and its historical gamelogs.
--
--
-- WHY EACH COLUMN IS NOT NULL WITH A DEFAULT
--
-- Every column on league_scoring_formats is NOT NULL, and config_digest
-- coalesces NULL to '' -- so a nullable column would let NULL and the empty
-- value digest identically while behaving differently, which is exactly the
-- silent format-merge the digest exists to prevent.
--
--   bonuses                          '[]'::jsonb  empty rule list
--   tight_end_receiving_first_downs  0            parallels tight_end_reception
--   touchdown_is_first_down          true         the norm; false is the
--                                                 labeled deviation (Sleeper)
--
-- `touchdown_is_first_down` defaults TRUE because that is what the platform
-- does today for every format on both scoring paths. A dead guard in the
-- from-plays path meant to distinguish the Sleeper variant could never fire --
-- league_scoring_formats has no scoring_format_id column, so the branch read an
-- always-undefined property -- so TRUE is the behaviour being preserved, not a
-- guess.
--
--
-- WHY bonuses IS jsonb AND WHY IT IS CANONICALIZED IN APPLICATION CODE
--
-- A bonus rule is { type, stat, threshold, points }. jsonb normalizes object
-- key order and whitespace on store, so two equal rule objects render
-- identically under ::text. Array ORDER is the one remaining degree of freedom
-- and jsonb preserves it, so [A, B] and [B, A] would digest differently and
-- mint two format rows for one rule set, silently.
--
-- Canonicalization therefore runs in resolve_scoring_config BEFORE the value is
-- stored, not inside the digest expression. A generated column must be
-- IMMUTABLE and cannot contain a set-returning function, so jsonb_array_elements
-- is unavailable; routing it through a user-defined IMMUTABLE function would
-- make a generated column depend on a function whose pg_dump / restore ordering
-- is a known hazard. Canonical-on-write is simpler and dump-safe.
--
--
-- WHY THE DIGEST IS DROPPED AND RE-ADDED
--
-- config_digest is GENERATED ALWAYS ... STORED, so the three new columns have to
-- be inside its concatenation or two formats differing only in a bonus rule
-- would collapse onto one row. A generated column's expression cannot be
-- altered in place, so it is dropped and re-added -- a table rewrite, which
-- 2026-08-04-kicking-dst-scoring-config.sql already named as the accepted cost
-- of a column addition here.
--
-- The unique index goes with the column and is recreated after it. There is no
-- ON CONFLICT hazard of the kind that file documented: the conflict target is
-- `config_digest`, the same spelling before and after, and the column exists
-- again before this transaction commits.
--
--
-- WHY THE TWO EXCLUDING-TD STATS ARE REGISTRY ENTRIES, NOT A CARVE-OUT
--
-- `touchdown_is_first_down = false` needs a first-down count that excludes
-- touchdowns, which no stat carries today. These are registered as stat-only
-- entries in the base group -- exactly the shape rushing_yards_excluding_kneels
-- already has -- rather than as a hand-rolled filter exception in
-- generate-player-gamelogs.mjs.
--
-- That route persists them through all_fantasy_stats, which is what a carve-out
-- would have hand-rolled. The price is that generate-nfl-team-seasonlogs.mjs
-- rolls up every all_fantasy_stats member over team gamelogs, so
-- nfl_team_seasonlogs needs matching columns or the rollup breaks. That is paid
-- here, with precedent: rushing_yards_excluding_kneels carries exactly such a
-- column on that table.
--
-- Both are DEFAULT 0 rather than NULL so the rollup sums a number for every
-- historical row rather than propagating NULL through a SUM.

-- ---------------------------------------------------------------------------
-- league_scoring_formats: the three primitives
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_scoring_formats
  ADD COLUMN bonuses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tight_end_receiving_first_downs numeric(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN touchdown_is_first_down boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- config_digest: rebuild with the three appended in registry order
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.league_scoring_formats_config_digest_unique;

ALTER TABLE public.league_scoring_formats
  DROP COLUMN config_digest;

-- test/libs-shared.scoring-registries.spec.mjs parses this expression out of the
-- exported schema and fails if any registry column is missing from it, because
-- an omission would silently merge two distinct formats onto one id with no
-- error anywhere.
ALTER TABLE public.league_scoring_formats
  ADD COLUMN config_digest text GENERATED ALWAYS AS (md5(
    coalesce(passing_attempts::text, '') || '|' ||
    coalesce(passing_completions::text, '') || '|' ||
    coalesce(passing_yards::text, '') || '|' ||
    coalesce(passing_interceptions::text, '') || '|' ||
    coalesce(passing_touchdowns::text, '') || '|' ||
    coalesce(rushing_attempts::text, '') || '|' ||
    coalesce(rushing_yards::text, '') || '|' ||
    coalesce(rushing_touchdowns::text, '') || '|' ||
    coalesce(rushing_first_downs::text, '') || '|' ||
    coalesce(fumbles_lost::text, '') || '|' ||
    coalesce(targets::text, '') || '|' ||
    coalesce(receptions::text, '') || '|' ||
    coalesce(running_back_reception::text, '') || '|' ||
    coalesce(wide_receiver_reception::text, '') || '|' ||
    coalesce(tight_end_reception::text, '') || '|' ||
    coalesce(receiving_yards::text, '') || '|' ||
    coalesce(receiving_first_downs::text, '') || '|' ||
    coalesce(tight_end_receiving_first_downs::text, '') || '|' ||
    coalesce(receiving_touchdowns::text, '') || '|' ||
    coalesce(two_point_conversions::text, '') || '|' ||
    coalesce(punt_return_touchdowns::text, '') || '|' ||
    coalesce(kickoff_return_touchdowns::text, '') || '|' ||
    coalesce(fumble_return_touchdowns::text, '') || '|' ||
    coalesce(is_excluding_quarterback_kneels::text, '') || '|' ||
    coalesce(touchdown_is_first_down::text, '') || '|' ||
    coalesce(bonuses::text, '') || '|' ||
    coalesce(field_goal_yards::text, '') || '|' ||
    coalesce(field_goals_made_0_19_yards::text, '') || '|' ||
    coalesce(field_goals_made_20_29_yards::text, '') || '|' ||
    coalesce(field_goals_made_30_39_yards::text, '') || '|' ||
    coalesce(field_goals_made_40_49_yards::text, '') || '|' ||
    coalesce(field_goals_made_50_plus_yards::text, '') || '|' ||
    coalesce(extra_points_made::text, '') || '|' ||
    coalesce(defensive_sacks::text, '') || '|' ||
    coalesce(defensive_interceptions::text, '') || '|' ||
    coalesce(defensive_forced_fumbles::text, '') || '|' ||
    coalesce(defensive_recovered_fumbles::text, '') || '|' ||
    coalesce(defensive_three_and_outs::text, '') || '|' ||
    coalesce(defensive_fourth_down_stops::text, '') || '|' ||
    coalesce(defensive_points_against::text, '') || '|' ||
    coalesce(defensive_points_against_threshold::text, '') || '|' ||
    coalesce(defensive_yards_against::text, '') || '|' ||
    coalesce(defensive_yards_against_threshold::text, '') || '|' ||
    coalesce(defensive_blocked_kicks::text, '') || '|' ||
    coalesce(defensive_safeties::text, '') || '|' ||
    coalesce(defensive_two_point_returns::text, '') || '|' ||
    coalesce(defensive_touchdowns::text, '')
  )) STORED;

CREATE UNIQUE INDEX league_scoring_formats_config_digest_unique
  ON public.league_scoring_formats (config_digest);

-- Carried forward from the kicking/DST migration: a collapsing digest fails the
-- transaction here rather than shipping. Stated as its own assertion so a
-- failure reads as itself instead of as a duplicate-key violation on an index
-- whose purpose is not obvious from the error.
DO $$
DECLARE
  row_count bigint;
  digest_count bigint;
BEGIN
  SELECT count(*), count(DISTINCT config_digest)
    INTO row_count, digest_count
    FROM public.league_scoring_formats;

  IF row_count <> digest_count THEN
    RAISE EXCEPTION
      'config_digest collides: % rows produce only % distinct digests',
      row_count, digest_count;
  END IF;

  RAISE NOTICE 'config_digest: % rows, % distinct digests', row_count, digest_count;
END
$$;

-- ---------------------------------------------------------------------------
-- The two excluding-touchdown first-down stats
-- ---------------------------------------------------------------------------

-- player_gamelogs is partitioned; adding to the parent propagates. Typed to
-- match the sibling first-down counts on this table (smallint NOT NULL
-- DEFAULT 0), not the wider numeric the seasonlog rollup uses -- a per-game
-- first-down count is a small integer.
ALTER TABLE public.player_gamelogs
  ADD COLUMN rushing_first_downs_excluding_touchdowns smallint DEFAULT 0 NOT NULL,
  ADD COLUMN receiving_first_downs_excluding_touchdowns smallint DEFAULT 0 NOT NULL;

-- Required, not optional: registering the two stats in the base group puts them
-- in all_fantasy_stats, and generate-nfl-team-seasonlogs.mjs sums every member
-- over team gamelogs and inserts. Without these the rollup fails on its next
-- run. rushing_yards_excluding_kneels is the exact precedent.
--
-- numeric(5,2) here matches the sibling season-total first-down columns on this
-- table, which are wider than the per-game ones because they hold a season sum.
ALTER TABLE public.nfl_team_seasonlogs
  ADD COLUMN rushing_first_downs_excluding_touchdowns numeric(5,2) DEFAULT 0.00,
  ADD COLUMN receiving_first_downs_excluding_touchdowns numeric(5,2) DEFAULT 0.00;
