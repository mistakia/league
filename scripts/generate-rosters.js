// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const db = require('../db')
const { constants } = require('../common')

const run = async () => {
  // get list of hosted leagues
  const leagues = await db('leagues').where('hosted', 1)

  const isCurrentYear = constants.season.week < constants.season.finalWeek
  const week = isCurrentYear ? (constants.season.week + 1) : 0
  const year = isCurrentYear ? constants.season.year : (constants.season.year + 1)

  for (const league of leagues) {
    // get latest rosters for league
    const rosters = await db('rosters')
      .where({
        lid: league.uid,
        year: constants.season.year,
        week: constants.season.week
      })

    for (const roster of rosters) {
      // get current roster players
      const { tid, lid, uid } = roster
      const players = await db('rosters_players').where({ rid: uid })
      const currentPlayerIds = players.map(p => p.player)

      // get roster id
      const rosterData = {
        tid,
        lid,
        week,
        year
      }
      const rosterRows = await db('rosters').where(rosterData)
      let rid = rosterRows.length ? rosterRows[0].uid : null
      if (!rid) {
        const newRoster = await db('rosters').insert(rosterData)
        rid = newRoster[0]
      }

      // insert any missing players & remove excess players
      const existingPlayers = await db('rosters_players').where({ rid })
      const existingPlayerIds = existingPlayers.map(p => p.player)
      const missing = players.filter(p => !existingPlayerIds.includes(p.player))
      const excessive = existingPlayers.filter(p => !currentPlayerIds.includes(p.player))
      const inserts = missing.map(p => ({
        rid,
        slot: p.slot,
        player: p.player,
        pos: p.pos
      }))

      await db('rosters_players').insert(inserts)
      if (excessive.length) {
        await db('rosters_players')
          .where('rid', rid)
          .whereIn('player', excessive.map(p => p.player))
      }
    }
  }
}

module.exports = run

const main = async () => {
  try {
    await run()
  } catch (error) {
    console.log(error)
  }

  process.exit()
}

if (!module.parent) {
  main()
}
