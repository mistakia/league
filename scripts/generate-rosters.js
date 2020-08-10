// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const db = require('../db')
const { constants } = require('../common')

const run = async () => {
  // get list of hosted leagues
  const leagues = await db('leagues').where('hosted', 1)

  for (const league of leagues) {
    // get current week rosters for league
    const rosters = await db('rosters').where({ lid: league.uid, week: constants.week })
    for (const roster of rosters) {
      // get current roster players
      const { tid, lid, uid } = roster
      const players = await db('rosters_players').where({ rid: uid })
      const newRoster = await db('rosters').insert({
        tid,
        lid,
        week: constants.week + 1,
        year: constants.year
      })
      const newId = newRoster[0]

      const inserts = players.map(p => ({
        rid: newId,
        slot: p.slot,
        player: p.player,
        pos: p.pos
      }))

      await db('rosters_players').insert(inserts)
    }
  }
}

const main = async () => {
  await run()
  process.exit()
}

try {
  main()
} catch (error) {
  console.log(error)
}
