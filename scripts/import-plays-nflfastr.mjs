// import zlib from 'zlib'
import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { isMain, readCSV, getPlay, update_play } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nflfastr-plays')
debug.enable('import-nflfastr-plays,update-play')

/* const unzip = (source, destination) =>
 *   new Promise((resolve, reject) => {
 *     // prepare streams
 *     const src = fs.createReadStream(source)
 *     const dest = fs.createWriteStream(destination)
 *
 *     // extract the archive
 *     src.pipe(zlib.createGunzip()).pipe(dest)
 *
 *     // callback on extract completion
 *     dest.on('close', resolve)
 *   })
 *  */

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

const format_play = (play) => ({
  ydl_100: format_number(play.yardline_100),

  drive_seq: format_number(play.fixed_drive),
  drive_result: play.fixed_drive_result || null,
  drive_top: play.drive_time_of_possession || null,
  drive_fds: format_number(play.drive_first_downs) || null,
  drive_inside20: format_number(play.drive_inside20),
  drive_score: format_number(play.drive_ended_with_score),
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
  drive_end_play_id: format_number(play.drive_play_id_ended),

  series_seq: format_number(play.series),
  series_suc: format_number(play.series_success),
  series_result: play.series_result || null,

  game_clock_end: play.end_clock_time || null,
  sec_rem_qtr: format_number(play.quarter_seconds_remaining),
  sec_rem_half: format_number(play.half_seconds_remaining),
  sec_rem_gm: format_number(play.game_seconds_remaining),

  fum: format_number(play.fumble),
  incomp: format_number(play.incomplete_pass),
  touchback: format_number(play.touchback),
  safety: format_number(play.safety),
  special: format_number(play.special),
  oob: format_number(play.out_of_bounds),
  tfl: format_number(play.tackled_for_loss),
  rush: format_number(play.rush_attempt),
  pass: format_number(play.pass_attempt),
  solo_tk: format_number(play.solo_tackle),
  assist_tk: format_number(play.assist_tackle),
  pen_team: play.penalty_team ? fixTeam(play.penalty_team) : null,
  pen_yds: format_number(play.penalty_yards),

  pass_td: format_number(play.pass_touchdown),
  rush_td: format_number(play.rush_touchdown),

  pass_yds: format_number(play.passing_yards),
  recv_yds: format_number(play.receiving_yards),
  rush_yds: format_number(play.rushing_yards),

  qbd: format_number(play.qb_dropback),
  qbk: format_number(play.qb_kneel),
  qbs: format_number(play.qb_spike),

  run_location: play.run_location || null,
  run_gap: play.run_gap || null,

  fd_rush: format_number(play.first_down_rush),
  fd_pass: format_number(play.first_down_pass),
  fd_penalty: format_number(play.first_down_penalty),

  third_down_converted: format_number(play.third_down_converted),
  third_down_failed: format_number(play.third_down_failed),
  fourth_down_converted: format_number(play.fourth_down_converted),
  fourth_down_failed: format_number(play.fourth_down_failed),

  ep: format_number(play.ep),
  epa: format_number(play.epa),
  ep_succ: format_number(play.success),

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
  total_away_raw_yac_epa: format_number(play.total_away_raw_yac_epa),

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
  total_away_raw_yac_wpa: format_number(play.total_away_raw_yac_wpa),

  xyac_mean_yds: format_number(play.xyac_mean_yardage),
  xyac_median_yds: format_number(play.xyac_median_yardage),
  xyac_succ_prob: format_number(play.xyac_success),
  xyac_fd_prob: format_number(play.xyac_fd),

  ep_att: format_number(play.extra_point_attempt),
  two_att: format_number(play.two_point_attempt),
  fg_att: format_number(play.field_goal_attempt),
  kickoff_att: format_number(play.kickoff_attempt),
  punt_att: format_number(play.punt_attempt),

  fg_result: play.field_goal_result || null,
  kick_distance: format_number(play.kick_distance),
  ep_result: play.extra_point_result || null,
  tp_result: play.two_point_conv_result || null,
  punt_blocked: format_number(play.punt_blocked),

  home_to_rem: format_number(play.home_timeouts_remaining),
  away_to_rem: format_number(play.away_timeouts_remaining),
  pos_to_rem: format_number(play.posteam_timeouts_remaining),
  def_to_rem: format_number(play.defteam_timeouts_remaining),
  to: format_number(play.timeout),
  to_team: play.timeout_team ? fixTeam(play.timeout_team) : null,

  home_score: format_number(play.total_home_score),
  away_score: format_number(play.total_away_score),
  pos_score: format_number(play.posteam_score),
  def_score: format_number(play.defteam_score),
  score_diff: format_number(play.score_differential),
  pos_score_post: format_number(play.posteam_score_post),
  def_score_post: format_number(play.defteam_score_post),
  score_diff_post: format_number(play.score_differential_post),

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

const run = async ({
  year = constants.season.year,
  force_import = false,
  force_download = false
} = {}) => {
  if (year === constants.season.year && !constants.season.week) {
    throw new Error('Season has not started yet')
  }

  const filename = `play_by_play_${year}.csv`
  const path = `${os.tmpdir()}/${filename}`
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/${filename}`

  if (force_download || !fs.existsSync(path)) {
    // download file

    log(`downloading ${url}`)
    const streamPipeline = promisify(pipeline)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)

    await streamPipeline(response.body, fs.createWriteStream(`${path}`))
    // log(`unarchiving to ${path}`)
    // await unzip(`${path}.gz`, path)
  } else {
    log(`file exists: ${path}`)
  }

  // load
  const playNotMatched = []
  const data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  for (const item of data) {
    const opts = {
      esbid: parseInt(item.old_game_id, 10),
      playId: parseInt(item.play_id, 10)
    }
    const dbPlay = await getPlay(opts)

    if (dbPlay) {
      const play = format_play(item)

      // temp ignore discrepanies in current year data
      if (year >= 2023) {
        delete play.game_clock_end
      }

      await update_play({
        play_row: dbPlay,
        update: play,
        ignore_conflicts: force_import
      })
    } else {
      log(`${item.game_id} - ${item.play_id} - ${item.desc}`)
      log(opts)
      playNotMatched.push(item)
    }
  }

  log(`${playNotMatched.length} plays not matched`)
}

const main = async () => {
  let error
  try {
    const year = argv.year || constants.season.year
    const force_import = argv.force
    const force_download = argv.d
    await run({ year, force_import, force_download })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.IMPORT_PLAYS_NFLFASTR,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
