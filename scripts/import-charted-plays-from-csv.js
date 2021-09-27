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
  mbt: parseInt(play.mbt, 0) || null,
  yaco: parseInt(play.yaco, 0) || null
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
    const nflPlay = await getPlay(opts)

    if (nflPlay) {
      await db('nflPlay').update(formatPlay(cPlay)).where({
        esbid: nflPlay.esbid,
        playId: nflPlay.playId
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
