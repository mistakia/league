-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Make kicking and DST scoring configurable per format, and replace the dedup
-- mechanism with a generated digest.
--
-- Kicking and DST are scored today with literals inline in
-- libs-shared/calculate-points.mjs, so every league on the platform scores a
-- blocked kick at 3 and a defensive touchdown at 6 whether it wants to or not.
-- This adds the 21 columns that let a format say otherwise, backfilled to
-- exactly the values the literals use, so no existing score moves.
--
-- The backfill for field goals is PER-YARD at 0.1, not the 3/3/3/4/5 distance
-- bands the code also contains. calculate-points.mjs branches on
-- `if (stats.field_goal_yards)` and returns `yards / 10`, which makes the band
-- arm unreachable whenever that stat is populated -- and it always is. Measured
-- over 2025 REG kickers: 626 gamelogs, 453 with field-goal yards, 453 with band
-- counts, 453 with both, and ZERO with bands but no yards. Backfilling the
-- bands to 3/3/3/4/5 would have silently cut every kicker's score, so the bands
-- go in at 0 and the per-yard rate carries the legacy behaviour.
--
-- Every new column is FIXED-SCALE, never bare `numeric`. An unconstrained
-- numeric renders 0.1 and 0.10 differently under ::text, so two equal configs
-- would produce different digests and mint duplicate format rows -- a failure
-- the old numeric-equality index could not have had.
--
-- The two threshold columns are counts rather than rates, so they are smallint:
-- the repo's numeric(2,1) scoring convention cannot hold 300.
--
--
-- WHY A DIGEST, AND WHY IT IS NOT CONTENT-DERIVED IDENTITY
--
-- Dedup here is enforced by a UNIQUE constraint across the whole config tuple.
-- That tuple is already 23 columns and these 21 take it to 44, against a
-- Postgres max_index_keys of 32 (confirmed against production). The index
-- rebuild that user:guideline/schema/avoid-content-derived-identity.md
-- prescribes for schema evolution here simply cannot be performed any more.
--
-- So `config_digest` is a generated md5 over an explicit canonical
-- concatenation of every scoring column, with a UNIQUE index on it alone. This
-- is not the failure that guideline forbids. That disaster was `id` BEING the
-- hash, so adding a column invalidated every stored identifier across millions
-- of referencing rows. Nothing references config_digest, `id` is untouched and
-- stays opaque, and Postgres recomputes a generated column itself -- so a
-- future column addition costs a table rewrite and nothing else.
--
-- The concatenation is written out explicitly because row(...)::text is not
-- IMMUTABLE and cannot back a generated column. The '|' separator cannot occur
-- in a numeric or boolean rendering. Every column but scoring_format_title is
-- NOT NULL (checked), so the coalesce is belt and braces rather than load
-- bearing.
--
-- Verified against production before authoring: the 65 existing rows produce 65
-- distinct digests under this expression, so nothing collapses.
--
--
-- WHY THE OLD CONSTRAINT SURVIVES THIS FILE
--
-- league_scoring_formats_config_unique is NOT dropped here, and that is
-- deliberate rather than an oversight. Deployed production code still spells
-- its upsert `ON CONFLICT (<the 23 columns>)`, which requires a unique index on
-- exactly those columns; dropping it before the deploy lands would fail every
-- find_or_create_scoring_format call -- including live external-league import --
-- for the whole human-gated window between this apply and that deploy. The two
-- oracles overlap instead, and the drop is its own file
-- (2026-08-04-drop-league-scoring-formats-config-unique.sql).
--
-- The overlap is NOT free, and an earlier draft of this comment was wrong about
-- why. The retained constraint is strictly stricter than the digest, so it
-- rejects a pair of formats differing solely in the new kicking and DST
-- columns -- and the code that can create such a pair is running for exactly
-- the part of the window that follows the deploy. Reproduced on a scratch
-- database: with this file applied and the drop not, inserting a config
-- differing from an existing row only in `defensive_touchdowns` raises a
-- duplicate-key violation on league_scoring_formats_config_unique, which
-- ON CONFLICT (config_digest) does not catch. A commissioner editing a DST
-- value in league settings during that window gets a 500.
--
-- So the two windows are not symmetric, and the split is still the right call:
-- BEFORE the deploy the retained constraint is what keeps the old code working
-- and costs nothing, and AFTER the deploy it is a live hazard. Apply the drop
-- IMMEDIATELY after the deploy verifies -- minutes, not hours -- rather than
-- treating it as cleanup. Dropping it here instead would have failed every
-- find_or_create_scoring_format call for the whole human-gated wait, which is
-- strictly worse and lasts strictly longer.
--
--
-- The transaction is REQUIRED. Nothing here is safe to half-apply: the digest
-- column and its unique index must land together with the columns they are
-- computed from. No non-blocking index build is needed or wanted (that phrasing
-- is deliberate -- db:exec greps this whole file, comments included, for the
-- keyword that would name one, and refusing to write it here is cheaper than
-- being told to run without a transaction).

