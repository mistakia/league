import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  is_main,
  report_job,
  sleeper,
  find_player_row,
  batch_insert,
  check_projections_index_floor,
  find_or_create_adp_format
} from '#libs-server'
import { current_season, external_data_sources } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { adp_format } from '#libs-shared'

import db from '#db'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-sleeper-adp-and-projections')
const generated_at = new Date()
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
  passing_attempts: projection_item.stats.pass_att || 0,
  passing_completions: projection_item.stats.pass_cmp || 0,
  passing_yards: projection_item.stats.pass_yd || 0,
  passing_interceptions: projection_item.stats.pass_int || 0,
  passing_touchdowns: projection_item.stats.pass_td || 0,
  rushing_attempts: projection_item.stats.rush_att || 0,
  rushing_yards: projection_item.stats.rush_yd || 0,
  rushing_touchdowns: projection_item.stats.rush_td || 0,
  receptions: projection_item.stats.rec || 0,
  receiving_yards: projection_item.stats.rec_yd || 0,
  receiving_touchdowns: projection_item.stats.rec_td || 0,
  fumbles_lost: projection_item.stats.fum_lost || 0,
  two_point_conversions:
    (projection_item.stats.pass_2pt || 0) +
    (projection_item.stats.rush_2pt || 0)
})

// Sleeper's projection feed carries a flat ADP value per legacy adp_type.
// Each maps to an adp_format row resolved once up front (SLEEPER_ADP_FORMAT_IDS)
// and written via adp_format_id.
const SLEEPER_ADP_TYPES = [
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

const create_adp_entries = ({ player_row, adp, format_id_by_type }) => {
  // Only include real ADP values. Sleeper reports adp=999 for every undrafted
  // player; storing it bloated player_adp_index/_history with ~97% sentinel rows
  // (history grew to 14M rows, 90% of them 999) and polluted data views. Drop
  // the sentinel here so absence == undrafted. No legitimate ADP nears 999.
  return SLEEPER_ADP_TYPES.filter(
    ({ adp_key }) => adp[adp_key] != null && adp[adp_key] < 999
  ).map(({ type, adp_key }) => ({
    pid: player_row.pid,
    pos: player_row.pos,
    season_year: current_season.year,
    adp: adp[adp_key],
    min_pick: null,
    max_pick: null,
    std_dev: null,
    sample_size: null,
    percent_drafted: null,
    source_id: 'SLEEPER',
    adp_format_id: format_id_by_type[type]
  }))
}

const process_matched_player = ({
  player_row,
  projection,
  adp_inserts,
  projection_inserts,
  format_id_by_type
}) => {
  const adp = format_adp(projection)
  const proj = format_projection(projection)

  // Create multiple ADP entries
  const adp_entries = create_adp_entries({
    player_row,
    adp,
    format_id_by_type
  })
  adp_inserts.push(...adp_entries)

  // Insert into projections_index and projections
  projection_inserts.push({
    pid: player_row.pid,
    season_year: current_season.year,
    week: 0,
    season_type: 'REG',
    sourceid: external_data_sources.SLEEPER,
    ...proj
  })
}

const import_sleeper_adp_and_projections = async ({
  ignore_cache = false,
  dry_run = false
} = {}) => {
  const projections = await sleeper.get_sleeper_projections({
    ignore_cache,
    year: current_season.year,
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

  // Resolve an adp_format_id for each legacy Sleeper adp_type once up front.
  const format_id_by_type = {}
  for (const { type } of SLEEPER_ADP_TYPES) {
    format_id_by_type[type] = await find_or_create_adp_format(
      db,
      adp_format.decode_adp_type(type)
    )
  }

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
      player_row = await find_player_row({
        sleeper_player_id: projection.player_id
      })
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
        projection_inserts,
        format_id_by_type
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
      player_row = await find_player_row(player_params)
    } catch (err) {
      log(`Error getting player by name, team, pos: ${err}`)
      log(player_params)
      continue
    }

    if (player_row) {
      if (
        player_row.sleeper_player_id &&
        matched_sleeper_ids.has(Number(player_row.sleeper_player_id))
      ) {
        log(`Player ${player_row.sleeper_player_id} already matched`)
        continue
      }

      matched_sleeper_ids.add(Number(projection.player_id))
      process_matched_player({
        player_row,
        projection,
        adp_inserts,
        projection_inserts,
        format_id_by_type
      })
    }
  }

  if (dry_run) {
    log(adp_inserts[0])
    log(projection_inserts[0])

    // Check for duplicate projection_inserts
    const unique_keys = new Set()
    const duplicates = projection_inserts.filter((item) => {
      const key = `${item.sourceid}-${item.pid}-${item.userid}-${item.week}-${item.season_year}`
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
            item.season_year === duplicates[0].season_year
        )
      )
    } else {
      log('No duplicate projection_inserts found')
    }

    log('dry run, skipping insertion')
    return { skipped: true }
  }

  if (adp_inserts.length) {
    const observed_at = new Date()
    log(`Inserting ${adp_inserts.length} ADP entries into database`)
    await batch_insert({
      items: adp_inserts,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_adp_index')
          .insert(batch)
          .onConflict(['season_year', 'source_id', 'adp_format_id', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, observed_at })),
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_adp_history').insert(batch)
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
          .onConflict([
            'sourceid',
            'pid',
            'userid',
            'week',
            'season_year',
            'season_type'
          ])
          .merge()
      }
    })
    await batch_insert({
      items: projection_inserts.map((i) => ({ ...i, generated_at })),
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('projections').insert(batch)
      }
    })
  }

  return {
    skipped: false,
    year: current_season.year,
    week: 0,
    sourceid: external_data_sources.SLEEPER,
    seas_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await import_sleeper_adp_and_projections({
      ignore_cache: argv.ignore_cache,
      dry_run: argv.dry
    })
    if (result && !result.skipped) {
      await check_projections_index_floor(result)
    }
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
