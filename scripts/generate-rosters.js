// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const db = require('../db')
const { constants } = require('../common')

const run = async () => {
  // get list of hosted leagues
  const leagues = await db('leagues')

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
      const matching = players.filter(p => existingPlayerIds.includes(p.player))
      const missing = players.filter(p => !existingPlayerIds.includes(p.player))
      const excessive = existingPlayers.filter(p => !currentPlayerIds.includes(p.player))
      const inserts = missing.map(p => ({
        rid,
        slot: p.slot,
        player: p.player,
        pos: p.pos
      }))

      const updates = matching.filter(p => {
        const item = existingPlayers.find(i => i.player === p.player)
        return item.slot !== p.slot
      })

      await db('rosters_players').insert(inserts)
      if (excessive.length) {
        await db('rosters_players')
          .where('rid', rid)
          .whereIn('player', excessive.map(p => p.player))
      }

      if (updates.length) {
        for (const { player, slot } of updates) {
          await db('rosters_players')
            .where({ rid, player })
            .update({ slot })
        }
      }
    }
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GENERATE_ROSTERS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
