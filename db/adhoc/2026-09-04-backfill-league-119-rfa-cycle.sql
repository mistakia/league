-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Give league 119 the restricted-free-agency cycle its own transaction log
-- already asserts. Closes signal 128458.
--
-- WHAT IS WRONG. League 119 is the auction mirror of league 1, cloned
-- 2026-09-01. The clone copied all 12,200 transactions including 115
-- RESTRICTED_FREE_AGENCY_TAG rows, while `NOT_CLONED_REASONS` deliberately
-- withheld `restricted_free_agency_bids` -- so the mirror publishes 115
-- assertions whose evidence it removed. `calculate-team-daily-ktc-value` reads
-- the tag, looks the signing up by (pid, date), and throws when there is none:
--
--   lid=119 threw: no restricted free agency signing found for
--   LAMA-JACK-008142__2021-08-19
--
-- The CODE is already fixed and deployed (league ccf14c438, live as 70c1a93f6).
-- `clone_league_board` now carries nominations, bids and releases with ids and
-- team ids remapped, and the valuation driver isolates per league. That governs
-- the NEXT clone and does nothing for the rows league 119 already holds. This
-- file is the repair for those rows, and it is the only one of its kind that
-- will ever be needed -- a future mirror gets the cycle at clone time.
--
-- WHY BACKFILL RATHER THAN RE-CLONE. A re-clone through the now-correct
-- `clone_league_board` is the tempting answer because it exercises the fixed
-- path, and it is the wrong one here. It wipes the mirror while league 1's
-- auction is live through 2026-09-08 and the mirror is in use, and it would
-- re-copy league 1's transactions accrued since 09-01 -- silently changing the
-- board the mirror exists to walk. This file writes only what is missing:
-- INSERTs into three tables, no DELETE, and no UPDATE to any row league 119
-- already holds.
--
-- REVERSIBLE ALMOST ENTIRELY: deleting on lid=119 in the three tables restores
-- the previous state, EXCEPT that the two sequence positions advanced at the
-- foot of this file stay advanced. `nextval` and `setval` are non-transactional
-- by design, so no rollback and no compensating delete gives those back. The
-- consequence is a gap in two opaque surrogate id spaces, which nothing reads
-- for meaning -- but "fully reversible" would be false and is not claimed.
--
-- THE TEAM MAPPING IS DERIVED, NOT ASSUMED. The original clone recorded it
-- nowhere. Two independent derivations agree that league 119's team_id is its
-- league 1 counterpart plus 326:
--
--   Joining `teams` for the two leagues on (season_year, abbreviation, name)
--   maps 1 -> 327 through 12 -> 338, one target per source, no ambiguity.
--
--   Joining `transactions` on (pid, occurred_at, type, player_salary) matches
--   13,159 pairs, and the tid delta is 326 on every one of them, with no
--   second value anywhere in the distribution.
--
-- That is consistent with how the clone allocates: it inserts teams ordered by
-- (team_id, season_year) and draws a fresh sequence id per team, so a league of
-- 12 teams cloned into an empty id range comes out contiguous. The offset is
-- asserted below rather than trusted, because a coincidence that holds for all
-- 13,159 rows would still be a coincidence.
--
-- ID REMAPPING BY OFFSET, the same shape the clone uses for team ids. Each new
-- id is the old id plus the table's current max, so every new id lands in
-- (max, 2*max] -- above everything that exists and below nothing, therefore
-- free. The offsets are captured BEFORE the first insert, since inserting moves
-- the max out from under any later reader of it.
--
-- NOMINATIONS AND BIDS REFERENCE EACH OTHER -- bids.nomination_id one way,
-- nominations.winning_bid_id the other. Nominations land first with the
-- back-reference held null, and it is filled once the bid ids exist.
--
-- NOTHING SCHEDULED CAN ACT ON THESE ROWS, checked rather than hoped:
--
--   process-restricted-free-agency-bids.mjs runs every 5 minutes over every
--   league, but gates on seasons.restricted_free_agency_period_end >= now.
--   League 119's 2026 period closed 2026-08-11. Independently, league 1 holds
--   ZERO 2026 bids that are both unprocessed and uncancelled, so there is no
--   eligible row to copy in the first place. Either fact alone is sufficient.
--
--   reset-player-restricted-free-agency-tags.mjs hardcodes `const lid = 1` and
--   never sees league 119.
--
-- db:exec supplies the transaction; do NOT add BEGIN/COMMIT.

-- ---------------------------------------------------------------------------
-- Pre-conditions. Each aborts the whole file rather than writing a half repair.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  existing_nominations int;
  existing_bids int;
  mismatched_teams int;
