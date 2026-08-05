-- STATUS: PENDING
--
-- Record the operator cancellation of league 1 bid uid 600 as its own event in
-- bid_changelog, at the instant it actually happened.
--
-- WHY THIS FILE EXISTS
--
-- On 2026-08-05 an operator set `cancelled = 1785944348` on
-- restricted_free_agency_bids uid 600 directly in production, with no route and
-- no user request behind it. It was a duplicate of uid 601 -- same league, same
-- team (5), same user (6), same player (ANDR-MCCO-004333), same amount ($3),
-- both live -- created because a display defect hid the first bid from the
-- manager, who then re-entered it. 601 was kept and 600 cancelled.
--
-- The snapshot backfill cannot see this. Both bids were submitted at 1785931275
-- and 1785936784, well after the final 2026-08-05 00:00 backup, so neither
-- appears in any snapshot at all and the cancellation is nowhere in that
-- reconstruction. The `initial_table_seed` rows written by
-- 2026-08-05-create-bid-changelog.sql do carry the cancelled state, because they
-- read the live table -- but they carry it stamped at the APPLY instant and
-- attributed to nothing, which would record a deliberate operator decision as an
-- unexplained difference between a backup and the present.
--
-- So the event gets a row of its own: change_type `cancelled` at its true
-- timestamp, with change_source `manual_database_correction`. That source value
-- exists because of this change. An audit trail whose vocabulary cannot say "a
-- human edited the database" must describe such a change as whichever API path
-- it least resembles, and a wrong attribution in an audit trail is worse than an
-- absent one, because it is believed.
--
-- `changed_by_user_id` is NULL. The bid's own userid (6) is the manager who
-- submitted it, not the operator who cancelled it, and it is already recorded as
-- `bid_user_id` -- attributing the cancellation to that manager would say they
-- withdrew a bid they did not withdraw. There is no user id for an operator
-- acting outside the application, and inventing one would be the same error.
--
-- Apply AFTER 2026-08-05-create-bid-changelog.sql. Order relative to the
-- snapshot backfill does not matter; the trail is ordered by changed_at, not by
-- insertion.

-- Refuse to write a row describing a state the table does not hold. If uid 600
-- is not the row this file was written against -- restored, re-cancelled at a
-- different instant, re-keyed -- then the literals in the header are stale and a
-- silent no-op would leave that unnoticed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.restricted_free_agency_bids
    WHERE uid = 600
      AND lid = 1
      AND year = 2026
      AND tid = 5
      AND pid = 'ANDR-MCCO-004333'
      AND bid_amount = 3
      AND cancelled = 1785944348
  ) THEN
    RAISE EXCEPTION
      'restricted_free_agency_bids uid 600 does not match the state this file records; re-verify before applying';
  END IF;
END
$$;

-- Snapshotted from the bid row rather than written from literals, for the same
-- reason libs-server/record-bid-change.mjs reads the row back instead of
-- trusting a caller payload: a trail row that can disagree with its subject is
-- worse than none.
INSERT INTO public.bid_changelog (
  bid_type,
  bid_id,
  league_id,
  team_id,
  player_id,
  season_year,
  change_type,
  change_source,
  changed_by_user_id,
  changed_at,
  bid_amount,
  bid_user_id,
  cancelled_at,
  processed_at,
  is_successful,
  outcome,
  outcome_detail,
  conditional_release_player_ids
)
SELECT
  'restricted_free_agency',
  bids.uid,
  bids.lid,
  bids.tid,
  bids.pid,
  bids.year,
  'cancelled',
  'manual_database_correction',
  NULL,
  TO_TIMESTAMP(bids.cancelled),
  bids.bid_amount,
  bids.userid,
  TO_TIMESTAMP(bids.cancelled),
  TO_TIMESTAMP(bids.processed),
  bids.is_successful,
  bids.outcome,
  bids.outcome_detail,
  COALESCE(
    (
      SELECT array_agg(releases.pid ORDER BY releases.pid)
      FROM public.restricted_free_agency_releases AS releases
      WHERE releases.restricted_free_agency_bid_id = bids.uid
    ),
    ARRAY[]::character varying(25)[]
  )
FROM public.restricted_free_agency_bids AS bids
WHERE bids.uid = 600;

ANALYZE public.bid_changelog;
