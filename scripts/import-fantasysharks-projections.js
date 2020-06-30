const fetch = require('node-fetch')
const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('league:player:get,import:projections')

const { getPlayerId } = require('../utils')
const db = require('../db')

const URL = 'https://www.fantasysharks.com/apps/Projections/SeasonProjections.php?pos=ALL&format=json&l=2'
const year = new Date().getFullYear()
const timestamp = new Date()

const run = async () => {
  const data = await fetch(URL).then(res => res.json())
  const missing = []

  const createEntry = (item) => ({
    // passing
    ints: item.Int,
    tdp: item.PassTD,
    py: item.PassYards,
    pc: item.Comp,

    // rushing
    ra: item.Att,
    ry: item.RushYards,
    tdr: item.RushTD,
    fuml: item.Fum,

    // receiving
    rec: item.Rec,
    recy: item.RecYards,
    tdrec: item.RecTD
  })

  const inserts = []

  for (const item of data) {
    const { Team, Pos, Name } = item
    const n = Name.split(',')
    const fname = n.pop().trim()
    const lname = n.shift().trim()
    const fullname = `${fname} ${lname}`
    let playerId
    const params = { name: fullname, team: Team, pos: Pos }
    try {
      playerId = await getPlayerId(params)
      if (!playerId) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const entry = createEntry(item)
    inserts.push({
      player: playerId,
      year,
      sourceid: 1, // fantasy sharks sourceid
      timestamp,
      ...entry
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    return process.exit()
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections').insert(inserts)

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
