export default async function (knex) {
  await knex('users_sources').del()
  await knex('users_teams').del()
  await knex('teams').del()
  await knex('rosters').del()
  await knex('rosters_players').del()

  await knex('trades').del()
  await knex('trades_picks').del()
  await knex('trades_players').del()
  await knex('trades_transactions').del()
  await knex('trade_releases').del()
  await knex('transactions').del()
  await knex('waivers').del()
  await knex('waiver_releases').del()
  await knex('poaches').del()
  await knex('poach_releases').del()

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
    ddate: Math.round(Date.now() / 1000),
    adate: Math.round(Date.now() / 1000),
    tddate: 1606626000
  })
}
