// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const argv = require('yargs').argv

const db = require('../db')
const { readCSV, getPlay } = require('../utils')
const { getYardlineInfoFromString } = require('../common')

const log = debug('import-charted-plays-from-csv')

const formatGame = (game) => ({
  ...game,
  seas: parseInt(game.seas, 10),
  wk: parseInt(game.wk, 10)
})

const formatPlay = (play) => ({
  qbp: Boolean(play.qbp),
  qbhi: Boolean(play.qbhi),
  mbt: parseInt(play.mbt, 0),
  yaco: parseInt(play.yaco, 0)
})

const run = async () => {
  // read csv file
  const filepath = argv.path
  if (!filepath) {
    throw new Error('missing --path')
  }

  // const timestamp = Math.round(Date.now() / 1000)
  const gameCSV = await readCSV(`${filepath}/game.csv`)
  const games = gameCSV.map((game) => formatGame(game))
  const plays = await readCSV(`${filepath}/chart.csv`)

  log(`read ${games.length} games`)
  log(`read ${plays.length} plays`)
  const playNotMatched = []
  for (const cPlay of plays) {
    const game = games.find((g) => g.gid === cPlay.gid)
    const play = await getPlay({
      ...game,
      ...cPlay,
      ...getYardlineInfoFromString(cPlay.los)
    })

    if (play) {
      await db('nflPlay').update(formatPlay(cPlay)).where({
        esbid: play.esbid,
        playId: play.playId
      })
    } else {
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
