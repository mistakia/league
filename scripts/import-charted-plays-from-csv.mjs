import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { getYardlineInfoFromString } from '#libs-shared'
import { is_main, readCSV, getPlay, format_starting_hash } from '#libs-server'
import { MultiplePlayMatchError } from '#libs-server/play-cache.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

dayjs.extend(duration)

const log = debug('import-charted-plays-from-csv')

const formatGame = (game) => ({
  ...game,
  year: parseInt(game.seas, 10),
  week: parseInt(game.wk, 10)
})

const formatPlay = (play) => ({
  is_dropped_pass: Boolean(parseInt(play.drp, 10)),
  is_qb_pressure: Boolean(parseInt(play.qb_pressure, 10)),
  is_qb_hit: Boolean(parseInt(play.qb_hit, 10)),
  is_interception_worthy: Boolean(parseInt(play.int_worthy, 10)),
  missed_or_broken_tackle: parseInt(play.mbt, 10) || null,
  yards_after_any_contact: parseInt(play.yaco, 10) || null,
  is_no_huddle: Boolean(parseInt(play.nh, 10)),
  starting_hash: format_starting_hash(play.hash),

  // TODO - unexpected values
  // mot: play.mot || null,

  true_air_yards: parseInt(play.tay, 10) || null,
  is_created_reception: Boolean(parseInt(play.crr, 10)),
  avoided_sacks: Boolean(parseInt(play.avsk, 10)),
  is_play_action: Boolean(parseInt(play.pap, 10)),

  // TODO - unexpected value: PASS
  // option: play.option || null,

  is_trick_look: Boolean(parseInt(play.tlook, 10)),
  is_trick_play: Boolean(parseInt(play.trick, 10)),
  is_qb_rush: Boolean(parseInt(play.qbru, 10)),
  is_qb_sneak: Boolean(parseInt(play.sneak, 10)),
  is_qb_scramble: Boolean(parseInt(play.scrm, 10)),
  is_hindered_pass: Boolean(parseInt(play.htm, 10)),
  is_zero_blitz: Boolean(parseInt(play.zblz, 10)),
  is_stunt: Boolean(parseInt(play.stnt, 10)),
  is_out_of_pocket_pass: Boolean(parseInt(play.oop, 10)),
  is_physical_ball: Boolean(parseInt(play.phyb, 10)),
  is_contested_ball: Boolean(parseInt(play.cnb, 10)),
  is_catchable_ball: Boolean(parseInt(play.cball, 10)),
  is_throw_away: Boolean(parseInt(play.qbta, 10)),
  is_shovel_pass: Boolean(parseInt(play.shov, 10)),
  is_sideline_pass: Boolean(parseInt(play.side, 10)),
  is_highlight_pass: Boolean(parseInt(play.high, 10)),
  is_batted_pass: Boolean(parseInt(play.bap, 10)),
  is_screen_pass: Boolean(parseInt(play.scre, 10)),
  is_pain_free_play: Boolean(parseInt(play.pfp, 10)),
  is_qb_fault_sack: Boolean(parseInt(play.qbsk, 10)),

  ttscrm: parseFloat(play.ttscrm) || null,
  time_to_pass: parseFloat(play.ttp) || null,
  time_to_sack: parseFloat(play.ttsk) || null,
  time_to_pressure: parseFloat(play.ttpr) || null,

  backfield_player_count: parseInt(play.back, 10) || null,
  extra_men_on_line: parseInt(play.xlm, 10) || null,
  defensive_back_count: parseInt(play.db, 10) || null,
  box_defenders_charted: parseInt(play.box, 10) || null,
  defensive_backs_in_box: parseInt(play.boxdb, 10) || null,
  pass_rushers: parseInt(play.pru, 10) || null,
  blitzers: parseInt(play.blz, 10) || null,
  defensive_back_blitzers: parseInt(play.dblz, 10) || null,
  out_of_pocket_details: play.oopd || null,
  coverage_on_target: play.cov || null,
  coverage_type_charted: play.coverage_type_ngs || null,
  receiver_separation: play.sep || null
})

const run = async ({ dry = false, filepath } = {}) => {
  // read csv file
  if (!filepath) {
    throw new Error('missing --path')
  }

  // const timestamp = Math.round(Date.now() / 1000)
  const gameCSV = await readCSV(`${filepath}/game.csv`)
  const plays = await readCSV(`${filepath}/play.csv`)
  const games = gameCSV.map((game) => formatGame(game))
  const chartedPlays = await readCSV(`${filepath}/chart.csv`)

  log(`read ${games.length} games`)
  log(`read ${chartedPlays.length} charted plays`)
  const playNotMatched = []
  const playAmbiguous = []
  for (const cPlay of chartedPlays) {
    const game = games.find((g) => g.gid === cPlay.gid)
    const play = plays.find((p) => p.pid === cPlay.pid)
    const game_clock_start = dayjs
      .duration({
        minutes: play.min,
        seconds: play.sec
      })
      .format('mm:ss')
    const opts = {
      week: game.week,
      season_year: game.year,
      offense_nfl_team: cPlay.off,
      defense_nfl_team: cPlay.def,
      quarter: cPlay.qtr,
      game_clock_start,
      down_number: cPlay.dwn,
      ...getYardlineInfoFromString(cPlay.los)
    }
    let dbPlay
    try {
      dbPlay = await getPlay(opts)
    } catch (err) {
      if (!(err instanceof MultiplePlayMatchError)) {
        throw err
      }

      // An ambiguous match is an integrity failure, not a miss: the charting
      // cannot be attributed to either play, and treating it as "not matched"
      // is what hid a duplicated game for three years.
      console.log(
        `AMBIGUOUS: ${cPlay.pid} matched ${err.match_count} plays: ${err.matching_plays
          .map((p) => `${p.esbid}/${p.play_id}`)
          .join(', ')}`
      )
      playAmbiguous.push({ charted_play: cPlay, error: err })
      continue
    }

    if (!dbPlay) {
      log(`${cPlay.pid} - ${cPlay.detail}`)
      log(opts)
      playNotMatched.push(cPlay)
      continue
    }

    if (!dry) {
      await db('nfl_plays').update(formatPlay(cPlay)).where({
        esbid: dbPlay.esbid,
        play_id: dbPlay.play_id
      })
    }
  }

  log(`${playNotMatched.length} plays not matched`)

  if (playAmbiguous.length) {
    throw new Error(
      `${playAmbiguous.length} charted plays matched more than one play in nfl_plays; ` +
        'the charting cannot be attributed and was not written. ' +
        'Resolve the duplicate plays before re-running.'
    )
  }
}

const main = async () => {
  const argv = initialize_cli()
  enable_debug_namespaces('import-charted-plays-from-csv')
  let error
  try {
    await run({ dry: argv.dry, filepath: argv.path })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
