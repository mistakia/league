import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  readCSV,
  update_play,
  report_job,
  fetch_with_retry,
  preload_plays,
  find_play
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nflfastr-plays')
debug.enable('import-nflfastr-plays,update-play,fetch')

// Constants
const TIME_MATCH_TOLERANCE_SECONDS = 5

// ============================================================================
// Basic Formatters
// ============================================================================

const format_number = (num) => {
  if (num === null || num === undefined || num === '') {
    return null
  }

  const n = Number(num)

  if (Number.isNaN(n)) {
    return null
  }

  if (Number.isInteger(n)) {
    return n
  }

  return Number(n.toFixed(12))
}

const format_boolean = (value) => {
  const num = format_number(value)
  if (num === 1) return true
  if (num === 0) return false
  return null
}

// ============================================================================
// Play Direction & Location Formatters
// ============================================================================

const format_play_direction = (direction) => {
  if (!direction) return null

  const normalized = direction.toUpperCase()

  if (['LEFT', 'MIDDLE', 'RIGHT'].includes(normalized)) {
    return normalized
  }

  return null
}

const format_run_gap = ({ run_direction, run_gap }) => {
  const formatted_run_direction = format_play_direction(run_direction)
  if (!formatted_run_direction) return null

  if (formatted_run_direction === 'MIDDLE') return 'MIDDLE'

  switch (run_gap) {
    case 'end':
      return `${formatted_run_direction}_END`
    case 'guard':
      return `${formatted_run_direction}_GUARD`
    case 'tackle':
      return `${formatted_run_direction}_TACKLE`
    default:
      log(`unknown run gap: ${run_gap} for ${run_direction}`)
      return null
  }
}

// ============================================================================
// Play Type & Result Formatters
// ============================================================================

const format_series_result = (result) => {
  if (!result) return null

  switch (result.toUpperCase()) {
    case 'END OF HALF':
      return 'END_OF_HALF'
    case 'FIELD GOAL':
      return 'FIELD_GOAL'
    case 'FIRST DOWN':
      return 'FIRST_DOWN'
    case 'MISSED FIELD GOAL':
      return 'MISSED_FIELD_GOAL'
    case 'OPP TOUCHDOWN':
      return 'OPP_TOUCHDOWN'
    case 'PUNT':
      return 'PUNT'
    case 'QB KNEEL':
      return 'QB_KNEEL'
    case 'SAFETY':
      return 'SAFETY'
    case 'TOUCHDOWN':
      return 'TOUCHDOWN'
    case 'TURNOVER':
      return 'TURNOVER'
    case 'TURNOVER ON DOWNS':
      return 'TURNOVER_ON_DOWNS'
    default:
      log(`unknown series result: ${result}`)
      return null
  }
}

const format_play_type = (
  play_type,
  special_teams_play,
  extra_point_attempt,
  field_goal_attempt,
  kickoff_attempt,
  punt_attempt
) => {
  if (!play_type) return null

  // Map nflfastR play_type to NFL play_type constants
  switch (play_type.toLowerCase()) {
    case 'pass':
      return 'PASS'
    case 'run':
      return 'RUSH'
    case 'qb_kneel':
      return 'NOPL' // QB kneel is classified as NOPL
    case 'qb_spike':
      return 'NOPL' // QB spike is classified as NOPL
    case 'no_play':
      return 'NOPL'
    case 'kickoff':
      return 'KOFF'
    case 'punt':
      return 'PUNT'
    case 'field_goal':
    case 'extra_point':
      return 'FGXP'
    default:
      // Fallback: use special teams flags
      if (kickoff_attempt) return 'KOFF'
      if (punt_attempt) return 'PUNT'
      if (extra_point_attempt || field_goal_attempt) return 'FGXP'

      log(`unknown play type: ${play_type}`)
      return null
  }
}

// ============================================================================
// Play Formatting - Broken into logical sections
// ============================================================================