-- Kicking. field_goal_yards is a per-yard rate; the five bands partition the
-- same made kicks and are additive with it, so a banded league sets the bands
-- and zeroes the rate. field_goals_made gets no column on purpose: it is the
-- total the bands partition, and scoring both double-counts.
ALTER TABLE public.league_scoring_formats
  ADD COLUMN field_goal_yards numeric(4,3) DEFAULT 0.1 NOT NULL,
  ADD COLUMN field_goals_made_0_19_yards numeric(4,2) DEFAULT 0 NOT NULL,
  ADD COLUMN field_goals_made_20_29_yards numeric(4,2) DEFAULT 0 NOT NULL,
  ADD COLUMN field_goals_made_30_39_yards numeric(4,2) DEFAULT 0 NOT NULL,
  ADD COLUMN field_goals_made_40_49_yards numeric(4,2) DEFAULT 0 NOT NULL,
  ADD COLUMN field_goals_made_50_plus_yards numeric(4,2) DEFAULT 0 NOT NULL,
  ADD COLUMN extra_points_made numeric(4,2) DEFAULT 1 NOT NULL;

-- DST: ten flat per-event values, plus two rate/threshold pairs replacing the
-- hardcoded `max(pa - 20, 0) * -0.4` and `max(ya - 300, 0) * -0.02` shapes.
ALTER TABLE public.league_scoring_formats
  ADD COLUMN defensive_sacks numeric(4,2) DEFAULT 1 NOT NULL,
  ADD COLUMN defensive_interceptions numeric(4,2) DEFAULT 2 NOT NULL,
  ADD COLUMN defensive_forced_fumbles numeric(4,2) DEFAULT 1 NOT NULL,
  ADD COLUMN defensive_recovered_fumbles numeric(4,2) DEFAULT 1 NOT NULL,
  ADD COLUMN defensive_three_and_outs numeric(4,2) DEFAULT 1 NOT NULL,
  ADD COLUMN defensive_fourth_down_stops numeric(4,2) DEFAULT 1 NOT NULL,
  ADD COLUMN defensive_blocked_kicks numeric(4,2) DEFAULT 3 NOT NULL,
  ADD COLUMN defensive_safeties numeric(4,2) DEFAULT 2 NOT NULL,
  ADD COLUMN defensive_two_point_returns numeric(4,2) DEFAULT 2 NOT NULL,
  ADD COLUMN defensive_touchdowns numeric(4,2) DEFAULT 6 NOT NULL,
  ADD COLUMN defensive_points_against numeric(4,3) DEFAULT -0.4 NOT NULL,
  ADD COLUMN defensive_points_against_threshold smallint DEFAULT 20 NOT NULL,
  ADD COLUMN defensive_yards_against numeric(5,4) DEFAULT -0.02 NOT NULL,
  ADD COLUMN defensive_yards_against_threshold smallint DEFAULT 300 NOT NULL;

-- The dedup oracle. Column order here matches libs-shared/scoring-columns.mjs;
-- test/libs-shared.scoring-registries.spec.mjs parses this expression out of
-- the exported schema and fails if any registry column is missing from it,
-- because an omission would silently merge two distinct formats onto one id
-- with no error anywhere.
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
    coalesce(receiving_touchdowns::text, '') || '|' ||
    coalesce(two_point_conversions::text, '') || '|' ||
    coalesce(punt_return_touchdowns::text, '') || '|' ||
    coalesce(kickoff_return_touchdowns::text, '') || '|' ||
    coalesce(fumble_return_touchdowns::text, '') || '|' ||
    coalesce(exclude_quarterback_kneels::text, '') || '|' ||
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

-- Fails the transaction on a collision, which is the real assertion that the
-- digest preserves every existing format's identity.
CREATE UNIQUE INDEX league_scoring_formats_config_digest_unique
  ON public.league_scoring_formats (config_digest);

-- Same fact, stated so a failure reads as itself rather than as a duplicate-key
-- violation on an index whose purpose is not obvious from the error.
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
