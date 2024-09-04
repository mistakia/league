import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  is_main,
  report_job,
  sleeper,
  getPlayer,
  batch_insert
} from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-sleeper-adp-and-projections')
const timestamp = Math.floor(Date.now() / 1000)
const BATCH_SIZE = 500
debug.enable('import-sleeper-adp-and-projections,sleeper,get-player')

const format_adp = (projection_item) => ({
  adp_std: projection_item.stats.adp_std,
  adp_ppr: projection_item.stats.adp_ppr,
  adp_half_ppr: projection_item.stats.adp_half_ppr,
  adp_2qb: projection_item.stats.adp_2qb,
  adp_dynasty: projection_item.stats.adp_dynasty,
  adp_dynasty_2qb: projection_item.stats.adp_dynasty_2qb,
  adp_dynasty_half_ppr: projection_item.stats.adp_dynasty_half_ppr,
  adp_dynasty_ppr: projection_item.stats.adp_dynasty_ppr,
  adp_dynasty_std: projection_item.stats.adp_dynasty_std,
  adp_rookie: projection_item.stats.adp_rookie
})

const format_projection = (projection_item) => ({
  pa: projection_item.stats.pass_att || 0,
  pc: projection_item.stats.pass_cmp || 0,
  py: projection_item.stats.pass_yd || 0,
  ints: projection_item.stats.pass_int || 0,
  tdp: projection_item.stats.pass_td || 0,
  ra: projection_item.stats.rush_att || 0,
  ry: projection_item.stats.rush_yd || 0,
  tdr: projection_item.stats.rush_td || 0,
  rec: projection_item.stats.rec || 0,
  recy: projection_item.stats.rec_yd || 0,
  tdrec: projection_item.stats.rec_td || 0,
  fuml: projection_item.stats.fum_lost || 0,
  twoptc:
    (projection_item.stats.pass_2pt || 0) +
    (projection_item.stats.rush_2pt || 0)
})

const create_ranking_entries = ({ player_row, adp }) => {
  const ranking_types = [
    { type: 'STANDARD_REDRAFT', adp_key: 'adp_std' },
    { type: 'PPR_REDRAFT', adp_key: 'adp_ppr' },
    { type: 'HALF_PPR_REDRAFT', adp_key: 'adp_half_ppr' },
    { type: 'STANDARD_SUPERFLEX_REDRAFT', adp_key: 'adp_2qb' },
    { type: 'PPR_SUPERFLEX_REDRAFT', adp_key: 'adp_2qb' },
    { type: 'HALF_PPR_SUPERFLEX_REDRAFT', adp_key: 'adp_2qb' },
    { type: 'STANDARD_DYNASTY', adp_key: 'adp_dynasty_std' },
    { type: 'PPR_DYNASTY', adp_key: 'adp_dynasty_ppr' },
    { type: 'HALF_PPR_DYNASTY', adp_key: 'adp_dynasty_half_ppr' },
    { type: 'STANDARD_SUPERFLEX_DYNASTY', adp_key: 'adp_dynasty_2qb' },
    { type: 'PPR_SUPERFLEX_DYNASTY', adp_key: 'adp_dynasty_2qb' },
    { type: 'HALF_PPR_SUPERFLEX_DYNASTY', adp_key: 'adp_dynasty_2qb' },
    { type: 'STANDARD_ROOKIE', adp_key: 'adp_rookie' },
    { type: 'PPR_ROOKIE', adp_key: 'adp_rookie' },
    { type: 'HALF_PPR_ROOKIE', adp_key: 'adp_rookie' },
    { type: 'STANDARD_SUPERFLEX_ROOKIE', adp_key: 'adp_rookie' },
    { type: 'PPR_SUPERFLEX_ROOKIE', adp_key: 'adp_rookie' },
    { type: 'HALF_PPR_SUPERFLEX_ROOKIE', adp_key: 'adp_rookie' }
  ]

  return ranking_types.map(({ type, adp_key }) => ({
    pid: player_row.pid,
    pos: player_row.pos,
    week: 0,
    year: constants.season.year,
    avg: adp[adp_key],
    min: null,
    max: null,
    std: null,
    overall_rank: null,
    position_rank: null,
    source_id: 'SLEEPER',
    ranking_type: type
  }))
}

const process_matched_player = ({
  player_row,
  projection,
  adp_inserts,
  projection_inserts
}) => {
  const adp = format_adp(projection)
  const proj = format_projection(projection)

  // Create multiple ranking entries
  const ranking_entries = create_ranking_entries({
    player_row,
    adp
  })
  adp_inserts.push(...ranking_entries)

  // Insert into projections_index and projections
  projection_inserts.push({
    pid: player_row.pid,
    year: constants.season.year,
    week: 0,
    sourceid: constants.sources.SLEEPER,
    ...proj
  })
}

