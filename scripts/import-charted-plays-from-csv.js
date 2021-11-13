// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
const argv = require('yargs').argv

const db = require('../db')
const { readCSV, getPlay } = require('../utils')
const { getYardlineInfoFromString } = require('../common')

dayjs.extend(duration)

const log = debug('import-charted-plays-from-csv')

const formatGame = (game) => ({
  ...game,
  seas: parseInt(game.seas, 10),
  wk: parseInt(game.wk, 10)
})

const formatPlay = (play) => ({
  drp: Boolean(parseInt(play.drp, 10)),
  qbp: Boolean(parseInt(play.qbp, 10)),
  qbhi: Boolean(parseInt(play.qbhi, 10)),
  intw: Boolean(parseInt(play.intw, 10)),
  succ: Boolean(parseInt(play.succ, 10)),
  mbt: parseInt(play.mbt, 10) || null,
  yaco: parseInt(play.yaco, 10) || null,
  sg: Boolean(parseInt(play.sg, 10)),
  nh: Boolean(parseInt(play.nh, 10)),
  hash: play.hash || null,

  // TODO - unexpected values
  // mot: play.mot || null,

  tay: parseInt(play.tay, 10) || null,
  crr: Boolean(parseInt(play.crr, 10)),
  avsk: Boolean(parseInt(play.avsk, 10)),
  pap: Boolean(parseInt(play.pap, 10)),

  // TODO - unexpected value: PASS
  // option: play.option || null,

  tlook: Boolean(parseInt(play.tlook, 10)),
  trick: Boolean(parseInt(play.trick, 10)),
  qbru: Boolean(parseInt(play.qbru, 10)),
  sneak: Boolean(parseInt(play.sneak, 10)),
  scrm: Boolean(parseInt(play.scrm, 10)),
  htm: Boolean(parseInt(play.htm, 10)),
  zblz: Boolean(parseInt(play.zblz, 10)),
  stnt: Boolean(parseInt(play.stnt, 10)),
  oop: Boolean(parseInt(play.oop, 10)),
  phyb: Boolean(parseInt(play.phyb, 10)),
  cnb: Boolean(parseInt(play.cnb, 10)),
  cball: Boolean(parseInt(play.cball, 10)),
  qbta: Boolean(parseInt(play.qbta, 10)),
  shov: Boolean(parseInt(play.shov, 10)),
  side: Boolean(parseInt(play.side, 10)),
  high: Boolean(parseInt(play.high, 10)),
  bap: Boolean(parseInt(play.bap, 10)),
  fread: Boolean(parseInt(play.fread, 10)),
  scre: Boolean(parseInt(play.scre, 10)),
  pfp: Boolean(parseInt(play.pfp, 10)),
  qbsk: Boolean(parseInt(play.qbsk, 10)),

  ttscrm: parseFloat(play.ttscrm) || null,
  ttp: parseFloat(play.ttp) || null,
  ttsk: parseFloat(play.ttsk) || null,
  ttpr: parseFloat(play.ttpr) || null,

  back: parseInt(play.back, 10) || null,
  xlm: parseInt(play.xlm, 10) || null,
  db: parseInt(play.db, 10) || null,
  box: parseInt(play.box, 10) || null,
  boxdb: parseInt(play.boxdb, 10) || null,
  pru: parseInt(play.pru, 10) || null,
  blz: parseInt(play.blz, 10) || null,
  dblz: parseInt(play.dblz, 10) || null,
  oopd: play.oopd || null,
  cov: play.cov || null,
  cov_type: play.cov_type || null,
  sep: play.sep || null
})

const run = async () => {
  // read csv file
  const filepath = argv.path
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
    const clockTime = dayjs
      .duration({
        minutes: play.min,
        seconds: play.sec
      })
      .format('mm:ss')
    const opts = {
      wk: game.wk,
      seas: game.seas,
      off: cPlay.off,
      def: cPlay.def,
      qtr: cPlay.qtr,
      clockTime,
      dwn: cPlay.dwn,
      ...getYardlineInfoFromString(cPlay.los)
    }
    const dbPlay = await getPlay(opts)

    if (dbPlay) {
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

module.exports = run

const main = async () => {
  debug.enable('import-charted-plays-from-csv')
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (!module.parent) {
  main()
}
