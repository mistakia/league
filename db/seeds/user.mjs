import { createLeague } from '#libs-server'

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
  await knex('seasons').del()

  const userId = 1
  await createLeague({
    commishid: userId,
    lid: 1,
    hosted: 1,
    draft_start: Math.round(Date.now() / 1000),
    free_agency_live_auction_start: Math.round(Date.now() / 1000),
    tddate: 1606626000
  })
}