BEGIN
  SELECT count(*) INTO existing_nominations
    FROM restricted_free_agency_nominations WHERE league_id = 119;
  SELECT count(*) INTO existing_bids
    FROM restricted_free_agency_bids WHERE lid = 119;

  IF existing_nominations <> 0 OR existing_bids <> 0 THEN
    RAISE EXCEPTION
      'league 119 already carries an RFA cycle (% nominations, % bids); this file assumes it holds none and would duplicate them',
      existing_nominations, existing_bids;
  END IF;

  -- The +326 offset, asserted against the natural key rather than taken on
  -- faith. Every league 1 team row must have a league 119 row at team_id + 326
  -- agreeing on season, abbreviation and name.
  SELECT count(*) INTO mismatched_teams
    FROM teams source
    WHERE source.lid = 1
      AND NOT EXISTS (
        SELECT 1 FROM teams target
         WHERE target.lid = 119
           AND target.team_id = source.team_id + 326
           AND target.season_year = source.season_year
           AND target.abbreviation IS NOT DISTINCT FROM source.abbreviation
           AND target.name IS NOT DISTINCT FROM source.name
      );

  IF mismatched_teams <> 0 THEN
    RAISE EXCEPTION
      'the +326 team mapping does not hold: % league 1 team rows have no matching league 119 row at team_id + 326',
      mismatched_teams;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Offsets, captured before anything is written.
-- ---------------------------------------------------------------------------

-- ON COMMIT DROP rather than a DROP at the foot of the file: a mid-file abort
-- skips a trailing DROP but never skips this.
CREATE TEMP TABLE rfa_backfill_offsets ON COMMIT DROP AS
SELECT
  (SELECT max(nomination_id) FROM restricted_free_agency_nominations)
    AS nomination_offset,
  (SELECT max(bid_id) FROM restricted_free_agency_bids)
    AS bid_offset;

-- ---------------------------------------------------------------------------
-- Nominations. Expect league 1's own count, asserted below rather than pinned
-- here as a literal that goes stale the next time league 1 runs an RFA cycle.
-- ---------------------------------------------------------------------------

INSERT INTO restricted_free_agency_nominations (
  nomination_id, league_id, player_id, season_year, original_team_id,
  nominated_at, announced_at, processed_at, winning_bid_id
)
SELECT
  n.nomination_id + o.nomination_offset,
  119,
  n.player_id,
  n.season_year,
  n.original_team_id + 326,
  n.nominated_at,
  n.announced_at,
  n.processed_at,
  NULL
FROM restricted_free_agency_nominations n
CROSS JOIN rfa_backfill_offsets o
WHERE n.league_id = 1;

-- ---------------------------------------------------------------------------
-- Bids. EVERY bid, not only the successful ones: the valuation job needs the
-- winner, but a cycle in which every bid won is not the cycle league 1 ran, and
-- the RFA surfaces read the losing bids too. Count asserted below, not pinned.
-- ---------------------------------------------------------------------------

INSERT INTO restricted_free_agency_bids (
  bid_id, pid, user_id, bid_amount, tid, season_year, lid, is_successful,
  submitted, processed, cancelled, nomination_id, outcome, outcome_detail
)
SELECT
  b.bid_id + o.bid_offset,
  b.pid,
  b.user_id,
  b.bid_amount,
  b.tid + 326,
  b.season_year,
  119,
  b.is_successful,
  b.submitted,
  b.processed,
  b.cancelled,
  CASE WHEN b.nomination_id IS NULL
       THEN NULL
       ELSE b.nomination_id + o.nomination_offset
  END,
  b.outcome,
  b.outcome_detail
FROM restricted_free_agency_bids b
CROSS JOIN rfa_backfill_offsets o
WHERE b.lid = 1;

-- ---------------------------------------------------------------------------
-- The back-reference, now that both id spaces exist.
-- ---------------------------------------------------------------------------

UPDATE restricted_free_agency_nominations target
   SET winning_bid_id = source.winning_bid_id + o.bid_offset
  FROM restricted_free_agency_nominations source
  CROSS JOIN rfa_backfill_offsets o
 WHERE source.league_id = 1
   AND source.winning_bid_id IS NOT NULL
   AND target.league_id = 119
   AND target.nomination_id = source.nomination_id + o.nomination_offset;

-- ---------------------------------------------------------------------------
-- Releases. Scoped through the bid rather than by a league column, which this
-- table does not carry. Count asserted below, not pinned.
-- ---------------------------------------------------------------------------

INSERT INTO restricted_free_agency_releases (
  restricted_free_agency_bid_id, pid
)
SELECT
  r.restricted_free_agency_bid_id + o.bid_offset,
  r.pid
FROM restricted_free_agency_releases r
JOIN restricted_free_agency_bids b
  ON b.bid_id = r.restricted_free_agency_bid_id
CROSS JOIN rfa_backfill_offsets o
WHERE b.lid = 1;

-- ---------------------------------------------------------------------------
-- Move both sequences past the explicit ids just inserted. A row inserted with
-- an explicit id does not advance the sequence behind it, so the next nextval
-- would collide on the primary key. Only ever FORWARD -- a sequence legitimately
-- ahead of its table must not be rewound to hand those ids out twice.
-- ---------------------------------------------------------------------------

SELECT setval(
  pg_get_serial_sequence('restricted_free_agency_nominations', 'nomination_id'),
  GREATEST(
    (SELECT max(nomination_id) FROM restricted_free_agency_nominations),
    COALESCE(pg_sequence_last_value(pg_get_serial_sequence(
      'restricted_free_agency_nominations', 'nomination_id')), 1)
  )
);

