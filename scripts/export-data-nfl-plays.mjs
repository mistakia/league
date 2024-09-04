import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, convertToCSV } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-nfl-plays')
debug.enable('export-data-nfl-plays')
const nfl_play_fields = [
  'esbid',
  'playId',
  'sequence',
  'state',

  'dwn',
  'qtr',

  'desc',

  'ydl_num',
  'ydl_side',
  'ydl_start',
  'ydl_end',
  'ydl_100',

  'starting_hash',
  'motion',

  'yards_to_go',

  'off_formation',
  'off_personnel',
  'def_personnel',
  'box_ngs',
  'pru_ngs',
  'air_yds_ngs',
  'time_to_throw_ngs',
  'route_ngs',
  // 'man_zone_ngs',
  // 'cov_type_ngs',

  'drive_seq',
  'drive_yds',
  'drive_play_count',
  'drive_result',
  'drive_top',
  'drive_fds',
  'drive_inside20',
  'drive_score',
  'drive_start_qtr',
  'drive_end_qtr',
  'drive_yds_penalized',
  'drive_start_transition',
  'drive_end_transition',
  'drive_game_clock_start',
  'drive_game_clock_end',
  'drive_start_ydl',
  'drive_end_ydl',
  'drive_start_play_id',
  'drive_end_play_id',

  'series_seq',
  'series_suc',
  'series_result',

  'goal_to_go',

  'score',
  'score_type',
  'score_team',

  'play_clock',

  'game_clock_start',
  'game_clock_end',
  'sec_rem_qtr',
  'sec_rem_half',
  'sec_rem_gm',

  'pos_team',
  'pos_team_id',

  'off',
  'def',

  'review',

  'play_type',
  'play_type_nfl',
  'play_type_ngs',

  'next_play_type',

  'player_fuml_pid',
  'player_fuml_gsis',
  'bc_pid',
  'bc_gsis',
  'psr_pid',
  'psr_gsis',
  'trg_pid',
  'trg_gsis',
  'intp_pid',
  'intp_gsis',

  'yds_gained',

  'fum',
  'fuml',
  'int',
  'sk',
  'succ',
  'comp',
  'incomp',
  'trick_play',
  'touchback',
  'safety',
  'penalty',
  'lateral',
  // 'oob',
  'tfl',
  'rush',
  'pass',
  'solo_tk',
  'assist_tk',

  'special',
  'special_play_type',

  'pen_team',
  'pen_yds',

  'td',
  'ret_td',
  'pass_td',
  'rush_td',
  'td_tm',

  'pass_yds',
  'recv_yds',
  'rush_yds',

  'dot',
  // 'true_air_yards',
  'yards_after_catch',
  'yards_after_any_contact',
  'ret_yds',
  'ret_tm',

  'no_huddle',
  'play_action',
  'qb_dropback',
  'qb_kneel',
  'qb_spike',
  'qb_rush',
  'qb_sneak',
  'qb_scramble',

  'qb_pressure',
  'qb_pressure_ngs',
  'qb_hit',
  'qb_hurry',

  'int_worthy',
  'catchable_ball',
  'throw_away',
  // 'shovel_pass',
  // 'sideline_pass',
  // 'highlight_pass',

  'dropped_pass',
  'contested_ball',
  'created_reception',

  'mbt',
  'avsk',

  'run_location',
  'run_gap',

  // 'trick_look',

  'first_down',
  'first_down_rush',
  'first_down_pass',
  'first_down_penalty',

  'third_down_converted',
  'third_down_failed',
  'fourth_down_converted',
  'fourth_down_failed',

  // 'hindered_pass',
  // 'zero_blitz',
  // 'stunt',
  'out_of_pocket_pass',
  // 'phyb',
  // 'batted_pass',
  // 'scre',
  // 'pain_free_play',
  'qb_fault_sack',

  // 'ttscrm',
  // 'time_to_pass',
  // 'ttsk',
  // 'time_to_pressure',

  'back',
  'xlm',
  'db',
  'box',
  'boxdb',
  'pass_rushers',
  'blitzers',
  'db_blitzers',
  // 'oopd',
  // 'cov_charted',

  'ep',
  'epa',
  'ep_succ',

  'total_home_epa',
  'total_away_epa',
  'total_home_rush_epa',
  'total_away_rush_epa',
  'total_home_pass_epa',
  'total_away_pass_epa',

  'qb_epa',
  'air_epa',
  'yac_epa',
  'comp_air_epa',
  'comp_yac_epa',
  'xyac_epa',
  'total_home_comp_air_epa',
  'total_away_comp_air_epa',
  'total_home_comp_yac_epa',
  'total_away_comp_yac_epa',
  'total_home_raw_air_epa',
  'total_away_raw_air_epa',
  'total_home_raw_yac_epa',
  'total_away_raw_yac_epa',

  'wp',
  'wpa',
  'home_wp',
  'away_wp',
  'vegas_wpa',
  'vegas_home_wpa',
  'home_wp_post',
  'away_wp_post',
  'vegas_wp',
  'vegas_home_wp',
  'total_home_rush_wpa',
  'total_away_rush_wpa',
  'total_home_pass_wpa',
  'total_away_pass_wpa',
  'air_wpa',
  'yac_wpa',
  'comp_air_wpa',
  'comp_yac_wpa',
  'total_home_comp_air_wpa',
  'total_away_comp_air_wpa',
  'total_home_comp_yac_wpa',
  'total_away_comp_yac_wpa',
  'total_home_raw_air_wpa',
  'total_away_raw_air_wpa',
  'total_home_raw_yac_wpa',
  'total_away_raw_yac_wpa',

  'xyac_mean_yds',
  'xyac_median_yds',
  'xyac_succ_prob',
  'xyac_fd_prob',

  'ep_att',
  'two_att',
  'fg_att',
  'kickoff_att',
  'punt_att',

  'fg_result',
  'kick_distance',
  'ep_result',
  'tp_result',
  'punt_blocked',

  'home_to_rem',
  'away_to_rem',
  'pos_to_rem',
  'def_to_rem',
  'to',
  'to_team',

  'home_score',
  'away_score',
  'pos_score',
  'def_score',
  'score_diff',
  'pos_score_post',
  'def_score_post',
  'score_diff_post',

  'no_score_prob',
  'opp_fg_prob',
  'opp_safety_prob',
  'opp_td_prob',
  'fg_prob',
  'safety_prob',
  'td_prob',
  'extra_point_prob',
  'two_conv_prob',

  'xpass_prob',
  'pass_oe',

  'cp',
  'cpoe'
]

