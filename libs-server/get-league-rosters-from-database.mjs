import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { build_active_restricted_free_agency_bids_query } from './restricted-free-agency-bids-query.mjs'
import { build_salary_in_force_transaction_id } from './roster-player-salary.mjs'

export default async function ({
  lid,
  userId,
  year = current_season.year,
  min_week
}) {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, season_year: year })
    .orderBy('week', 'desc')

  const is_current_year = year === current_season.year
  const current_week = Math.min(
    Math.max(current_season.fantasy_season_week, 0),
    current_season.final_week
  )

  if (min_week === null || min_week === undefined) {
    // for current year, we want to start at the current week (between 0 and final week)
    // for past years we want to start at week 0
    min_week = is_current_year ? current_week : 0
  }

  const lineups = await db('league_team_lineups')
    .where({ lid, season_year: current_season.year })
    .where('week', '>=', min_week)
  const lineupStarters = await db('league_team_lineup_starters')
    .where({
      season_year: year,
      lid
    })
    .where('week', '>=', min_week)

  const players = await db('rosters_players')
    .select(
      'rosters_players.*',
      // The in-memory and wire vocabulary for a rostered player is `pos`/`rid`
      // (libs-shared/roster.mjs, app/core/rosters/reducer.js, and every API
      // response that mirrors a roster row). The physical columns are
      // player_position/roster_id, so translate at this read boundary rather
      // than renaming a field that is not a column across the SPA. Without
      // these aliases the Roster constructor destructures `pos` off a row that
      // no longer has it and silently gets undefined.
      'rosters_players.player_position as pos',
      'rosters_players.roster_id as rid',
      'transactions.type',
      'transactions.player_salary',
      'transactions.occurred_at',
      'transactions.season_year'
    )
    .join('rosters', 'rosters_players.roster_id', '=', 'rosters.roster_id')
    // The salary in force at each roster's own snapshot, per the one rule in
    // roster-player-salary.mjs. This used to be a bare `max(transaction_id)`
    // with no as-of bound and no `occurred_at` ordering -- the pre-fix rule that
    // get-roster.mjs was repaired away from and this copy was not. It agrees
    // with the repaired rule only while transaction ids happen to run
    // chronologically, which is what hid the divergence: the board rendered one
    // budget while the auction settled against another.
    .leftJoin('transactions', function () {
      this.on(
        'transactions.transaction_id',
        '=',
        build_salary_in_force_transaction_id({
          db,
          tid: 'rosters.tid',
          pid: 'rosters_players.pid',
          as_of_year: 'rosters.season_year',
          as_of_week: 'rosters.week'
        })
      )
    })
    .whereIn(
      // QUALIFIED deliberately: this statement joins `rosters`, and both tables
      // now carry `roster_id` where the parent used to carry the retired
      // surrogate name. The rename is what removed the accidental
      // disambiguation, so a bare reference here is a 42702.
      'rosters_players.roster_id',
      rosters.map((r) => r.roster_id)
    )

  rosters.forEach((r) => {
    r.players = players.filter((p) => p.roster_id === r.roster_id)
    r.lineups = {}
    const teamLineups = lineups.filter((l) => l.tid === r.tid)
    const teamStarters = lineupStarters.filter((l) => l.tid === r.tid)
    for (const lineup of teamLineups) {
      const lineupStarters = teamStarters.filter((l) => l.week === lineup.week)
      const starter_pids = lineupStarters.map((l) => l.pid)
      r.lineups[lineup.week] = {
        // `league_team_lineups.total` was renamed to `optimal_total` in
        // 72346e579. The API key stays `total` -- `app/core/rosters/sagas.js`
        // reads `result[week].total` -- so only the source column moves.
        total: lineup.optimal_total,
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
        this.on('teams.team_id', '=', 'users_teams.tid').andOn(
          'teams.season_year',
          '=',
          'users_teams.season_year'
        )
      })
      .where('users_teams.user_id', userId)
      .where('teams.lid', lid)
      .where('teams.season_year', current_season.year)

    if (query1.length) {
      const tid = query1[0].team_id
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
          bids.map((b) => b.bid_id)
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
            player.bid = bid.bid_amount
            player.restricted_free_agency_tag_nominated = bid.nominated_at
            player.restricted_free_agency_original_team = bid.original_team_id

            // Add conditional releases for this bid
            const releases = restricted_free_agency_releases.filter(
              (r) => r.restricted_free_agency_bid_id === bid.bid_id
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
