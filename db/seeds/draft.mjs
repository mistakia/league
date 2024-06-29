import { constants, Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'

export default async function (knex) {
  const lid = 1
  const league = await getLeague({ lid })
  const players = await knex('player').orderByRaw('RANDOM()')

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
      pid: player.pid,
      pos: player.pos1,
      rid: roster.uid,
      tid: roster.tid,
      lid: league.uid,
      year: constants.season.year,
      week: constants.season.week
    })
    const value = Math.floor(Math.random() * Math.min(r.availableCap, 60))
    await knex('transactions').insert([
      {
        userid: roster.tid,
        tid: roster.tid,
        lid: league.uid,
        pid: player.pid,
        type: constants.transactions.AUCTION_BID,
        value,
        week: constants.season.week,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      },
      {
        userid: roster.tid,
        tid: roster.tid,
        lid: league.uid,
        pid: player.pid,
        type: constants.transactions.AUCTION_PROCESSED,
        value,
        week: constants.season.week,
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
