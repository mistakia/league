const { constants, Roster } = require('../../common')
const { getRoster } = require('../../utils')

module.exports = async function (knex) {
  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]

  const players = await knex('player')
    .leftJoin('rankings', 'player.player', 'rankings.player')
    .orderBy('ornk', 'asc')
    .where('rankings.year', constants.season.year)

  await knex('rosters_players').del()

  let i = 1
  let roster = await getRoster({
    tid: i,
    week: constants.season.week,
    year: constants.season.year
  })
  let r = new Roster({ roster, league })
  while (!r.isFull) {
    let player
    for (let p = 0; p < players.length; p++) {
      player = players[p]
      const hasOpenSlot = r.hasOpenBenchSlot(player.pos1)

      if (hasOpenSlot) {
        players.splice(p, 1)
        break
      }
    }

    await knex('rosters_players').insert({
      slot: constants.slots.BENCH,
      player: player.player,
      pos: player.pos1,
      rid: roster.uid
    })
    const value = Math.floor(Math.random() * Math.min(r.availableCap, 60))
    await knex('transactions').insert([
      {
        userid: roster.tid,
        tid: roster.tid,
        lid: league.uid,
        player: player.player,
        type: constants.transactions.AUCTION_BID,
        value,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      },
      {
        userid: roster.tid,
        tid: roster.tid,
        lid: league.uid,
        player: player.player,
        type: constants.transactions.AUCTION_PROCESSED,
        value,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      }
    ])

    if (i === 12) {
      i = 1
    } else {
      i += 1
    }
    roster = await getRoster({
      tid: i,
      week: constants.season.week,
      year: constants.season.year
    })
    r = new Roster({ roster, league })
  }
}
