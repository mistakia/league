import dayjs from 'dayjs'

import db from '#db'
import { ASSET_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'
import {
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'

// Point-in-time keeptradecut value of the draft picks a team holds, for any
// date in a league's history.
//
// Pick ownership is NOT re-derived here. `roster_asset_holding` already carries
// one row per (team, pick) ownership window with `period_start` / `period_end`,
// produced by libs-server/roster-asset-lineage/walk-transactions.mjs, which
// resolves endowment, trade chains, draft conversion and undrafted expiry --
// including league 1's recorded anomalies, such as trade #64 naming a losing
// team that never held the pick. Re-deriving that walk in a second place is how
// the two copies come to disagree.
//
// The three inputs ktc_pick_at needs -- pick_year, pick_round and
// pick_draft_overall_position -- are columns on that table, so no join back to
// `draft` is needed.

// `period_start` / `period_end` are `timestamp without time zone`, written from
// timestamptz values through the writing session's timezone and read back
// through the node process's. Production runs both in America/New_York, so the
// wall clock round-trips; comparing at day granularity keeps an hour of drift
// from ever moving a holding across a day boundary anyway.
const to_date_string = (value) =>
  value ? dayjs(value).format('YYYY-MM-DD') : null

// keeptradecut publishes pick rankings against a league size, which decides
// which third of the round an overall position falls in. The league's size is a
// property of the season the pick belongs to, and it has changed -- league 1 ran
// 12 teams through 2022 and 10 from 2023 -- so it is read off the `seasons` row
// for the pick's own year rather than hardcoded.
const load_number_teams_by_season_year = async ({ lid }) => {
  const rows = await db('seasons')
    .join('league_formats', 'league_formats.id', 'seasons.league_format_id')
    .where('seasons.lid', lid)
    .select('seasons.season_year', 'league_formats.number_teams')

  const number_teams_by_season_year = new Map()
  for (const row of rows) {
    number_teams_by_season_year.set(row.season_year, row.number_teams)
  }
  return number_teams_by_season_year
}

export const build_pick_holding_value_index = async ({ lid, is_superflex }) => {
  const holding_rows = await db('roster_asset_holding')
    .where({ lid, asset_type: ASSET_TYPE.PICK })
    .select(
      'tid',
      'pick_year',
      'pick_round',
      'pick_draft_overall_position',
      'period_start',
      'period_end'
    )

  const holdings = holding_rows.map((row) => ({
    tid: row.tid,
    pick_year: row.pick_year,
    pick_round: row.pick_round,
    pick_draft_overall_position: row.pick_draft_overall_position,
    start_date: to_date_string(row.period_start),
    end_date: to_date_string(row.period_end)
  }))

  const keeptradecut_pick_index = await load_pick_ktc_indexes({ is_superflex })
  const number_teams_by_season_year = await load_number_teams_by_season_year({
    lid
  })

  // A pick for a season that has no `seasons` row yet -- league 1's 2027 and
  // 2028 picks -- has no league size of its own. Every one of those also has a
  // null overall position, so ktc_pick_at takes the mid slot and never consults
  // number_teams; the most recent known size is the honest stand-in for the day a
  // future season's draft order does get set before its season row exists.
  const known_season_years = Array.from(number_teams_by_season_year.keys())
  const latest_number_teams = known_season_years.length
    ? number_teams_by_season_year.get(Math.max(...known_season_years))
    : null

  // ktc_pick_at's analog-year fallback scans every ranked pick series, so it is
  // far too expensive to call once per holding per day. Distinct
  // (year, round, position, date) combinations per league are few -- a day
  // resolves roughly twenty -- so the memo collapses the whole run onto them.
  const value_cache = new Map()
  const resolve_pick_value = ({ holding, date, target_unix }) => {
    const number_teams =
      number_teams_by_season_year.get(holding.pick_year) ?? latest_number_teams
    const cache_key = `${holding.pick_year}__${holding.pick_round}__${holding.pick_draft_overall_position}__${number_teams}__${date}`
    if (value_cache.has(cache_key)) return value_cache.get(cache_key)

    const value = ktc_pick_at({
      pick_year: holding.pick_year,
      pick_round: holding.pick_round,
      pick_overall_position: holding.pick_draft_overall_position,
      number_teams,
      target_unix,
      idx: keeptradecut_pick_index
    })
    value_cache.set(cache_key, value)
    return value
  }

  // Returns a Map of tid -> { pick_value, held_pick_count, valued_pick_count }
  // for the picks held at the END of `date`, matching the end-of-day roster the
  // player side of this calculation records. A holding that opens and closes on
  // the same day is therefore not held.
  const get_team_pick_values = ({ date }) => {
    const target_unix = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)
    const values_by_team_id = new Map()

    for (const holding of holdings) {
      if (holding.start_date > date) continue
      if (holding.end_date !== null && holding.end_date <= date) continue

      let team = values_by_team_id.get(holding.tid)
      if (!team) {
        team = { pick_value: 0, held_pick_count: 0, valued_pick_count: 0 }
        values_by_team_id.set(holding.tid, team)
      }
      team.held_pick_count += 1

      // Null is keeptradecut not ranking this pick, which for a sum of trade
      // value is zero: rounds 5 and beyond are outside the published series
      // entirely (keeptradecut_pick constrains round to 1-4), so those picks
      // contribute nothing rather than blocking the day.
      const value = resolve_pick_value({ holding, date, target_unix })
      if (value === null) continue

      team.valued_pick_count += 1
      team.pick_value += value
    }

    return values_by_team_id
  }

  return { get_team_pick_values, holding_count: holdings.length }
}

export default build_pick_holding_value_index
