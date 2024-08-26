import { constants } from '#libs-shared'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'

const pff_player_seasonlogs_table_alias = ({ params = {} }) => {
  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  if (!year.length) {
    year = [constants.season.stats_season_year]
  }

  return get_table_hash(`pff_player_seasonlogs_${year.join('_')}`)
}

const pff_player_seasonlogs_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    default_year: constants.season.stats_season_year,
    join_table_clause: `pff_player_seasonlogs as ${join_arguments.table_name}`
  })
}

const create_field_from_pff_player_seasonlogs = (column_name) => ({
  column_name,
  table_name: 'pff_player_seasonlogs',
  table_alias: pff_player_seasonlogs_table_alias,
  join: pff_player_seasonlogs_join,
  supported_splits: ['year']
})

export default {
  player_pff_fg_ep_kicker:
    create_field_from_pff_player_seasonlogs('pff_fg_ep_kicker'),
  player_pff_defense_rank:
    create_field_from_pff_player_seasonlogs('pff_defense_rank'),
  player_pff_grade_position:
    create_field_from_pff_player_seasonlogs('pff_grade_position'),
  player_pff_height: create_field_from_pff_player_seasonlogs('pff_height'),
  player_pff_run_block:
    create_field_from_pff_player_seasonlogs('pff_run_block'),
  player_pff_offense: create_field_from_pff_player_seasonlogs('pff_offense'),
  player_pff_special_teams:
    create_field_from_pff_player_seasonlogs('pff_special_teams'),
  player_pff_offense_snaps:
    create_field_from_pff_player_seasonlogs('pff_offense_snaps'),
  player_pff_special_teams_snaps: create_field_from_pff_player_seasonlogs(
    'pff_special_teams_snaps'
  ),
  player_pff_coverage_snaps:
    create_field_from_pff_player_seasonlogs('pff_coverage_snaps'),
  player_pff_punter_rank:
    create_field_from_pff_player_seasonlogs('pff_punter_rank'),
  player_pff_age: create_field_from_pff_player_seasonlogs('pff_age'),
  player_pff_pass_rush:
    create_field_from_pff_player_seasonlogs('pff_pass_rush'),
  player_pff_punter: create_field_from_pff_player_seasonlogs('pff_punter'),
  player_pff_unit: create_field_from_pff_player_seasonlogs('pff_unit'),
  player_pff_pass_block:
    create_field_from_pff_player_seasonlogs('pff_pass_block'),
  player_pff_run_block_snaps: create_field_from_pff_player_seasonlogs(
    'pff_run_block_snaps'
  ),
  player_pff_offense_ranked:
    create_field_from_pff_player_seasonlogs('pff_offense_ranked'),
  player_pff_jersey_number:
    create_field_from_pff_player_seasonlogs('pff_jersey_number'),
  player_pff_position: create_field_from_pff_player_seasonlogs('pff_position'),
  player_pff_defense_snaps:
    create_field_from_pff_player_seasonlogs('pff_defense_snaps'),
  player_pff_pass_snaps:
    create_field_from_pff_player_seasonlogs('pff_pass_snaps'),
  player_pff_defense: create_field_from_pff_player_seasonlogs('pff_defense'),
  player_pff_receiving:
    create_field_from_pff_player_seasonlogs('pff_receiving'),
  player_pff_coverage: create_field_from_pff_player_seasonlogs('pff_coverage'),
  player_pff_speed: create_field_from_pff_player_seasonlogs('pff_speed'),
  player_pff_run: create_field_from_pff_player_seasonlogs('pff_run'),
  player_pff_run_defense_snaps: create_field_from_pff_player_seasonlogs(
    'pff_run_defense_snaps'
  ),
  player_pff_defense_ranked:
    create_field_from_pff_player_seasonlogs('pff_defense_ranked'),
  player_pff_pass_rush_snaps: create_field_from_pff_player_seasonlogs(
    'pff_pass_rush_snaps'
  ),
  player_pff_pass_block_snaps: create_field_from_pff_player_seasonlogs(
    'pff_pass_block_snaps'
  ),
  player_pff_run_defense:
    create_field_from_pff_player_seasonlogs('pff_run_defense'),
  player_pff_special_teams_rank: create_field_from_pff_player_seasonlogs(
    'pff_special_teams_rank'
  ),
  player_pff_run_snaps:
    create_field_from_pff_player_seasonlogs('pff_run_snaps'),
  player_pff_meets_snap_minimum: create_field_from_pff_player_seasonlogs(
    'pff_meets_snap_minimum'
  ),
  player_pff_kickoff_kicker:
    create_field_from_pff_player_seasonlogs('pff_kickoff_kicker'),
  player_pff_status: create_field_from_pff_player_seasonlogs('pff_status'),
  player_pff_pass: create_field_from_pff_player_seasonlogs('pff_pass'),
  player_pff_receiving_snaps: create_field_from_pff_player_seasonlogs(
    'pff_receiving_snaps'
  ),
  player_pff_weight: create_field_from_pff_player_seasonlogs('pff_weight'),
  player_pff_overall_snaps:
    create_field_from_pff_player_seasonlogs('pff_overall_snaps'),
  player_pff_offense_rank:
    create_field_from_pff_player_seasonlogs('pff_offense_rank')
}
