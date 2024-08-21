import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration.js'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { getYardlineInfoFromString } from '#libs-shared'
import { isMain, readCSV, getPlay, format_starting_hash } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
dayjs.extend(duration)

const log = debug('import-charted-plays-from-csv')

const formatGame = (game) => ({
  ...game,
  year: parseInt(game.seas, 10),
  week: parseInt(game.wk, 10)
})

const formatPlay = (play) => ({
  dropped_pass: Boolean(parseInt(play.drp, 10)),
  qb_pressure: Boolean(parseInt(play.qb_pressure, 10)),
  qb_hit: Boolean(parseInt(play.qb_hit, 10)),
  int_worthy: Boolean(parseInt(play.int_worthy, 10)),
  succ: Boolean(parseInt(play.succ, 10)),
  mbt: parseInt(play.mbt, 10) || null,
  yards_after_any_contact: parseInt(play.yaco, 10) || null,
  no_huddle: Boolean(parseInt(play.nh, 10)),
  starting_hash: format_starting_hash(play.hash),

  // TODO - unexpected values
  // mot: play.mot || null,

  true_air_yards: parseInt(play.tay, 10) || null,
  created_reception: Boolean(parseInt(play.crr, 10)),
  avsk: Boolean(parseInt(play.avsk, 10)),
  play_action: Boolean(parseInt(play.pap, 10)),

  // TODO - unexpected value: PASS
  // option: play.option || null,

  trick_look: Boolean(parseInt(play.tlook, 10)),
  trick_play: Boolean(parseInt(play.trick, 10)),
  qb_rush: Boolean(parseInt(play.qbru, 10)),
  qb_sneak: Boolean(parseInt(play.sneak, 10)),
  qb_scramble: Boolean(parseInt(play.scrm, 10)),
  hindered_pass: Boolean(parseInt(play.htm, 10)),
  zero_blitz: Boolean(parseInt(play.zblz, 10)),
  stunt: Boolean(parseInt(play.stnt, 10)),
  out_of_pocket_pass: Boolean(parseInt(play.oop, 10)),
  phyb: Boolean(parseInt(play.phyb, 10)),
  contested_ball: Boolean(parseInt(play.cnb, 10)),
  catchable_ball: Boolean(parseInt(play.cball, 10)),
  throw_away: Boolean(parseInt(play.qbta, 10)),
  shovel_pass: Boolean(parseInt(play.shov, 10)),
  sideline_pass: Boolean(parseInt(play.side, 10)),
  highlight_pass: Boolean(parseInt(play.high, 10)),
  batted_pass: Boolean(parseInt(play.bap, 10)),
  screen_pass: Boolean(parseInt(play.scre, 10)),
  pain_free_play: Boolean(parseInt(play.pfp, 10)),
  qb_fault_sack: Boolean(parseInt(play.qbsk, 10)),

  ttscrm: parseFloat(play.ttscrm) || null,
  time_to_pass: parseFloat(play.ttp) || null,
  ttsk: parseFloat(play.ttsk) || null,
  time_to_pressure: parseFloat(play.ttpr) || null,

  back: parseInt(play.back, 10) || null,
  xlm: parseInt(play.xlm, 10) || null,
  db: parseInt(play.db, 10) || null,
  box: parseInt(play.box, 10) || null,
  boxdb: parseInt(play.boxdb, 10) || null,
  pass_rushers: parseInt(play.pru, 10) || null,
  blitzers: parseInt(play.blz, 10) || null,
  db_blitzers: parseInt(play.dblz, 10) || null,
  oopd: play.oopd || null,
  cov: play.cov || null,
  cov_type_charted: play.cov_type || null,
  sep: play.sep || null
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
      year: game.year,
      off: cPlay.off,
      def: cPlay.def,
      qtr: cPlay.qtr,
      game_clock_start,
      dwn: cPlay.dwn,
      ...getYardlineInfoFromString(cPlay.los)
    }
    const dbPlay = await getPlay(opts)

    if (dbPlay && !dry) {
      await db('nfl_plays').update(formatPlay(cPlay)).where({
        esbid: dbPlay.esbid,
        playId: dbPlay.playId
      })
    } else {
      log(`${cPlay.pid} - ${cPlay.detail}`)
      log(opts)
      playNotMatched.push(cPlay)
    }
  }

  log(`${playNotMatched.length} plays not matched`)
}

const main = async () => {
  debug.enable('import-charted-plays-from-csv')
  let error
  try {
    await run({ dry: argv.dry, filepath: argv.path })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
