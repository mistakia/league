import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { build_active_restricted_free_agency_bids_query } from './restricted-free-agency-bids-query.mjs'

export default async function ({
  lid,
  userId,
  year = current_season.year,
  min_week
}) {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year })
    .orderBy('week', 'desc')

  const is_current_year = year === current_season.year
  const current_week = Math.min(
    Math.max(current_season.fantasy_season_week, 0),
    current_season.finalWeek
  )

  if (min_week === null || min_week === undefined) {
    // for current year, we want to start at the current week (between 0 and final week)
    // for past years we want to start at week 0
    min_week = is_current_year ? current_week : 0
  }

  const lineups = await db('league_team_lineups')
    .where({ lid, year: current_season.year })
    .where('week', '>=', min_week)
  const lineupStarters = await db('league_team_lineup_starters')
    .where({
      year,
      lid
    })
    .where('week', '>=', min_week)

  const players = await db('rosters_players')
    .select(
      'rosters_players.*',
      'transactions.type',
      'transactions.value',
      'transactions.timestamp',
      'transactions.year'
    )
    .join('rosters', 'rosters_players.rid', '=', 'rosters.uid')
    .leftJoin('transactions', function () {
      this.on(
        'transactions.uid',
        '=',
        db.raw(
          '(select max(uid) from transactions where transactions.tid = rosters.tid and transactions.pid = rosters_players.pid)'
        )
      )
    })
    .whereIn(
      'rid',
      rosters.map((r) => r.uid)
    )

  rosters.forEach((r) => {
    r.players = players.filter((p) => p.rid === r.uid)
    r.lineups = {}
    const teamLineups = lineups.filter((l) => l.tid === r.tid)
    const teamStarters = lineupStarters.filter((l) => l.tid === r.tid)
    for (const lineup of teamLineups) {
      const lineupStarters = teamStarters.filter((l) => l.week === lineup.week)
      const starter_pids = lineupStarters.map((l) => l.pid)
      r.lineups[lineup.week] = {
        total: lineup.total,
        baseline_total: lineup.baseline_total,
        starter_pids
      }
    }
  })

  // include team restricted free agency bid
  //
  // Only live bids exist, and they are all for the current season, so there is
  // nothing to attach to a historical year's rosters.
  if (userId && is_current_year) {
    const query1 = await db('teams')
      .select('teams.*')
      .join('users_teams', function () {
        this.on('teams.uid', '=', 'users_teams.tid').andOn(
          'teams.year',
          '=',
          'users_teams.year'
        )
      })
      .where('users_teams.userid', userId)
      .where('teams.lid', lid)
      .where('teams.year', current_season.year)

    if (query1.length) {
      const tid = query1[0].uid
      const bids = await build_active_restricted_free_agency_bids_query({
        db,
        tid
      })
        .join(
          'restricted_free_agency_nominations',
          'restricted_free_agency_nominations.nomination_id',
          'restricted_free_agency_bids.nomination_id'
        )
        .where('restricted_free_agency_nominations.original_team_id', tid)
        .select(
          'restricted_free_agency_bids.*',
          'restricted_free_agency_nominations.original_team_id',
          'restricted_free_agency_nominations.nominated_at'
        )

      if (bids.length) {
        // Get conditional releases for all restricted free agency bids
        const restricted_free_agency_releases = await db(
          'restricted_free_agency_releases'
        ).whereIn(
          'restricted_free_agency_bid_id',
          bids.map((b) => b.uid)
        )

        // Pin to the week the client actually renders. `rosters` holds every
        // week of the year ordered week-DESC, so a bare `find` on `tid` returns
        // the HIGHEST week -- which is never the one being served, since every
        // consumer clamps its read back to the current week. Team 6's 2026
        // restricted free agency bids attached to a week-1 slice nobody reads
        // while the week-0 roster it renders charged the pre-bid salaries,
        // putting the dialog's max bid $52 under the true figure.
        const team_roster = rosters.find(
          (r) => r.tid === tid && r.week === current_week
        )
        for (const bid of bids) {
          const player = team_roster?.players.find((p) => p.pid === bid.pid)
          if (
            player &&
            player.tag === player_tag_types.RESTRICTED_FREE_AGENCY
          ) {
            player.bid = bid.bid
            player.restricted_free_agency_tag_nominated = bid.nominated_at
            player.restricted_free_agency_original_team = bid.original_team_id

            // Add conditional releases for this bid
            const releases = restricted_free_agency_releases.filter(
              (r) => r.restricted_free_agency_bid_id === bid.uid
            )
            if (releases.length) {
              player.restricted_free_agency_conditional_releases = releases.map(
                (r) => r.pid
              )
            }
          }
        }
      }
    }
  }

  // Annotate every roster week, not just week 0. The client hides a restricted
  // free agency tag from teams other than the one holding it until the
  // nomination is announced, so `announced_at` has to travel with the tag for
  // as long as the tag itself is on a roster — which is the whole season.
  const restricted_free_agency_tagged_players = rosters.flatMap((r) =>
    r.players.filter((p) => p.tag === player_tag_types.RESTRICTED_FREE_AGENCY)
  )
  if (restricted_free_agency_tagged_players.length) {
    // Read off the nomination: the previous form selected bid rows and
    // filtered `player_tid = tid` to isolate the original team's own tag,
    // which is exactly the fact the nomination now owns.
    const nominations = await db('restricted_free_agency_nominations')
      .select(
        'player_id',
        'original_team_id',
        'nominated_at',
        'announced_at',
        'processed_at'
      )
      .where({
        league_id: lid,
        season_year: year
      })
      .whereIn(
        'player_id',
        restricted_free_agency_tagged_players.map((p) => p.pid)
      )

    for (const player of restricted_free_agency_tagged_players) {
      const nomination = nominations.find((n) => n.player_id === player.pid)

      if (nomination) {
        player.restricted_free_agency_tag_processed = nomination.processed_at
        player.restricted_free_agency_tag_announced = nomination.announced_at
        player.restricted_free_agency_original_team =
          nomination.original_team_id
      }
    }
  }

  return rosters
}