const export_data_nfl_plays = async ({
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  log(`exporting plays for ${year}`)
  const data = await db('nfl_plays')
    .select('nfl_plays.*')
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', seas_type)
    .orderBy('nfl_plays.esbid', 'asc')
    .orderBy('nfl_plays.playId', 'asc')

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
  const csv = convertToCSV(csv_data_string)

  await fs.ensureDir(`${data_path}/nfl/plays/${year}`)

  // const json_file_path = `${data_path}/${year}.json`
  const csv_file_path = `${data_path}/nfl/plays/${year}/${seas_type}.csv`

  // await fs.writeJson(json_file_path, data, { spaces: 2 })
  // log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    const columns = await db('nfl_plays').columnInfo()
    const column_keys = Object.keys(columns)

    const missing_columns = column_keys.filter(
      (key) => !nfl_play_fields.includes(key)
    )
    log(
      `Missing columns not included in nfl_play_fields: ${missing_columns.join(', ')}`
    )

    const years_query_results = await db('nfl_plays')
      .select('year')
      .groupBy('year')
      .orderBy('year', 'asc')

    const years = years_query_results.map((r) => r.year)
    const seas_types = ['PRE', 'REG', 'POST']

    for (const year of years) {
      for (const seas_type of seas_types) {
        await export_data_nfl_plays({ year, seas_type })
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
