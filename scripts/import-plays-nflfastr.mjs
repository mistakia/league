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
import { isMain, readCSV, getPlay } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nflfastr-plays')
debug.enable('import-nflfastr-plays')

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

const formatPlay = (play) => ({
  ydl_100: parseInt(play.yardline_100, 10) || null,

  drive_seq: parseInt(play.fixed_drive, 10) || null,
  drive_result: play.fixed_drive_result,
  drive_top: play.drive_time_of_possession,
  drive_fds: parseInt(play.drive_first_downs, 10) || null,
  drive_inside20: Boolean(play.drive_inside20),
  drive_score: Boolean(play.drive_ended_with_score),
  drive_start_qtr: parseInt(play.drive_quarter_start, 10) || null,
  drive_end_qtr: parseInt(play.drive_quarter_end, 10) || null,
  drive_yds_penalized: parseInt(play.drive_yards_penalized, 10) || null,
  drive_start_transition: play.drive_start_transition,
  drive_end_transition: play.drive_end_transition,
  drive_game_clock_start: play.drive_game_clock_start,
  drive_game_clock_end: play.drive_game_clock_end,
  drive_start_ydl: play.drive_start_yard_line,
  drive_end_ydl: play.drive_end_yard_line,
  drive_start_play_id: play.drive_play_id_started || null,
  drive_end_play_id: play.drive_play_id_ended || null,

  series_seq: parseInt(play.series, 10) || null,
  series_suc: Boolean(play.series_success),
  series_result: play.series_result,

  game_clock_end: play.end_clock_time,
  sec_rem_qtr: parseInt(play.quarter_seconds_remaining, 10) || null,
  sec_rem_half: parseInt(play.half_seconds_remaining, 10) || null,
  sec_rem_gm: parseInt(play.game_seconds_remaining, 10) || null,

  fum: Boolean(play.fumble),
  incomp: Boolean(play.incomplete_pass),
  touchback: Boolean(play.touchback),
  safety: Boolean(play.safety),
  special: Boolean(play.special),
  oob: Boolean(play.out_of_bounds),
  tfl: Boolean(play.tackled_for_loss),
  rush: Boolean(play.rush_attempt),
  pass: Boolean(play.pass_attempt),
  solo_tk: Boolean(play.solo_tackle),
  assist_tk: Boolean(play.assist_tackle),

  pen_team: play.penalty_team ? fixTeam(play.penalty_team) : null,
  pen_yds: parseInt(play.penalty_yards, 10) || null,

  pass_td: play.pass_touchdown ? play.pass_touchdown === '1' : null,
  rush_td: play.rush_touchdown ? play.rush_touchdown === '1' : null,

  pass_yds: parseInt(play.passing_yards, 10) || null,
  recv_yds: parseInt(play.receiving_yards, 10) || null,
  rush_yds: parseInt(play.rushing_yards, 10) || null,

  qbd: Boolean(play.qb_dropback),
  qbk: Boolean(play.qb_kneel),
  qbs: Boolean(play.qb_spike),

  run_location: play.run_location,
  run_gap: play.run_gap,

  fd_rush: Boolean(play.first_down_rush),
  fd_pass: Boolean(play.first_down_pass),
  fd_penalty: Boolean(play.first_down_penalty),

  third_down_converted: Boolean(play.third_down_converted),
  third_down_failed: Boolean(play.third_down_failed),
  fourth_down_converted: Boolean(play.fourth_down_converted),
  fourth_down_failed: Boolean(play.fourth_down_failed),

  ep: parseFloat(play.ep) || null,
  epa: parseFloat(play.epa) || null,
  ep_succ: Boolean(play.success) || null,

  total_home_epa: parseFloat(play.total_home_epa) || null,
  total_away_epa: parseFloat(play.total_away_epa) || null,
  total_home_rush_epa: parseFloat(play.total_home_rush_epa) || null,
  total_away_rush_epa: parseFloat(play.total_away_rush_epa) || null,
  total_home_pass_epa: parseFloat(play.total_home_pass_epa) || null,
  total_away_pass_epa: parseFloat(play.total_away_pass_epa) || null,

  qb_epa: parseFloat(play.qb_epa) || null,
  air_epa: parseFloat(play.air_epa) || null,
  yac_epa: parseFloat(play.yac_epa) || null,
  comp_air_epa: parseFloat(play.comp_air_epa) || null,
  comp_yac_epa: parseFloat(play.comp_yac_epa) || null,
  xyac_epa: parseFloat(play.xyac_epa) || null,

  total_home_comp_air_epa: parseFloat(play.total_home_comp_air_epa) || null,
  total_away_comp_air_epa: parseFloat(play.total_away_comp_air_epa) || null,
  total_home_comp_yac_epa: parseFloat(play.total_home_comp_yac_epa) || null,
  total_away_comp_yac_epa: parseFloat(play.total_away_comp_yac_epa) || null,
  total_home_raw_air_epa: parseFloat(play.total_home_raw_air_epa) || null,
  total_away_raw_air_epa: parseFloat(play.total_away_raw_air_epa) || null,
  total_home_raw_yac_epa: parseFloat(play.total_home_raw_yac_epa) || null,
  total_away_raw_yac_epa: parseFloat(play.total_away_raw_yac_epa) || null,

  wp: parseFloat(play.wp) || null,
  wpa: parseFloat(play.wpa) || null,
  home_wp: parseFloat(play.home_wp) || null,
  away_wp: parseFloat(play.away_wp) || null,
  vegas_wpa: parseFloat(play.vegas_wpa) || null,
  vegas_home_wpa: parseFloat(play.vegas_home_wpa) || null,
  home_wp_post: parseFloat(play.home_wp_post) || null,
  away_wp_post: parseFloat(play.away_wp_post) || null,
  vegas_wp: parseFloat(play.vegas_wp) || null,
  vegas_home_wp: parseFloat(play.vegas_home_wp) || null,
  total_home_rush_wpa: parseFloat(play.total_home_rush_wpa) || null,
  total_away_rush_wpa: parseFloat(play.total_away_rush_wpa) || null,
  total_home_pass_wpa: parseFloat(play.total_home_pass_wpa) || null,
  total_away_pass_wpa: parseFloat(play.total_away_pass_wpa) || null,
  air_wpa: parseFloat(play.air_wpa) || null,
  yac_wpa: parseFloat(play.yac_wpa) || null,
  comp_air_wpa: parseFloat(play.comp_air_wpa) || null,
  comp_yac_wpa: parseFloat(play.comp_yac_wpa) || null,
  total_home_comp_air_wpa: parseFloat(play.total_home_comp_air_wpa) || null,
  total_away_comp_air_wpa: parseFloat(play.total_away_comp_air_wpa) || null,
  total_home_comp_yac_wpa: parseFloat(play.total_home_comp_yac_wpa) || null,
  total_away_comp_yac_wpa: parseFloat(play.total_away_comp_yac_wpa) || null,
  total_home_raw_air_wpa: parseFloat(play.total_home_raw_air_wpa) || null,
  total_away_raw_air_wpa: parseFloat(play.total_away_raw_air_wpa) || null,
  total_home_raw_yac_wpa: parseFloat(play.total_home_raw_yac_wpa) || null,
  total_away_raw_yac_wpa: parseFloat(play.total_away_raw_yac_wpa) || null,

  xyac_mean_yds: parseFloat(play.xyac_mean_yardage) || null,
  xyac_median_yds: parseFloat(play.xyac_median_yardage) || null,
  xyac_succ_prob: parseFloat(play.xyac_success) || null,
  xyac_fd_prob: parseFloat(play.xyac_fd) || null,

  ep_att: Boolean(play.extra_point_attempt),
  two_att: Boolean(play.two_point_attempt),
  fg_att: Boolean(play.field_goal_attempt),
  kickoff_att: Boolean(play.kickoff_attempt),
  punt_att: Boolean(play.punt_attempt),

  fg_result: play.field_goal_result,
  kick_distance: parseInt(play.kick_distance, 10) || null,
  ep_result: play.extra_point_result,
  tp_result: play.two_point_conv_result,
  punt_blocked: Boolean(play.punt_blocked),

  home_to_rem: parseInt(play.home_timeouts_remaining, 10) || null,
  away_to_rem: parseInt(play.away_timeouts_remaining, 10) || null,
  pos_to_rem: parseInt(play.posteam_timeouts_remaining, 10) || null,
  def_to_rem: parseInt(play.defteam_timeouts_remaining, 10) || null,
  to: Boolean(play.timeout),
  to_team: play.timeout_team ? fixTeam(play.timeout_team) : null,

  home_score: parseInt(play.total_home_score, 10) || null,
  away_score: parseInt(play.total_away_score, 10) || null,
  pos_score: parseInt(play.posteam_score, 10) || null,
  def_score: parseInt(play.defteam_score, 10) || null,
  score_diff: parseInt(play.score_differential, 10) || null,
  pos_score_post: parseInt(play.posteam_score_post, 10) || null,
  def_score_post: parseInt(play.defteam_score_post, 10) || null,
  score_diff_post: parseInt(play.score_differential_post, 10) || null,

  no_score_prob: parseFloat(play.no_score_prob) || null,
  opp_fg_prob: parseFloat(play.opp_fg_prob) || null,
  opp_safety_prob: parseFloat(play.opp_safety_prob) || null,
  opp_td_prob: parseFloat(play.opp_td_prob) || null,
  fg_prob: parseFloat(play.fg_prob) || null,
  safety_prob: parseFloat(play.safety_prob) || null,
  td_prob: parseFloat(play.td_prob) || null,
  extra_point_prob: parseFloat(play.extra_point_prob) || null,
  two_conv_prob: parseFloat(play.two_conv_prob) || null,

  xpass_prob: parseFloat(play.xpass) || null,
  pass_oe: parseFloat(play.pass_oe) || null,

  cp: parseFloat(play.cp) || null,
  cpoe: parseFloat(play.cpoe) || null
})

const run = async () => {
  const year = constants.season.year
  const filename = `play_by_play_${year}.csv`
  const path = `${os.tmpdir()}/${filename}`
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/${filename}`

  if (argv.d || !fs.existsSync(path)) {
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
      const play = formatPlay(item)
      // log(`${dbPlay.esbid} ${dbPlay.playId}`)
      await db('nfl_plays').update(play).where({
        esbid: dbPlay.esbid,
        playId: dbPlay.playId
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
    if (constants.season.week) {
      await run()
    }
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
