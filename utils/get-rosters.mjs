import db from '#db'
import { constants } from '#common'

import getRosterPenalty from './get-roster-penalty.mjs'

export default async function ({ lid, userId }) {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year: constants.season.year })
    .orderBy('week', 'desc')

  const currentWeek = Math.max(constants.season.week, 1)
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

  for (const roster of rosters) {
    roster.penalty = await getRosterPenalty({
      tid: roster.tid,
      year: constants.season.year
    })
    roster.players = players.filter((p) => p.rid === roster.uid)
    roster.lineups = {}
    const teamLineups = lineups.filter((l) => l.tid === roster.tid)
    const teamStarters = lineupStarters.filter((l) => l.tid === roster.tid)
    for (const lineup of teamLineups) {
      const lineupStarters = teamStarters.filter((l) => l.week === lineup.week)
      const starter_pids = lineupStarters.map((l) => l.pid)
      roster.lineups[lineup.week] = { total: lineup.total, starter_pids }
    }

    // TODO add poaches

    roster.acquired_rfa_pids = []
    if (constants.season.isOffseason) {
      const result = await db('transition_bids')
        .select('pid')
        .where({
          year: constants.season.year,
          succ: 1,
          tid: roster.tid
        })
        .whereNot({ player_tid: roster.tid })
      roster.acquired_rfa_pids = result.map((p) => p.pid)
    }
  }

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
