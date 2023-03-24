import db from '#db'
import { constants } from '#common'

export default async function ({ lid, userId }) {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year: constants.season.year })
    .orderBy('week', 'desc')

  const currentWeek = Math.min(
    Math.max(constants.season.fantasy_season_week, 0),
    constants.season.finalWeek
  )
  const lineups = await db('league_team_lineups')
    .where({ lid, year: constants.season.year })
    .where('week', '>=', currentWeek)
  const lineupStarters = await db('league_team_lineup_starters')
    .where({
      year: constants.season.year,
      lid
    })
    .where('week', '>=', currentWeek)

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
      .join('users_teams', 'teams.uid', 'users_teams.tid')
      .where('users_teams.userid', userId)
      .where('teams.lid', lid)

    if (query1.length) {
      const tid = query1[0].uid
      const bids = await db('transition_bids')
        .where('tid', tid)
        .where('player_tid', tid)
        .where('year', constants.season.year)
        .whereNull('cancelled')
        .whereNull('processed')

      if (bids.length) {
        const teamRoster = rosters.find((r) => r.tid === tid)
        for (const bid of bids) {
          const player = teamRoster.players.find((p) => p.pid === bid.pid)
          if (player && player.tag === constants.tags.TRANSITION)
            player.bid = bid.bid
        }
      }
    }
  }

  return rosters
}
