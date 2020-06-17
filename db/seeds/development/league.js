const bcrypt = require('bcrypt')
const nflTeams = require('../nfl-teams')
const { constants, getEligibleSlots, formatRoster } = require('../../../common')
const { getSchedule } = require('../../../utils')

exports.seed = async function(knex, Promise) {
  // TODO (medium) - seed armchair data

  try {
    await nflTeams(knex)
  } catch (error) {
    console.log(error)
  }

  await knex('leagues').del()
  await knex('leagues').insert({
    uid: 1,
    commishid: 1,
    name: 'TEFLON',
    nteams: 12,
    sqb: 1,
    srb: 2,
    swr: 2,
    ste: 1,
    srbwr: 0,
    srbwrte: 1,
    sqbrbwrte: 1,
    swrte: 0,
    sdst: 1,
    sk: 1,
    bench: 7,
    ps: 4,
    ir: 3,
    mqb: 0,
    mrb: 0,
    mwr: 0,
    mte: 0,
    mdst: 3,
    mk: 3,
    faab: 200,
    cap: 200,
    pa: 0.00,
    pc: 0.00,
    py: 0.05,
    ints: -1,
    tdp: 4,
    ra: 0.0,
    ry: 0.1,
    tdr: 6,
    rec: 0.5,
    recy: 0.1,
    twoptc: 0,
    tdrec: 6,
    fuml: -1,
    draft_start: Math.round(Date.now() / 1000),
    auction_start: Math.round(Date.now() / 1000)
  })

  await knex('users').del()
  await knex.raw('ALTER TABLE users AUTO_INCREMENT = 1')
  const userCount = 12
  for (let i = 1; i <= userCount; i++) {
    const salt = await bcrypt.genSalt(10)
    const password = await bcrypt.hash(`password${i}`, salt)
    await knex('users').insert({
      email: `user${i}@email.com`,
      password
    })
  }

  await knex('users_sources').del()
  await knex('users_teams').del()
  await knex('teams').del()
  await knex('rosters').del()
  for (let i = 1; i <= userCount; i++) {
    await knex('teams').insert({
      uid: i,
      lid: 1,
      div: (i % 4) + 1,
      name: `Team${i}`
    })

    await knex('rosters').insert({
      tid: i,
      lid: 1,
      week: 0,
      year: constants.year,
      last_updated: Math.round(Date.now() / 1000)
    })

    await knex('users_teams').insert({
      userid: i,
      tid: i
    })
  }

  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]

  await knex('transactions').del()

  // draft players - seed lineups
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

  await knex('matchups').del()
  const teams = await knex('teams').where({ lid: 1 })
  const schedule = getSchedule(teams)
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      await knex('matchups').insert({
        hid: matchup.home.uid,
        aid: matchup.away.uid,
        lid: league.uid,
        week: index + 1,
        year: constants.year
      })
    }
  }

  await knex('draft').del()
  for (let i = 1; i <= (3 * league.nteams); i++) {
    const idx = i % league.nteams
    const team = teams[idx]
    await knex('draft').insert({
      tid: team.uid,
      lid: league.uid,
      pick: i,
      round: Math.ceil(i / league.nteams),
      year: constants.year
    })
  }

  for (const team of teams) {
    for (let i = 1; i < 4; i++) {
      await knex('draft').insert({
        tid: team.uid,
        lid: league.uid,
        round: i,
        year: (constants.year + 1)
      })
    }
  }

}
