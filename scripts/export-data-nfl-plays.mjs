import debug from 'debug'
import fs from 'node:fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convert_to_csv } from '#libs-shared'
import { current_season } from '#constants'
import { is_main } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-nfl-plays')
enable_debug_namespaces('export-data-nfl-plays')
const nfl_play_fields = [
  'esbid',
  'play_id',
  'sequence',
  'state',

  'down_number',
  'quarter',

  'play_description',
  'play_description_nflfastr',

  'yard_line_number',
  'yard_line_side',
  'yard_line_start',
  'yard_line_end',
  'yard_line_100',

  'starting_hash',
  'is_motion',

  'yards_to_go',

  'offense_formation',
  'offense_personnel',
  'defense_personnel',
  'box_defenders',
  'ngs_pass_rushers',
  'air_yards',
  'time_to_throw',
  'charted_route',
  // 'man_zone',
  // 'coverage_type_ngs',

  'drive_sequence',
  'drive_yards',
  'drive_play_count',
  'drive_result',
  'drive_top',
  'drive_first_downs',
  'is_drive_inside_20',
  'is_drive_score',
  'drive_start_quarter',
  'drive_end_quarter',
  'drive_yards_penalized',
  'drive_start_transition',
  'drive_end_transition',
  'drive_game_clock_start',
  'drive_game_clock_end',
  'drive_start_yard_line',
  'drive_end_yard_line',
  'drive_start_play_id',
  'drive_end_play_id',

  'series_sequence',
  'is_series_successful',
  'series_result',

  'is_goal_to_go',

  'is_scoring_play',
  'score_type',
  'score_team',

  'play_clock',

  'game_clock_start',
  'game_clock_end',
  'seconds_remaining_quarter',
  'seconds_remaining_half',
  'seconds_remaining_game',

  'possession_nfl_team',
  'possession_nfl_team_id',

  'offense_nfl_team',
  'defense_nfl_team',

  'review',

  'play_type',
  'play_type_nfl',
  'play_type_ngs',

  'next_play_type',

  'fumble_lost_pid',
  'fumble_lost_gsis_player_id',
  'ball_carrier_pid',
  'ball_carrier_gsis_player_id',
  'passer_pid',
  'passer_gsis_player_id',
  'target_pid',
  'target_gsis_player_id',
  'interceptor_pid',
  'interceptor_gsis_player_id',

  'yards_gained',

  'is_fumble',
  'is_fumble_lost',
  'is_interception',
  'is_sack',
  'is_successful_play',
  'is_completion',
  'is_incompletion',
  'is_trick_play',
  'is_touchback',
  'is_safety',
  'is_penalty',
  'lateral',
  // 'oob',
  'is_tackle_for_loss',
  'is_rushing_play',
  'is_passing_play',
  'is_solo_tackle',
  'is_assist_tackle',

  'is_special_teams_play',
  'special_play_type',

  'penalty_team',
  'penalty_yards',

  'is_touchdown',
  'is_return_touchdown',
  'is_passing_touchdown',
  'is_rushing_touchdown',
  'touchdown_nfl_team',

  'pass_yards',
  'receiving_yards',
  'rush_yards',

  'depth_of_target',
  // 'true_air_yards',
  'yards_after_catch',
  'yards_after_any_contact',
  'return_yards',
  'return_nfl_team',

  'is_no_huddle',
  'is_play_action',
  'is_qb_dropback',
  'is_qb_kneel',
  'is_qb_spike',
  'is_qb_rush',
  'is_qb_sneak',
  'is_qb_scramble',

  'is_qb_pressure',
  'is_qb_pressure_tracking',
  'is_qb_hit',
  'is_qb_hurry',

  'is_interception_worthy',
  'is_catchable_ball',
  'is_throw_away',
  // 'shovel_pass',
  // 'sideline_pass',
  // 'highlight_pass',

  'is_dropped_pass',
  'is_contested_ball',
  'is_created_reception',

  'missed_or_broken_tackle',
  'avoided_sacks',

  'run_location',
  'run_gap',

  // 'trick_look',

  'is_first_down',
  'is_first_down_rush',
  'is_first_down_pass',
  'is_first_down_penalty',

  'is_third_down_converted',
  'is_third_down_failed',
  'is_fourth_down_converted',
  'is_fourth_down_failed',

  // 'hindered_pass',
  // 'zero_blitz',
  // 'stunt',
  'is_out_of_pocket_pass',
  // 'phyb',
  // 'batted_pass',
  // 'scre',
  // 'pain_free_play',
  'is_qb_fault_sack',

  // 'ttscrm',
  // 'time_to_pass',
  // 'ttsk',
  // 'time_to_pressure',

  'backfield_player_count',
  'extra_men_on_line',
  'defensive_back_count',
  'box_defenders_charted',
  'defensive_backs_in_box',
  'pass_rushers',
  'blitzers',
  'defensive_back_blitzers',
  // 'oopd',
  // 'cov_charted',

  'expected_points',
  'epa',
  'is_epa_successful',

  'total_home_epa',
  'total_away_epa',
  'total_home_rush_epa',
  'total_away_rush_epa',
  'total_home_pass_epa',
  'total_away_pass_epa',

  'quarterback_epa',
  'air_epa',
  'yac_epa',
  'completion_air_epa',
  'completion_yac_epa',
  'xyac_epa',
  'total_home_completion_air_epa',
  'total_away_completion_air_epa',
  'total_home_completion_yac_epa',
  'total_away_completion_yac_epa',
  'total_home_raw_air_epa',
  'total_away_raw_air_epa',
  'total_home_raw_yac_epa',
  'total_away_raw_yac_epa',

  'win_probability',
  'win_probability_added',
  'home_win_probability',
  'away_win_probability',
  'vegas_wpa',
  'vegas_home_wpa',
  'home_win_probability_post',
  'away_win_probability_post',
  'vegas_win_probability',
  'vegas_home_win_probability',
  'total_home_rush_wpa',
  'total_away_rush_wpa',
  'total_home_pass_wpa',
  'total_away_pass_wpa',
  'air_wpa',
  'yac_wpa',
  'completion_air_wpa',
  'completion_yac_wpa',
  'total_home_completion_air_wpa',
  'total_away_completion_air_wpa',
  'total_home_completion_yac_wpa',
  'total_away_completion_yac_wpa',
  'total_home_raw_air_wpa',
  'total_away_raw_air_wpa',
  'total_home_raw_yac_wpa',
  'total_away_raw_yac_wpa',

  'xyac_mean_yards',
  'xyac_median_yards',
  'xyac_success_probability',
  'xyac_first_down_probability',

  'is_extra_point_attempt',
  'is_two_point_conversion_attempt',
  'is_field_goal_attempt',
  'is_kickoff_attempt',
  'is_punt_attempt',

  'field_goal_result',
  'kick_distance',
  'extra_point_result',
  'two_point_result',
  'is_punt_blocked',

  'home_timeouts_remaining',
  'away_timeouts_remaining',
  'possession_timeouts_remaining',
  'defense_timeouts_remaining',
  'is_timeout',
  'timeout_team',

  'home_score',
  'away_score',
  'possession_score',
  'defense_score',
  'score_difference',
  'possession_score_post',
  'defense_score_post',
  'score_difference_post',

  'no_score_probability',
  'opponent_field_goal_probability',
  'opponent_safety_probability',
  'opponent_touchdown_probability',
  'field_goal_probability',
  'safety_probability',
  'touchdown_probability',
  'extra_point_probability',
  'two_conversion_probability',

  'expected_pass_probability',
  'pass_over_expected',

  'completion_probability',
  'completion_percentage_over_expected'
]

