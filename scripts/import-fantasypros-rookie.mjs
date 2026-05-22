import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  find_player_row,
  wait,
  report_job,
  fantasypros,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-fantasypros-rookie')
debug.enable('import-fantasypros-rookie,get-player,fantasypros,fetch')

const timestamp = Math.round(Date.now() / 1000)

const get_ranking = (item) => ({
  min: Number(item.rank_min),
  max: Number(item.rank_max),
  avg: Number(item.rank_ave),
  std: Number(item.rank_std),
  overall_rank: Number(item.rank_ecr),
  position_rank: Number(item.pos_rank.replace(/\D/g, ''))
})

const format_ranking_type = ({ superflex }) => {
  const sf = superflex ? 'SUPERFLEX_' : ''
  return `PPR_${sf}ROOKIE`
}

const import_individual_fantasypros_rookie_rankings = async ({
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
    rookie: true,
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
      player_row = await find_player_row(params)
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
      source_id: 'FANTASYPROS',
      ranking_type: format_ranking_type({ superflex }),
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

  if (inserts.length) {
    log(`Inserting ${inserts.length} rankings into database`)
    await db('player_rankings_index')
      .insert(inserts)
      .onConflict(['year', 'source_id', 'ranking_type', 'pid'])
      .merge()
    await db('player_rankings_history').insert(
      inserts.map((i) => ({ ...i, timestamp }))
    )
  }
}

// Per-variant row-count floor. Catches silent failure where every
// find_player_row returns null and inserts.length === 0 with no throw.
// Rookie pools are smaller (~50 ranked per variant); 20 is generous.
const RANKINGS_FLOOR_PER_VARIANT = 20

const import_fantasypros_rookie_rankings = async ({
  year,
  dry_run = false,
  ignore_cache = false
} = {}) => {
  if (year < 2011) {
    throw new Error(
      `FantasyPros archive starts at 2011; year=${year} silently returns current-year data and would corrupt the requested year`
    )
  }
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

  const expected_variants = []
  for (const item of fantasypros_position_types) {
    expected_variants.push(format_ranking_type({ superflex: item.superflex }))
    await import_individual_fantasypros_rookie_rankings({
      year,
      ...item,
      dry_run,
      ignore_cache
    })
    await wait(2000)
  }

  if (dry_run) {
    return { shortfall: null }
  }

  // Oracle: every variant we attempted must have at least the floor number of
  // rows in `player_rankings_history` written at this run's timestamp.
  const variant_counts = await db('player_rankings_history')
    .where({ year, source_id: 'FANTASYPROS', timestamp })
    .whereIn('ranking_type', expected_variants)
    .groupBy('ranking_type')
    .select('ranking_type')
    .count('* as cnt')
  const counts_by_variant = new Map(
    variant_counts.map((r) => [r.ranking_type, Number(r.cnt)])
  )
  const shortfalls = []
  for (const variant of expected_variants) {
    const cnt = counts_by_variant.get(variant) || 0
    if (cnt < RANKINGS_FLOOR_PER_VARIANT) {
      shortfalls.push(
        `${variant}: ${cnt} rows (floor=${RANKINGS_FLOOR_PER_VARIANT})`
      )
    }
  }

  if (shortfalls.length) {
    return {
      shortfall: `player_rankings_history row-count shortfall at timestamp=${timestamp} year=${year} source=FANTASYPROS: ${shortfalls.join('; ')}`
    }
  }
  return { shortfall: null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const year = argv.year ? argv.year : current_season.year
    const result = await import_fantasypros_rookie_rankings({
      year,
      dry_run: argv.dry,
      ignore_cache: argv.ignore_cache
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.FANTASYPROS_ROOKIE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_fantasypros_rookie_rankings
