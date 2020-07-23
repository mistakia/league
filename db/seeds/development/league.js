const bcrypt = require('bcrypt')
const nflTeams = require('../nfl-teams')
const draft = require('../draft')
const { constants } = require('../../../common')
const { getSchedule } = require('../../../utils')

exports.seed = async function (knex, Promise) {
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
    rbrec: 0.5,
    wrrec: 0.5,
    terec: 0.5,
    rec: 0.5,
    recy: 0.1,
    twoptc: 0,
    tdrec: 6,
    fuml: -1,
    ddate: Math.round(Date.now() / 1000),
    adate: Math.round(Date.now() / 1000)
  })

  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]

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
      wo: i,
      do: i,
      acap: league.cap,
      div: (i % 4) + 1,
      name: `Team${i}`,
      abbrv: `TM${i}`
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

  await knex('trades').del()
  await knex('trades_picks').del()
  await knex('trades_players').del()
  await knex('trades_transactions').del()
  await knex('trades_drops').del()
  await knex('transactions').del()

  // draft players - seed lineups
  try {
    // await draft(knex)
  } catch (error) {
    console.log(error)
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
