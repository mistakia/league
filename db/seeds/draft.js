const { constants, getEligibleSlots, formatRoster } = require('../../common')

module.exports = async function (knex) {
  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]

  const players = await knex('player')
    .innerJoin('draft_rankings', 'player.player', 'draft_rankings.player')
    .orderBy('rank', 'asc')
    .where('seas', constants.year)

  const eligibleSlots = getEligibleSlots({ bench: true, league })
  const eligibleSlotNumbers = eligibleSlots.map(k => constants.slots[k])

  const hasOpenSlot = (roster) => {
    const formatted = formatRoster(roster)
    for (const slot of eligibleSlotNumbers) {
      if (!formatted.get(`s${slot}`)) {
        return `s${slot}`
      }
    }

    return null
  }

  let i = 1
  const rosters = await knex('rosters').where({ tid: i })
  let roster = rosters[0]
  while (hasOpenSlot(roster)) {
    const formatted = formatRoster(roster)

    let player
    let openSlot
    for (let p = 0; p < players.length; p++) {
      player = players[p]
      const { pos1: pos } = player
      const playerSlots = getEligibleSlots({ bench: true, league, pos })
      const playerSlotNumbers = playerSlots.map(k => constants.slots[k])
      for (const slot of playerSlotNumbers) {
        if (!formatted.get(`s${slot}`)) {
          openSlot = `s${slot}`
          break
        }
      }

      if (openSlot) {
        players.splice(p, 1)
        break
      }
    }

    roster[openSlot] = player.player
    await knex('rosters').update({ ...roster }).where({ week: roster.week, tid: roster.tid })
    await knex('transactions').insert({
      userid: roster.tid,
      tid: roster.tid,
      lid: league.uid,
      player: player.player,
      type: 7,
      value: Math.floor(Math.random() * 50) + 1,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    })

    if (i === 12) {
      i = 1
    } else {
      i += 1
    }
    const rosters = await knex('rosters').where({ tid: i })
    roster = rosters[0]
  }
}
