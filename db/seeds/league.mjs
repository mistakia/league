import { constants } from '#common'

export default async function (knex) {
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
    pa: 0.0,
    pc: 0.0,
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
    twoptc: 2,
    tdrec: 6,
    fuml: -1,
    hosted: true,
    prtd: 6,
    krtd: 6
  })

  await knex('seasons').del()
  await knex('seasons').insert({
    lid: 1,
    year: constants.season.year,
    ddate: Math.round(Date.now() / 1000),
    adate: Math.round(Date.now() / 1000),
    tddate: constants.season.start.add('12', 'weeks').unix()
  })

  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]

  await knex('users_sources').del()
  await knex('users_teams').del()
  await knex('teams').del()
  await knex('rosters').del()
  await knex('rosters_players').del()
  for (let i = 1; i <= 12; i++) {
    await knex('teams').insert({
      uid: i,
      lid: 1,
      wo: i,
      do: i,
      cap: league.cap,
      faab: league.faab,
      div: (i % 4) + 1,
      name: `Team${i}`,
      abbrv: `TM${i}`
    })

    for (let week = 0; week <= constants.season.finalWeek; week++) {
      await knex('rosters').insert({
        tid: i,
        lid: 1,
        week,
        year: constants.season.year,
        last_updated: Math.round(Date.now() / 1000)
      })
    }

    await knex('users_teams').insert({
      userid: i,
      tid: i
    })
  }

  await knex('trades').del()
  await knex('trades_picks').del()
  await knex('trades_players').del()
  await knex('trades_transactions').del()
  await knex('trade_releases').del()
  await knex('transactions').del()
  await knex('waivers').del()
  await knex('waiver_releases').del()
  await knex('transition_bids').del()
  await knex('transition_releases').del()
  await knex('poaches').del()
  await knex('poach_releases').del()
}
