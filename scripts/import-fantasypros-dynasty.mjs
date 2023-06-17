import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer, wait } from '#libs-server'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:rankings:dynasty')
debug.enable('import:rankings:dynasty,get-player')

const timestamp = Math.round(Date.now() / 1000)
const year = argv.year ? argv.year : constants.season.year
const getURL = (opts) =>
  `https://api.fantasypros.com/v2/json/nfl/${year}/consensus-rankings?type=dynasty&scoring=PPR&position=${opts.type}&week=0&experts=available`

const getRanking = (item) => ({
  min: parseInt(item.rank_min, 10),
  max: parseInt(item.rank_max, 10),
  avg: parseFloat(item.rank_ave),
  std: parseFloat(item.rank_std),
  ornk: parseInt(item.rank_ecr, 10),
  prnk: parseInt(item.pos_rank.replace(/\D/g, ''), 10)
})

const runOne = async (opts) => {
  const url = getURL(opts)
  const data = await fetch(url, {
    headers: {
      'x-api-key': config.fantasypros
    }
  }).then((res) => res.json())

  if (!data || !data.players) {
    throw new Error('failed to fetch data')
  }

  const inserts = []
  const missing = []
  for (const item of data.players) {
    const params = {
      name: item.player_name,
      team: item.player_team_id,
      pos: item.player_position_id
    }

    let player_row
    try {
      player_row = await getPlayer(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const ranking = getRanking(item)
    inserts.push({
      pid: player_row.pid,
      pos: params.pos,
      year,
      week: 0,

      adp: 0,
      ppr: constants.scoring.PPR,
      sf: opts.sf,
      dynasty: 1,
      rookie: 0,
      sourceid: constants.sources.FANTASYPROS,
      type: constants.rankings.OP,

      timestamp,
      ...ranking
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(`${inserts.length} rankings`)
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} rankings into database`)
  await db('rankings').insert(inserts)
}

const run = async () => {
  const types = [
    {
      type: 'ALL',
      sf: 0
    },
    {
      type: 'OP',
      sf: 1
    }
  ]

  for (const type of types) {
    await runOne(type)
    await wait(2000)
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.FANTASYPROS_DYNASTY,
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
