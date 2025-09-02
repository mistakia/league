import { constants } from '#libs-shared'
import { getLeague, createLeague } from '#libs-server'

export default async function (knex, league_params = {}) {
  await knex('leagues').del()
  await knex('seasons').del()

  const userId = 1
  const leagueId = await createLeague({
    lid: 1,
    hosted: 1,
    commishid: userId,
    draft_start: Math.round(Date.now() / 1000),
    free_agency_live_auction_start: null,
    tddate: constants.season.regular_season_start.add('12', 'weeks').unix(),
    ext_date: constants.season.now.subtract('1', 'week').unix(),
    ...league_params
  })
  const league = await getLeague({ lid: leagueId })

  await knex('users_sources').del()
  await knex('users_teams').del()
  await knex('teams').del()
  await knex('rosters').del()
  await knex('rosters_players').del()
  for (let i = 1; i <= 12; i++) {
    await knex('teams').insert({
      uid: i,
      year: constants.season.year,
      lid: 1,
      waiver_order: i,
      draft_order: i,
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
      tid: i,
      year: constants.season.year
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
  await knex('restricted_free_agency_bids').del()
  await knex('restricted_free_agency_releases').del()
  await knex('poaches').del()
  await knex('poach_releases').del()
  await knex('draft').del()
  await knex('league_cutlist').del()
  await knex('super_priority').del()
}
