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
  drp: Boolean(play.drp),
  qbp: Boolean(play.qbp),
  qbhi: Boolean(play.qbhi),
  intw: Boolean(play.intw),
  succ: Boolean(play.succ),
  mbt: parseInt(play.mbt, 10) || null,
  yaco: parseInt(play.yaco, 10) || null,
  sg: Boolean(play.sg),
  nh: Boolean(play.nh),
  hash: play.hash || null,
  mot: play.mot || null,
  tay: parseInt(play.tay, 10) || null,
  crr: Boolean(play.crr),
  avsk: Boolean(play.avsk),
  pap: Boolean(play.pap),
  option: play.option || null,
  tlook: Boolean(play.tlook),
  trick: Boolean(play.trick),
  qbru: Boolean(play.qbru),
  sneak: Boolean(play.sneak),
  scrm: Boolean(play.scrm),
  htm: Boolean(play.htm),
  zblz: Boolean(play.zblz),
  stnt: Boolean(play.stnt),
  oop: Boolean(play.oop),
  phyb: Boolean(play.phyb),
  cnb: Boolean(play.cnb),
  cball: Boolean(play.cball),
  qbta: Boolean(play.qbta),
  shov: Boolean(play.shov),
  side: Boolean(play.side),
  high: Boolean(play.high),
  bap: Boolean(play.bap),
  fread: Boolean(play.fread),
  scre: Boolean(play.scre),
  pfp: Boolean(play.pfp),
  qbsk: Boolean(play.qbsk),

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
  cov: play.cov
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
