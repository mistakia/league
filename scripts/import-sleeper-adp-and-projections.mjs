import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain, report_job, sleeper, getPlayer } from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-sleeper-adp-and-projections')
const timestamp = Math.floor(Date.now() / 1000)
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

  for (const projection of projections) {
    let player_row

    try {
      player_row = await getPlayer({ sleeper_id: projection.player_id })
    } catch (err) {
      log(`Error getting player: ${err}`)
      continue
    }

    const player_params = {
      name: `${projection?.player?.first_name} ${projection?.player?.last_name}`,
      pos: projection?.player?.position,
      team: projection?.player?.team
    }
    if (!player_row) {
      try {
        player_row = await getPlayer(player_params)
      } catch (err) {
        log(`Error getting player: ${err}`)
        log(player_params)
        continue
      }
    }

    if (player_row) {
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
  }

  if (dry_run) {
    log(adp_inserts[0])
    log(projection_inserts[0])
    log(`Dry run, skipping insertion`)
    return
  }

  if (adp_inserts.length) {
    log(`Inserting ${adp_inserts.length} ADP rankings into database`)
    await db('player_rankings_index')
      .insert(adp_inserts)
      .onConflict(['year', 'week', 'source_id', 'ranking_type', 'pid'])
      .merge()
    await db('player_rankings').insert(
      adp_inserts.map((i) => ({ ...i, timestamp }))
    )
  }

  if (projection_inserts.length) {
    log(`Inserting ${projection_inserts.length} projections into database`)
    await db('projections_index')
      .insert(projection_inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
      .merge()
    await db('projections').insert(
      projection_inserts.map((i) => ({ ...i, timestamp }))
    )
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

if (isMain(import.meta.url)) {
  main()
}

export default import_sleeper_adp_and_projections
