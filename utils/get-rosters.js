const db = require('../db')
const { constants } = require('../common')

module.exports = async ({ lid, userId }) => {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year: constants.season.year })
    .orderBy('week', 'desc')

  const currentWeek = Math.max(constants.season.week, 1)
  const lineups = await db('league_team_lineups')
    .where({ lid })
    .where('week', '>=', currentWeek)
  const lineupStarters = await db('league_team_lineup_starters')
    .where({
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
          '(select max(uid) from transactions where transactions.tid = rosters.tid and transactions.player = rosters_players.player)'
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
      const starters = lineupStarters.map((l) => l.player)
      r.lineups[lineup.week] = { total: lineup.total, starters }
    }
  })

  // include team restricted free agency bid
  if (userId) {
    const query1 = await db('teams')
      .select('teams.*')
      .join('users_teams', 'teams.uid', 'users_teams.userid')
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
          const player = teamRoster.players.find((p) => p.player === bid.player)
          player.bid = bid.bid
        }
      }
    }
  }

  return rosters
}
