import db from '#db'
import { constants } from '#libs-shared'

export default async function ({
  lid,
  userId,
  year = constants.season.year,
  min_week
}) {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year })
    .orderBy('week', 'desc')

  if (min_week === null || min_week === undefined) {
    // for current year, we want to start at the current week (between 0 and final week)
    // for past years we want to start at week 0
    const is_current_year = year === constants.season.year
    if (is_current_year) {
      min_week = Math.min(
        Math.max(constants.season.fantasy_season_week, 0),
        constants.season.finalWeek
      )
    } else {
      min_week = 0
    }
  }

  const lineups = await db('league_team_lineups')
    .where({ lid, year: constants.season.year })
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
  if (userId) {
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
      .where('teams.year', constants.season.year)

    if (query1.length) {
      const tid = query1[0].uid
      const bids = await db('restricted_free_agency_bids')
        .where('tid', tid)
        .where('player_tid', tid)
        .where('year', constants.season.year)
        .whereNull('cancelled')
        .whereNull('processed')

      if (bids.length) {
        // Get conditional releases for all restricted free agency bids
        const restricted_free_agency_releases = await db(
          'restricted_free_agency_releases'
        ).whereIn(
          'restricted_free_agency_bid_id',
          bids.map((b) => b.uid)
        )

        const team_roster = rosters.find((r) => r.tid === tid)
        for (const bid of bids) {
          const player = team_roster.players.find((p) => p.pid === bid.pid)
          if (player && player.tag === constants.tags.RESTRICTED_FREE_AGENCY) {
            player.bid = bid.bid
            player.restricted_free_agency_tag_nominated = bid.nominated
            player.restricted_free_agency_original_team = bid.player_tid

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

  if (constants.season.week === 0) {
    const restricted_free_agency_tagged_players = rosters
      .filter((r) => r.week === 0)
      .flatMap((r) =>
        r.players.filter((p) => p.tag === constants.tags.RESTRICTED_FREE_AGENCY)
      )
    if (restricted_free_agency_tagged_players.length) {
      const restricted_free_agency_bids = await db(
        'restricted_free_agency_bids'
      )
        .select('pid', 'processed', 'nominated', 'announced', 'player_tid')
        .where({
          year: constants.season.year
        })
        .whereRaw('player_tid = tid')
        .whereIn(
          'pid',
          restricted_free_agency_tagged_players.map((p) => p.pid)
        )
        .whereNull('cancelled')

      for (const roster of rosters) {
        if (roster.week !== 0) continue

        for (const player of roster.players) {
          if (player.tag === constants.tags.RESTRICTED_FREE_AGENCY) {
            const bid = restricted_free_agency_bids.find(
              (b) => b.pid === player.pid
            )

            if (bid) {
              player.restricted_free_agency_tag_processed = bid.processed
              player.restricted_free_agency_tag_announced = bid.announced
              player.restricted_free_agency_original_team = bid.player_tid
            }
          }
        }
      }
    }
  }

  return rosters
}
