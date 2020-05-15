const fs = require('fs')
const argv = require('yargs').argv
const debug = require('debug')
const csv = require('csv-parser')

const db = require('../db')
const { getPlayerId } = require('../utils')

const log = debug('script:import-draft-rankings')

const POSITIONS = ['QB', 'RB', 'WR', 'TE']

const getPositionRank = (string) => {
  const pos = POSITIONS.find(pos => string.includes(pos))
  if (!pos) {
    return {
      pos: null,
      rank: null
    }
  }

  const rank = parseInt(string.replace(pos, ''), 10)
  return {
    pos,
    rank
  }
}

const readCSV = (filepath) => new Promise((resolve, reject) => {
  const results = []
  fs.createReadStream(filepath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('error', error => resolve(error))
    .on('end', () => resolve(results))
})

const getPlayer = async (name, pos) => {
  const pname = normalizePlayerName(name)
}

const run = async () => {
  debug.enable('script:import-draft-rankings')
  const filepath = argv.file
  if (!filepath) {
    throw new Error('missing --file')
  }

  const year = argv.year
  if (!year) {
    throw new Error('missing --year')
  }

  const rookie = !!filepath.toLowerCase().includes('rookie')
  const rows = await readCSV(filepath)

  const invalid = []
  const players = []
  for (const row of rows) {
    const name = rookie ? row.Rookies : row.Overall
    if (!name) {
      continue
    }

    const posrank = getPositionRank(row.Pos)
    let playerId
    try {
      playerId = await getPlayerId({ name, pos: rank.pos })
      if (!playerId) {
        log(`[WARN] could not find player for ${name}`)
        invalid.push({ name })
        continue
      }
    } catch (err) {
      console.log(err)
      invalid.push({ name })
      continue
    }

    players.push({
      row,
      posrank,
      playerId: playerId
    })
  }

  console.table(invalid)

  for (const item of players) {
    try{
      const result = await db('draft_rankings').insert({
        player: item.playerId,
        rank: item.row.Rank,
        tier: item.row.Tier,
        posrank: item.posrank.rank,
        best: item.row.Best,
        worst: item.row.Worst,
        avg: item.row.Avg,
        stddev: item.row['Std Dev'],
        rookie: rookie ? 1 : 0,
        seas: year
      })
      log(`imported rankings for ${item.playerId}`)
    } catch (error) {
      // console.log(error)
    }
  }

  log(`completed import`)
}

try {
  run()
} catch (error) {
  console.log(error)
}