const export_data_nfl_plays = async ({
  season_year = current_season.year,
  season_type = 'REG',
  collector = null
} = {}) => {
  log(`exporting plays for ${season_year} ${season_type}`)
  const plays_table = `nfl_plays_year_${season_year}`

  // Get esbids for the target season_year/season_type first (small query)
  const games = await db('nfl_games')
    .select('esbid')
    .where({ season_year, season_type })
    .orderBy('esbid', 'asc')
  const esbids = games.map((g) => g.esbid)
  log(`found ${esbids.length} games for ${season_year} ${season_type}`)

  // Query plays in batches by game to avoid statement timeout
  const data = []
  for (const esbid of esbids) {
    const plays = await db(plays_table)
      .select('*')
      .where({ esbid })
      .orderBy('play_id', 'asc')
    data.push(...plays)
  }
  log(`loaded ${data.length} plays`)

  const header = {}

  for (const field of nfl_play_fields) {
    header[field] = field
  }

  // Convert Buffer fields to integers if they represent BIT(1)
  data.forEach((play) => {
    Object.keys(play).forEach((key) => {
      if (Buffer.isBuffer(play[key]) && play[key].length === 1) {
        play[key] = play[key][0]
      }
    })
  })

  const csv_data = [header, ...data]
  const csv_data_string = JSON.stringify(csv_data)
  const csv = convert_to_csv(csv_data_string)

  await fs.mkdir(`${data_path}/nfl/plays/${season_year}`, { recursive: true })

  // const json_file_path = `${data_path}/${season_year}.json`
  const csv_file_path = `${data_path}/nfl/plays/${season_year}/${season_type}.csv`

  // await fs.writeFile(json_file_path, JSON.stringify(data, null, 2))
  // log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    const argv_year = process.argv.find(
      (_, i, arr) => i > 0 && arr[i - 1] === '--year'
    )
    const target_season_year = argv_year ? parseInt(argv_year) : null

    const columns = await db('nfl_plays').columnInfo()
    const column_keys = Object.keys(columns)

    const missing_columns = column_keys.filter(
      (key) => !nfl_play_fields.includes(key)
    )
    log(
      `Missing columns not included in nfl_play_fields: ${missing_columns.join(', ')}`
    )

    let season_years
    if (target_season_year) {
      season_years = [target_season_year]
    } else {
      const season_years_query_results = await db('nfl_plays')
        .select('season_year')
        .groupBy('season_year')
        .orderBy('season_year', 'asc')
      season_years = season_years_query_results.map((r) => r.season_year)
    }

    const season_types = ['PRE', 'REG', 'POST']

    for (const season_year of season_years) {
      for (const season_type of season_types) {
        await export_data_nfl_plays({ season_year, season_type })
      }
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default export_data_nfl_plays