const import_sleeper_adp_and_projections = async ({
  ignore_cache = false,
  dry_run = false
} = {}) => {
  const projections = await sleeper.get_sleeper_projections({
    ignore_cache,
    year: constants.season.year,
    positions: ['DEF', 'K', 'QB', 'RB', 'TE', 'WR'],
    order_by: 'adp_std'
  })

  const distinct_values = {
    company: [...new Set(projections.map((p) => p.company))],
    game_id: [...new Set(projections.map((p) => p.game_id))],
    week: [...new Set(projections.map((p) => p.week))]
  }

  log(`Companies: ${distinct_values.company.join(', ')}`)
  log(`Game IDs: ${distinct_values.game_id.join(', ')}`)
  log(`Weeks: ${distinct_values.week.join(', ')}`)

  const adp_inserts = []
  const projection_inserts = []
  const matched_sleeper_ids = new Set()
  const unmatched_projections = []

  // First iteration: match by sleeper_id
  for (const projection of projections) {
    if (!projection.stats || Object.keys(projection.stats).length === 0) {
      continue
    }

    let player_row
    try {
      player_row = await getPlayer({ sleeper_id: projection.player_id })
    } catch (err) {
      log(`Error getting player by sleeper_id: ${err}`)
      unmatched_projections.push(projection)
      continue
    }

    if (player_row) {
      matched_sleeper_ids.add(Number(projection.player_id))
      process_matched_player({
        player_row,
        projection,
        adp_inserts,
        projection_inserts
      })
    } else {
      unmatched_projections.push(projection)
    }
  }

  // Second iteration: match remaining players by name, team, pos
  for (const projection of unmatched_projections) {
    const player_params = {
      name: `${projection?.player?.first_name} ${projection?.player?.last_name}`,
      pos: projection?.player?.position,
      team: projection?.player?.team
    }

    let player_row
    try {
      player_row = await getPlayer(player_params)
    } catch (err) {
      log(`Error getting player by name, team, pos: ${err}`)
      log(player_params)
      continue
    }

    if (player_row) {
      if (
        player_row.sleeper_id &&
        matched_sleeper_ids.has(Number(player_row.sleeper_id))
      ) {
        log(`Player ${player_row.sleeper_id} already matched`)
        continue
      }

      matched_sleeper_ids.add(Number(projection.player_id))
      process_matched_player({
        player_row,
        projection,
        adp_inserts,
        projection_inserts
      })
    }
  }

  if (dry_run) {
    log(adp_inserts[0])
    log(projection_inserts[0])

    // Check for duplicate projection_inserts
    const unique_keys = new Set()
    const duplicates = projection_inserts.filter((item) => {
      const key = `${item.sourceid}-${item.pid}-${item.userid}-${item.week}-${item.year}`
      if (unique_keys.has(key)) {
        return true
      }
      unique_keys.add(key)
      return false
    })

    if (duplicates.length > 0) {
      log(`Found ${duplicates.length} duplicate projection_inserts`)
      log('First duplicate:')
      log(duplicates[0])
      log('Matching original:')
      log(
        projection_inserts.find(
          (item) =>
            item.sourceid === duplicates[0].sourceid &&
            item.pid === duplicates[0].pid &&
            item.userid === duplicates[0].userid &&
            item.week === duplicates[0].week &&
            item.year === duplicates[0].year
        )
      )
    } else {
      log('No duplicate projection_inserts found')
    }

    log('dry run, skipping insertion')
    return
  }

  if (adp_inserts.length) {
    log(`Inserting ${adp_inserts.length} ADP rankings into database`)
    await batch_insert({
      items: adp_inserts,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_rankings_index')
          .insert(batch)
          .onConflict(['year', 'week', 'source_id', 'ranking_type', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, timestamp })),
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_rankings').insert(batch)
      }
    })
  }

  if (projection_inserts.length) {
    log(`Inserting ${projection_inserts.length} projections into database`)
    await batch_insert({
      items: projection_inserts,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('projections_index')
          .insert(batch)
          .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
          .merge()
      }
    })
    await batch_insert({
      items: projection_inserts.map((i) => ({ ...i, timestamp })),
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('projections').insert(batch)
      }
    })
  }
}

const main = async () => {
  let error
  try {
    await import_sleeper_adp_and_projections({
      ignore_cache: argv.ignore_cache,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_SLEEPER_ADP_AND_PROJECTIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_sleeper_adp_and_projections