const format_play_context = (play) => ({
  qtr: format_number(play.qtr),
  dwn: format_number(play.down),
  yards_to_go: format_number(play.ydstogo),
  off: play.posteam ? fixTeam(play.posteam) : null,
  def: play.defteam ? fixTeam(play.defteam) : null,
  play_type: format_play_type(
    play.play_type,
    format_boolean(play.special_teams_play),
    format_boolean(play.extra_point_attempt),
    format_boolean(play.field_goal_attempt),
    format_boolean(play.kickoff_attempt),
    format_boolean(play.punt_attempt)
  ),
  ydl_100: format_number(play.yardline_100)
})

const format_drive_data = (play) => ({
  // TODO this might not match the drive sequence number in nfl/ngs system
  drive_seq: format_number(play.fixed_drive),
  drive_result: play.fixed_drive_result || null,
  drive_top: play.drive_time_of_possession || null,
  drive_fds: format_number(play.drive_first_downs) || null,
  drive_inside20: format_boolean(play.drive_inside20),
  drive_score: format_boolean(play.drive_ended_with_score),
  drive_start_qtr: format_number(play.drive_quarter_start),
  drive_end_qtr: format_number(play.drive_quarter_end),
  drive_yds_penalized: format_number(play.drive_yards_penalized),
  drive_start_transition: play.drive_start_transition || null,
  drive_end_transition: play.drive_end_transition || null,
  drive_game_clock_start: play.drive_game_clock_start || null,
  drive_game_clock_end: play.drive_game_clock_end || null,
  drive_start_ydl: play.drive_start_yard_line || null,
  drive_end_ydl: play.drive_end_yard_line || null,
  drive_start_play_id: format_number(play.drive_play_id_started),
  drive_end_play_id: format_number(play.drive_play_id_ended)
})

const format_series_data = (play) => ({
  series_seq: format_number(play.series),
  series_suc: format_boolean(play.series_success),
  series_result: format_series_result(play.series_result)
})

const format_game_clock = (play) => ({
  game_clock_end: play.end_clock_time || null,
  sec_rem_qtr: format_number(play.quarter_seconds_remaining),
  sec_rem_half: format_number(play.half_seconds_remaining),
  sec_rem_gm: format_number(play.game_seconds_remaining)
})

const format_play_events = (play) => ({
  fum: format_boolean(play.fumble),
  incomp: format_boolean(play.incomplete_pass),
  touchback: format_boolean(play.touchback),
  safety: format_boolean(play.safety),
  special: format_boolean(play.special),
  oob: format_boolean(play.out_of_bounds),
  tfl: format_boolean(play.tackled_for_loss),
  rush: format_boolean(play.rush_attempt),
  pass: format_boolean(play.pass_attempt),
  solo_tk: format_boolean(play.solo_tackle),
  assist_tk: format_boolean(play.assist_tackle),
  pen_team: play.penalty_team ? fixTeam(play.penalty_team) : null,
  pen_yds: format_number(play.penalty_yards)
})

const format_scoring_yards = (play) => ({
  pass_td: format_boolean(play.pass_touchdown),
  rush_td: format_boolean(play.rush_touchdown),
  pass_yds: format_number(play.passing_yards),
  recv_yds: format_number(play.receiving_yards),
  rush_yds: format_number(play.rushing_yards)
})

const format_qb_play_data = (play) => ({
  qb_dropback: format_boolean(play.qb_dropback),
  qb_kneel: format_boolean(play.qb_kneel),
  qb_spike: format_boolean(play.qb_spike),
  qb_scramble: format_boolean(play.qb_scramble)
})

const format_location_data = (play) => ({
  run_location: format_play_direction(play.run_location),
  run_gap: format_run_gap(play),
  pass_location: format_play_direction(play.pass_location)
})

