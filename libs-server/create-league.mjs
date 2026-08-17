import dayjs from 'dayjs'

import db from '#db'
import { create_default_league, epoch_to_timestamptz } from '#libs-shared'
import {
  find_or_create_scoring_format,
  find_or_create_league_format
} from './find-or-create-format.mjs'
import { current_season } from '#constants'

export default async function ({ lid, commishid, ...params } = {}) {
  const default_league_params = create_default_league({ commishid })
  const league_params = Object.assign({}, default_league_params, params)

  // Article XII §2 (Amendment XXXV): the Free Agency Live Auction must be
  // scheduled no earlier than ten (10) days and no later than two (2) days
  // prior to the start of the Regular Season.
  if (league_params.free_agency_live_auction_start) {
    const auction_start = dayjs.unix(
      league_params.free_agency_live_auction_start
    )
    const regular_season_first_day = current_season.regular_season_start.add(
      1,
      'week'
    )
    const earliest = regular_season_first_day.subtract(10, 'days')
    const latest = regular_season_first_day.subtract(2, 'days')
    if (auction_start.isBefore(earliest) || auction_start.isAfter(latest)) {
      throw new Error(
        'free_agency_live_auction_start must be no earlier than 10 days and no later than 2 days prior to the start of the Regular Season (Article XII §2)'
      )
    }
  }

  const league = {
    commishid,
    name: league_params.name,
    is_hosted: league_params.is_hosted
  }

  if (lid) league.uid = lid

  const leagues = await db('leagues').insert(league).returning('uid')
  const leagueId = leagues[0].uid

  const scoring_format_id = await find_or_create_scoring_format(
    db,
    league_params
  )
  const league_format_id = await find_or_create_league_format(db, {
    ...league_params,
    scoring_format_id
  })

  await db('seasons').insert({
    lid: leagueId,
    season_year: current_season.year,

    league_format_id,
    scoring_format_id,

    max_roster_quarterback: league_params.max_roster_quarterback,
    max_roster_running_back: league_params.max_roster_running_back,
    max_roster_wide_receiver: league_params.max_roster_wide_receiver,
    max_roster_tight_end: league_params.max_roster_tight_end,
    max_roster_defense_special_teams:
      league_params.max_roster_defense_special_teams,
    max_roster_kicker: league_params.max_roster_kicker,

    starting_faab_budget: league_params.starting_faab_budget,

    franchise_tag_limit: league_params.franchise_tag_limit,
    rookie_tag_limit: league_params.rookie_tag_limit,
    restricted_free_agency_tag_limit:
      league_params.restricted_free_agency_tag_limit,

    franchise_tag_salary_quarterback:
      league_params.franchise_tag_salary_quarterback,
    franchise_tag_salary_running_back:
      league_params.franchise_tag_salary_running_back,
    franchise_tag_salary_wide_receiver:
      league_params.franchise_tag_salary_wide_receiver,
    franchise_tag_salary_tight_end:
      league_params.franchise_tag_salary_tight_end,

    // The seasons calendar instants are timestamptz; league_params carries them
    // as epoch seconds, which is the shape the create-league API accepts and
    // what create_default_league produces.
    restricted_free_agency_period_start: epoch_to_timestamptz(
      league_params.restricted_free_agency_period_start
    ),
    restricted_free_agency_period_end: epoch_to_timestamptz(
      league_params.restricted_free_agency_period_end
    ),

    extension_deadline_at: epoch_to_timestamptz(
      league_params.extension_deadline_at
    ),

    draft_start: epoch_to_timestamptz(league_params.draft_start),
    draft_type: league_params.draft_type,
    draft_pick_interval: league_params.draft_pick_interval,
    draft_hour_min: league_params.draft_hour_min,
    draft_hour_max: league_params.draft_hour_max,
    // Required alongside `draft_start` by
    // `seasons_rookie_draft_end_at_set_with_start`: a season that schedules a
    // draft has to say when it hard-closes, because the end is announced now
    // rather than projected from the cadence.
    rookie_draft_end_at: epoch_to_timestamptz(
      league_params.rookie_draft_end_at
    ),

    free_agency_live_auction_start: epoch_to_timestamptz(
      league_params.free_agency_live_auction_start
    ),
    tddate: epoch_to_timestamptz(league_params.tddate)
  })

  return leagueId
}
