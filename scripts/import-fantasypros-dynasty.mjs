import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer, wait, report_job, fantasypros } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fantasypros-dynasty')
debug.enable('import-fantasypros-dynasty,get-player,fantasypros')

const timestamp = Math.round(Date.now() / 1000)

const get_ranking = (item) => ({
  min: Number(item.rank_min),
  max: Number(item.rank_max),
  avg: Number(item.rank_ave),
  std: Number(item.rank_std),
  overall_rank: Number(item.rank_ecr),
  position_rank: Number(item.pos_rank.replace(/\D/g, ''))
})

const format_ranking_type = ({ fantasypros_position_type, superflex }) => {
  const sf = superflex ? 'SUPERFLEX_' : ''
  return `PPR_${sf}DYNASTY`
}

const import_individual_fantasypros_dynasty_rankings = async ({
  year,
  fantasypros_position_type,
  superflex,
  dry_run = false,
  ignore_cache = false
}) => {
  const data = await fantasypros.get_fantasypros_rankings({
    year,
    fantasypros_scoring_type: 'PPR',
    fantasypros_position_type,
    dynasty: true,
    ignore_cache
  })

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

    const ranking = get_ranking(item)
    inserts.push({
      pid: player_row.pid,
      pos: params.pos,
      year,
      week: 0,

      adp: 0,
      source_id: 'FANTASYPROS',
      ranking_type: format_ranking_type({
        fantasypros_position_type,
        superflex
      }),
      timestamp,
      ...ranking
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(`${inserts.length} rankings`)
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} rankings into database`)
  await db('player_rankings').insert(inserts)
}

const import_fantasypros_dynasty_rankings = async ({
  year,
  dry_run = false,
  ignore_cache = false
} = {}) => {
  const fantasypros_position_types = [
    {
      fantasypros_position_type: 'ALL',
      superflex: false
    },
    {
      fantasypros_position_type: 'OP',
      superflex: true
    }
  ]

  for (const item of fantasypros_position_types) {
    await import_individual_fantasypros_dynasty_rankings({
      year,
      ...item,
      dry_run,
      ignore_cache
    })
    await wait(2000)
  }
}

const main = async () => {
  let error
  try {
    const year = argv.year ? argv.year : constants.season.year
    await import_fantasypros_dynasty_rankings({
      year,
      dry_run: argv.dry,
      ignore_cache: argv.ignore_cache
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.FANTASYPROS_DYNASTY,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_fantasypros_dynasty_rankings