const format_down_conversions = (play) => ({
  first_down:
    format_boolean(play.first_down_rush) ||
    format_boolean(play.first_down_pass) ||
    format_boolean(play.first_down_penalty),
  first_down_rush: format_boolean(play.first_down_rush),
  first_down_pass: format_boolean(play.first_down_pass),
  first_down_penalty: format_boolean(play.first_down_penalty),
  third_down_converted: format_boolean(play.third_down_converted),
  third_down_failed: format_boolean(play.third_down_failed),
  fourth_down_converted: format_boolean(play.fourth_down_converted),
  fourth_down_failed: format_boolean(play.fourth_down_failed)
})

const format_epa_data = (play) => ({
  ep: format_number(play.ep),
  epa: format_number(play.epa),
  ep_succ: format_boolean(play.success),
  total_home_epa: format_number(play.total_home_epa),
  total_away_epa: format_number(play.total_away_epa),
  total_home_rush_epa: format_number(play.total_home_rush_epa),
  total_away_rush_epa: format_number(play.total_away_rush_epa),
  total_home_pass_epa: format_number(play.total_home_pass_epa),
  total_away_pass_epa: format_number(play.total_away_pass_epa),
  qb_epa: format_number(play.qb_epa),
  air_epa: format_number(play.air_epa),
  yac_epa: format_number(play.yac_epa),
  comp_air_epa: format_number(play.comp_air_epa),
  comp_yac_epa: format_number(play.comp_yac_epa),
  xyac_epa: format_number(play.xyac_epa),
  total_home_comp_air_epa: format_number(play.total_home_comp_air_epa),
  total_away_comp_air_epa: format_number(play.total_away_comp_air_epa),
  total_home_comp_yac_epa: format_number(play.total_home_comp_yac_epa),
  total_away_comp_yac_epa: format_number(play.total_away_comp_yac_epa),
  total_home_raw_air_epa: format_number(play.total_home_raw_air_epa),
  total_away_raw_air_epa: format_number(play.total_away_raw_air_epa),
  total_home_raw_yac_epa: format_number(play.total_home_raw_yac_epa),
  total_away_raw_yac_epa: format_number(play.total_away_raw_yac_epa)
})

const format_wpa_data = (play) => ({
  wp: format_number(play.wp),
  wpa: format_number(play.wpa),
  home_wp: format_number(play.home_wp),
  away_wp: format_number(play.away_wp),
  vegas_wpa: format_number(play.vegas_wpa),
  vegas_home_wpa: format_number(play.vegas_home_wpa),
  home_wp_post: format_number(play.home_wp_post),
  away_wp_post: format_number(play.away_wp_post),
  vegas_wp: format_number(play.vegas_wp),
  vegas_home_wp: format_number(play.vegas_home_wp),
  total_home_rush_wpa: format_number(play.total_home_rush_wpa),
  total_away_rush_wpa: format_number(play.total_away_rush_wpa),
  total_home_pass_wpa: format_number(play.total_home_pass_wpa),
  total_away_pass_wpa: format_number(play.total_away_pass_wpa),
  air_wpa: format_number(play.air_wpa),
  yac_wpa: format_number(play.yac_wpa),
  comp_air_wpa: format_number(play.comp_air_wpa),
  comp_yac_wpa: format_number(play.comp_yac_wpa),
  total_home_comp_air_wpa: format_number(play.total_home_comp_air_wpa),
  total_away_comp_air_wpa: format_number(play.total_away_comp_air_wpa),
  total_home_comp_yac_wpa: format_number(play.total_home_comp_yac_wpa),
  total_away_comp_yac_wpa: format_number(play.total_away_comp_yac_wpa),
  total_home_raw_air_wpa: format_number(play.total_home_raw_air_wpa),
  total_away_raw_air_wpa: format_number(play.total_away_raw_air_wpa),
  total_home_raw_yac_wpa: format_number(play.total_home_raw_yac_wpa),
  total_away_raw_yac_wpa: format_number(play.total_away_raw_yac_wpa)
})

const format_xyac_data = (play) => ({
  xyac_mean_yds: format_number(play.xyac_mean_yardage),
  xyac_median_yds: format_number(play.xyac_median_yardage),
  xyac_succ_prob: format_number(play.xyac_success),
  xyac_fd_prob: format_number(play.xyac_fd)
})

