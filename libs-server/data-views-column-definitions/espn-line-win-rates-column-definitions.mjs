// ESPN line win rates: what these columns cover, and the one comparability
// break a reader has to know about before using them across seasons.
//
// COVERAGE. Team grain runs 2018-2025, which is every season ESPN has
// published -- the metrics launched September 2018 and no leaderboard exists in
// markup before that. Player grain runs 2023-2025 only, and that ceiling is
// upstream rather than a gap to be filled: the 2020-2022 articles render each
// player Top-10 as an infographic IMAGE, and the 2018-2019 player lists are
// plain text carrying no ESPN player id, which is the matching key.
//
// RUN BLOCK AND RUN STOP ARE NULL FOR 2018 AND 2019, and that is canonical
// rather than missing. Those two metrics did not exist until 2020; both source
// articles carry exactly two leaderboards. A consumer that treats null here as
// "not yet backfilled" and substitutes pass block would be reproducing a known
// defect in a reference spreadsheet this data was checked against.
//
// WIN RATES 2.0 BREAKS COMPARABILITY WITH ESPN'S OWN CURRENT NUMBERS, not just
// with future seasons. ESPN rewrote the pass-rush and pass-block formulas
// entering the 2026 season (story id/49672562). Everything stored here was
// computed under the ORIGINAL formulas, so:
//
//   - 2018-2025 are comparable WITH EACH OTHER. That series is internally
//     consistent and is the one to use for cross-season work.
//   - They are NOT comparable with what espn.com serves for those same seasons
//     today. ESPN's 2.0 write-up restates 2025 player figures under the new
//     formula and the restatement is large: it puts Nick Herbig's 2025 edge
//     pass-rush win rate at 14.3%, against the 25% stored here. Team figures
//     move far less -- 2025 CHI pass block reads 73.6% there and 0.74 here.
//   - 2026 onward, once the importer is repointed, will be 2.0 and therefore
//     discontinuous with every row before it.
//
// Nothing here converts between the two. The break is recorded rather than
// papered over, because a silent rescale is the failure mode that would make
// every cross-season comparison quietly wrong.

import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const year = params.year || current_season.stats_season_year
  let win_rate_type = params.win_rate_type || 'PASS_RUSH'
  if (Array.isArray(win_rate_type)) {
    win_rate_type = win_rate_type[0] || 'PASS_RUSH'
  }
  return { year: Number(year), win_rate_type }
}

const get_cache_info = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).year
})

const espn_player_win_rates_table_alias = ({ params = {} } = {}) => {
  const { year, win_rate_type } = get_default_params({ params })
  return get_table_hash(`espn_player_win_rates_${year}_${win_rate_type}`)
}

// extra_predicates emits only espn_win_rate_type. The year predicate is
// emitted by the source-attach rule (player-family-to-player-year
// emit_year_match) via query_context.year_reference; year_default is the
// fallback only used when year_reference is unset (never under current
// build_query_context contract). key_columns.{pid,year} are consumed by
// the rule for the ON-clause join.
const espn_player_source = {
  table: 'espn_player_win_rates_index',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'season_year' },
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => [
    {
      column: 'espn_win_rate_type',
      value: get_default_params({ params }).win_rate_type
    }
  ]
}

const espn_team_win_rates_table_alias = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  // Include matchup_opponent_type in the hash to create unique table aliases
  const hash_key = matchup_opponent_type
    ? `espn_team_win_rates_${year}_${matchup_opponent_type}`
    : `espn_team_win_rates_${year}`

  return get_table_hash(hash_key)
}

const espn_team_source = {
  table: 'espn_team_win_rates_index',
  grain: 'team_year',
  key_columns: { team: 'nfl_team', year: 'season_year' },
  year_default: (params) => {
    const raw = params.year ?? current_season.stats_season_year
    const arr = Array.isArray(raw) ? raw : [raw]
    return arr.map(Number)
  }
}

// Range year_offset reduction per column (select-string's correlated-aggregate
// path defaults to SUM). Win rates are percentages, not additive, so a
// multi-year window must AVG rather than SUM -- summing two ~55% seasons renders
// as 110. `line_win_count` is an additive count and keeps the SUM default. A snap-weighted
// pooled rate would be more precise, but the per-season denominator (total reps)
// is not stored on these indexes, so AVG is the least-wrong closed form.
const create_player_espn_line_column = (
  column_name,
  range_offset_aggregate
) => ({
  column_name,
  select_as: () => `espn_line_${column_name}`,
  table_alias: espn_player_win_rates_table_alias,
  source: espn_player_source,
  range_offset_aggregate,
  get_cache_info
})

const create_team_espn_line_column = (column_name) => ({
  table_name: 'espn_team_win_rates_index',
  column_name,
  select_as: () => `espn_team_${column_name}`,
  table_alias: espn_team_win_rates_table_alias,
  source: espn_team_source,
  // All four team columns are win-rate percentages -> AVG across the window.
  range_offset_aggregate: 'AVG',
  get_cache_info
})

export default {
  player_espn_line_win_rate: create_player_espn_line_column('win_rate', 'AVG'),
  player_espn_line_wins: create_player_espn_line_column('line_win_count'),
  team_espn_pass_rush_win_rate:
    create_team_espn_line_column('pass_rush_win_rate'),
  team_espn_pass_block_win_rate: create_team_espn_line_column(
    'pass_block_win_rate'
  ),
  team_espn_run_block_win_rate:
    create_team_espn_line_column('run_block_win_rate'),
  team_espn_run_stop_win_rate: create_team_espn_line_column('run_stop_win_rate')
}
