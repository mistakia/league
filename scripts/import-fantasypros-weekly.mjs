import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer, wait, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:rankings:weekly')
debug.enable('import:rankings:weekly,get-player')

const timestamp = Math.round(Date.now() / 1000)
const year = argv.year ? argv.year : constants.season.year
const week = argv.week ? argv.week : constants.season.week
const getURL = (opts) =>
  `https://api.fantasypros.com/v2/json/nfl/${year}/consensus-rankings?type=weekly&scoring=${opts.type}&position=${opts.pos}&week=${week}&experts=available`

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
      week,

      adp: 0,
      ppr: constants.scoring[opts.type],
      sf: opts.pos === 'OP' ? 1 : 0,
      dynasty: 0,
      rookie: 0,
      sourceid: constants.sources.FANTASYPROS,
      type: constants.rankings[opts.pos],

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
  if (week < 1 || week > constants.season.nflFinalWeek) {
    return
  }

  const types = ['STD', 'PPR', 'HALF']
  const positions = ['QB', 'RB', 'WR', 'TE', 'FLX', 'OP', 'K', 'DST']
  for (const type of types) {
    for (const pos of positions) {
      await runOne({ type, pos })
      await wait(2000)
    }
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

  await report_job({
    type: job_types.FANTASYPROS_WEEKLY,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