const format_special_teams = (play) => ({
  ep_att: format_boolean(play.extra_point_attempt),
  two_att: format_boolean(play.two_point_attempt),
  fg_att: format_boolean(play.field_goal_attempt),
  kickoff_att: format_boolean(play.kickoff_attempt),
  punt_att: format_boolean(play.punt_attempt),
  fg_result: play.field_goal_result || null,
  kick_distance: format_number(play.kick_distance),
  ep_result: play.extra_point_result || null,
  tp_result: play.two_point_conv_result || null,
  punt_blocked: format_boolean(play.punt_blocked)
})

const format_timeout_data = (play) => ({
  home_to_rem: format_number(play.home_timeouts_remaining),
  away_to_rem: format_number(play.away_timeouts_remaining),
  pos_to_rem: format_number(play.posteam_timeouts_remaining),
  def_to_rem: format_number(play.defteam_timeouts_remaining),
  to: format_boolean(play.timeout),
  to_team: play.timeout_team ? fixTeam(play.timeout_team) : null
})

const format_score_data = (play) => ({
  home_score: format_number(play.total_home_score),
  away_score: format_number(play.total_away_score),
  pos_score: format_number(play.posteam_score),
  def_score: format_number(play.defteam_score),
  score_diff: format_number(play.score_differential),
  pos_score_post: format_number(play.posteam_score_post),
  def_score_post: format_number(play.defteam_score_post),
  score_diff_post: format_number(play.score_differential_post)
})

const format_probability_data = (play) => ({
  no_score_prob: format_number(play.no_score_prob),
  opp_fg_prob: format_number(play.opp_fg_prob),
  opp_safety_prob: format_number(play.opp_safety_prob),
  opp_td_prob: format_number(play.opp_td_prob),
  fg_prob: format_number(play.fg_prob),
  safety_prob: format_number(play.safety_prob),
  td_prob: format_number(play.td_prob),
  extra_point_prob: format_number(play.extra_point_prob),
  two_conv_prob: format_number(play.two_conv_prob),
  xpass_prob: format_number(play.xpass),
  pass_oe: format_number(play.pass_oe),
  cp: format_number(play.cp),
  cpoe: format_number(play.cpoe)
})

const format_play = (play) => ({
  ...format_play_context(play),
  ...format_drive_data(play),
  ...format_series_data(play),
  ...format_game_clock(play),
  ...format_play_events(play),
  ...format_scoring_yards(play),
  ...format_qb_play_data(play),
  ...format_location_data(play),
  ...format_down_conversions(play),
  ...format_epa_data(play),
  ...format_wpa_data(play),
  ...format_xyac_data(play),
  ...format_special_teams(play),
  ...format_timeout_data(play),
  ...format_score_data(play),
  ...format_probability_data(play)
})

// ============================================================================
// Play Matching Logic
// ============================================================================

/**
 * Build match criteria for finding plays in the database
 * Uses contextual matching instead of playId matching since playId is NOT stable
 * across data sources (nflfastR vs NFL v1 vs Sportradar)
 */
const build_match_criteria = (esbid, formatted_play) => {
  const match_criteria = {
    esbid,
    qtr: formatted_play.qtr,
    dwn: formatted_play.dwn,
    yards_to_go: formatted_play.yards_to_go,
    off: formatted_play.off,
    def: formatted_play.def,
    play_type: formatted_play.play_type
  }

  // For non-special teams plays, include ydl_100 in matching
  if (
    formatted_play.play_type !== 'KOFF' &&
    formatted_play.play_type !== 'FGXP'
  ) {
    match_criteria.ydl_100 = formatted_play.ydl_100
  }

  // Use time-based matching for ALL plays to prevent context collisions
  // Time (sec_rem_qtr) is a stable identifier across data sources and prevents mismatches
  // when multiple plays share the same game situation (down, distance, field position)
  // This is critical because:
  // 1. Special teams plays (KOFF, PUNT, FGXP) often share context (null down, null distance)
  // 2. Regular plays (PASS, RUSH) can also share context (e.g., multiple 1st & 10 from same yard line)
  if (
    formatted_play.sec_rem_qtr !== null &&
    formatted_play.sec_rem_qtr !== undefined
  ) {
    match_criteria.sec_rem_qtr = formatted_play.sec_rem_qtr
    match_criteria.sec_rem_qtr_tolerance = TIME_MATCH_TOLERANCE_SECONDS
  }

  return match_criteria
}