SELECT setval(
  pg_get_serial_sequence('restricted_free_agency_bids', 'bid_id'),
  GREATEST(
    (SELECT max(bid_id) FROM restricted_free_agency_bids),
    COALESCE(pg_sequence_last_value(pg_get_serial_sequence(
      'restricted_free_agency_bids', 'bid_id')), 1)
  )
);

-- ---------------------------------------------------------------------------
-- Post-conditions. The last one is the invariant the valuation job enforces,
-- stated here so a repair that inserted rows but did not FIX anything aborts.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  source_nominations int;
  target_nominations int;
  source_bids int;
  target_bids int;
  source_releases int;
  target_releases int;
  unmatched_signings int;
  tagged_transactions int;
  unjustified_tags int;
BEGIN
  SELECT count(*) INTO source_nominations
    FROM restricted_free_agency_nominations WHERE league_id = 1;
  SELECT count(*) INTO target_nominations
    FROM restricted_free_agency_nominations WHERE league_id = 119;

  -- The non-zero arm is the one that matters, and it is not decoration. Every
  -- count comparison below is target-against-source, so if a source predicate
  -- ever matched nothing both sides read 0, the equality holds, and a file that
  -- copied NOTHING reports success. That is the same silent-no-op class the
  -- schema guide records for an UPDATE matching zero rows, and equality alone
  -- cannot see it.
  IF source_nominations = 0 THEN
    RAISE EXCEPTION
      'league 1 has no RFA nominations, so there is nothing to copy; the source predicate is wrong';
  END IF;
  IF source_nominations <> target_nominations THEN
    RAISE EXCEPTION 'nomination count %, expected % to match league 1',
      target_nominations, source_nominations;
  END IF;

  SELECT count(*) INTO source_bids
    FROM restricted_free_agency_bids WHERE lid = 1;
  SELECT count(*) INTO target_bids
    FROM restricted_free_agency_bids WHERE lid = 119;
  IF source_bids <> target_bids THEN
    RAISE EXCEPTION 'bid count %, expected % to match league 1',
      target_bids, source_bids;
  END IF;

  SELECT count(*) INTO source_releases
    FROM restricted_free_agency_releases r
    JOIN restricted_free_agency_bids b ON b.bid_id = r.restricted_free_agency_bid_id
   WHERE b.lid = 1;
  SELECT count(*) INTO target_releases
    FROM restricted_free_agency_releases r
    JOIN restricted_free_agency_bids b ON b.bid_id = r.restricted_free_agency_bid_id
   WHERE b.lid = 119;
  IF source_releases <> target_releases THEN
    RAISE EXCEPTION 'release count %, expected % to match league 1',
      target_releases, source_releases;
  END IF;

  -- The successful-bid (pid, processed-date) SET must be identical to league
  -- 1's, which is what makes the timezone question moot: the valuation job
  -- keys on that pair, league 1 prices clean against it, and league 119 now
  -- presents byte-identical pairs.
  SELECT count(*) INTO unmatched_signings FROM (
    SELECT pid, to_char(processed, 'YYYY-MM-DD') AS signed_on
      FROM restricted_free_agency_bids WHERE lid = 1 AND is_successful
    EXCEPT ALL
    SELECT pid, to_char(processed, 'YYYY-MM-DD')
      FROM restricted_free_agency_bids WHERE lid = 119 AND is_successful
  ) diff;
  IF unmatched_signings <> 0 THEN
    RAISE EXCEPTION
      '% successful league 1 signings have no league 119 counterpart at the same (pid, date)',
      unmatched_signings;
  END IF;

  -- The failure this file exists to close, stated directly: every
  -- RESTRICTED_FREE_AGENCY_TAG transaction in league 119 must have a
  -- successful bid at the same player and the same day.
  --
  -- Guarded on the tag population first, for the same reason as the counts
  -- above: "no tag lacks a signing" is trivially TRUE of a league with no tags,
  -- so a wrong lid or a wrong type constant would satisfy this check while
  -- proving nothing. The tags are the thing that broke; assert they are there.
  SELECT count(*) INTO tagged_transactions
    FROM transactions WHERE lid = 119 AND type = 10;
  IF tagged_transactions = 0 THEN
    RAISE EXCEPTION
      'league 119 has no RESTRICTED_FREE_AGENCY_TAG transactions, so this check cannot prove anything; the lid or the type constant is wrong';
  END IF;

  SELECT count(*) INTO unjustified_tags
    FROM transactions t
   WHERE t.lid = 119
     AND t.type = 10
     AND NOT EXISTS (
       SELECT 1 FROM restricted_free_agency_bids b
        WHERE b.lid = 119
          AND b.is_successful
          AND b.pid = t.pid
          AND to_char(b.processed, 'YYYY-MM-DD')
              = to_char(t.occurred_at, 'YYYY-MM-DD')
     );
  IF unjustified_tags <> 0 THEN
    RAISE EXCEPTION
      '% league 119 restricted free agency tags still have no signing to justify them',
      unjustified_tags;
  END IF;
END $$;

