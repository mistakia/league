import { createLeague } from '#libs-server'
import { default_rookie_draft_end_at } from './league.mjs'
import { current_season } from '#constants'
import reset_league_tables from './reset-league-tables.mjs'

export default async function (knex) {
  // This used to carry its own hand-maintained copy of the reset list, and it
  // had drifted seventeen tables behind league.mjs -- clearing neither the
  // restricted-free-agency tables, nor bid_changelog, draft, league_cutlist,
  // super_priority, trades_slots, nor league_pauses. Sharing the one list is
  // what makes that drift unrepresentable rather than merely fixed.
  await reset_league_tables(knex)

  // Not league-scoped, so not part of the shared reset.
  await knex('users_sources').del()

  // After the deletes, never before -- see reset-league-tables.mjs for the
  // primary-key collision window a restart-first ordering opens.
  await knex.raw('ALTER SEQUENCE teams_team_id_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE rosters_roster_id_seq RESTART WITH 1')

  const userId = 1
  const draft_start_timestamp = Math.round(Date.now() / 1000)
  await createLeague({
    commissioner_user_id: userId,
    lid: 1,
    is_hosted: 1,
    draft_start: draft_start_timestamp,
    // Required alongside `draft_start` by
    // `seasons_rookie_draft_end_at_set_with_start`; same value the league
    // fixture uses, for the same reason.
    rookie_draft_end_at: default_rookie_draft_end_at(draft_start_timestamp),
    free_agency_live_auction_start: current_season.regular_season_start
      .add(1, 'week')
      .subtract(5, 'days')
      .unix(),
    trade_deadline_at: 1606626000
  })
}