/**
 * Check if the data is available for the given year
 */
const is_data_available = (year) => {
  if (
    year === constants.season.year &&
    (!constants.season.week ||
      constants.season.now.isAfter(constants.season.end))
  ) {
    log(`${year} season has not started yet`)
    return false
  }

  if (year === constants.season.year && constants.season.week === 1) {
    const current_day = dayjs().day()
    // Week 1 data not available until Friday (day 5)
    if (current_day < 5 && current_day > 1) {
      log(`${year} week 1 data is not available until Friday`)
      return false
    }
  }

  return true
}

/**
 * Download the play-by-play CSV file from nflverse
 */
const download_file = async ({ year, force_download }) => {
  const filename = `play_by_play_${year}.csv`
  const path = `${os.tmpdir()}/${filename}`
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/${filename}`

  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const stream_pipeline = promisify(pipeline)
    const response = await fetch_with_retry({ url })
    if (!response.ok) {
      throw new Error(`unexpected response ${response.statusText}`)
    }

    await stream_pipeline(response.body, fs.createWriteStream(path))
  } else {
    log(`file exists: ${path}`)
  }

  return path
}

/**
 * Process a single play from the CSV data
 */
const process_play = async ({ item, year, ignore_conflicts }) => {
  const esbid = parseInt(item.old_game_id, 10)
  const formatted_play = format_play(item)
  const match_criteria = build_match_criteria(esbid, formatted_play)

  const db_play = find_play(match_criteria)

  if (db_play) {
    // Temporary workaround: ignore discrepancies in current year data
    if (year >= 2022) {
      delete formatted_play.game_clock_end
    }

    await update_play({
      play_row: db_play,
      update: formatted_play,
      ignore_conflicts
    })

    return { matched: true }
  }

  // Play not matched
  log(`${item.game_id} - ${item.play_id} - ${item.desc}`)
  log(match_criteria)
  return { matched: false, item }
}

// ============================================================================
// Main Import Function
// ============================================================================

const run = async ({
  year = constants.season.year,
  ignore_conflicts = false,
  force_download = false
} = {}) => {
  // Check if data is available for this year
  if (!is_data_available(year)) {
    return
  }

  // Download the CSV file
  const file_path = await download_file({ year, force_download })

  // Load CSV data
  const data = await readCSV(file_path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  // Preload plays into cache for efficient contextual matching
  log(`Preloading plays for year ${year}...`)
  await preload_plays({ years: [year] })
  log(`Plays preloaded`)

  // Process each play
  const plays_not_matched = []
  for (const item of data) {
    const result = await process_play({ item, year, ignore_conflicts })
    if (!result.matched) {
      plays_not_matched.push(result.item)
    }
  }

  log(`${plays_not_matched.length} plays not matched`)
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const main = async () => {
  let error
  try {
    const year = argv.year || constants.season.year
    const ignore_conflicts = argv.ignore_conflicts
    const force_download = argv.d
    const all = argv.all

    if (all) {
      // Import all years from 1999 to current season
      for (
        let import_year = 1999;
        import_year <= constants.season.stats_season_year;
        import_year++
      ) {
        await run({
          year: import_year,
          ignore_conflicts,
          force_download
        })
      }
    } else {
      // Import single year
      await run({
        year,
        ignore_conflicts,
        force_download
      })
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  // Report job completion
  await report_job({
    job_type: job_types.IMPORT_PLAYS_NFLFASTR,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
