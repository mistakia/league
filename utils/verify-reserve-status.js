const db = require('../db')
const getRoster = require('./get-roster')
const { constants, Roster } = require('../common')

module.exports = async ({ teamId, leagueId }) => {
  const leagues = await db('leagues').where({ uid: leagueId })
  const league = leagues[0]
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const reservePlayerIds = roster.reserve.map(p => p.player)

  const players = await db('players')
    .select(db.raw('players.player, min(players.status) as status, min(players.injury_status) as injuryStatus, min(players.injury_body_part) as injuryBodyPart'))
    .whereIn('player', reservePlayerIds)
    .groupBy('player')

  for (const player of roster.reserve) {
    const playerItem = players.find(p => p.player === player.player)
    if (!playerItem) {
      throw new Error('Reserve player violation')
    }

    if (player.slot === constants.slots.IR &&
      (!playerItem.status || playerItem.status === 'Active')) {
      throw new Error('Reserve player violation')
    } else if (player.slot === constants.slots.COV &&
      playerItem.status !== 'Reserve/COVID-19') {
      throw new Error('Reserve player violation')
    }
  }
}
