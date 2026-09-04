import db from '#db'

// `original_team_id` comes from the nomination rather than the bid row. It is
// the team that LOSES the player on a cross-team win, and callers read it off
// the returned object -- so it must be projected here, where the table is
// named, or no grep of `restricted_free_agency_bids` will ever reach them.
// THE CALENDAR DAY IS NOT DERIVED HERE, and that is the whole point.
//
// This used to project `TO_CHAR(processed, 'YYYY-MM-DD') AS date`, which
// renders in the POSTGRES session timezone (`Etc/UTC` in production). Its only
// consumer, calculate-team-daily-ktc-value, matched that string against a day
// it derived from `transactions.occurred_at` with `dayjs(...).format(...)` --
// which renders in the NODE PROCESS timezone. Two formatters, two zones, one
// equality comparison between them.
//
// A signing and the tag transaction that records it are the same event seconds
// apart, so the two agree on the day in ANY single zone and disagree only when
// the event falls between midnight in one zone and midnight in the other. The
// league host resolves America/New_York, so a bid processed at 00:46 UTC is
// the 9th to postgres and the 8th to node, the lookup misses, and the job
// throws `no restricted free agency signing found`. Two of league 1's tags sit
// in that window; the failure was latent only because an unrelated league
// threw earlier in the same run.
//
// Returning the raw timestamptz and letting the caller format it makes the two
// sides use ONE formatter in ONE process, so they agree no matter which zone
// that process runs in. Do not reintroduce a date string HERE: a correct
// rendering that merely picks the same zone by luck fails again the day the
// host's zone changes, which is exactly how this arrived.
//
// That is a rule about THIS query, not a ban on TO_CHAR. The test is whether a
// rendered day is later compared against one rendered somewhere else -- which
// is true here and is why it broke. `calculate-team-daily-ktc-value` also
// renders `keeptradecut_valuations.observed_at` in SQL, and that one is fine:
// it is the publication day of an external feed, keyed against itself on both
// sides of its own lookup, never against a node-rendered day.
export default async function ({ lid, year = null }) {
  const restricted_free_agency_bids_query = db('restricted_free_agency_bids')
    .select(
      'restricted_free_agency_bids.*',
      'restricted_free_agency_nominations.original_team_id'
    )
    .leftJoin(
      'restricted_free_agency_nominations',
      'restricted_free_agency_nominations.nomination_id',
      'restricted_free_agency_bids.nomination_id'
    )
    .where({
      is_successful: true,
      'restricted_free_agency_bids.lid': lid
    })

  if (year) {
    restricted_free_agency_bids_query.where({
      'restricted_free_agency_bids.season_year': year
    })
  }

  const restricted_free_agency_bids = await restricted_free_agency_bids_query

  return restricted_free_agency_bids
}
