import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job, update_play } from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import play_cache, {
  preload_plays,
  find_play
} from '#libs-server/play-cache.mjs'
import { ChartingDataClient } from '#libs-server/charting-data/index.mjs'
import { map_charting_play_to_db_fields } from '#libs-server/charting-data/field-mapping.mjs'

const log = debug('import-plays-charting')

async function get_games_for_import({ year, week, esbid, seas_type }) {
  const query = db('nfl_games')
    .select('esbid', 'shieldid', 'year', 'week', 'seas_type', 'h', 'v')
    .whereNotNull('shieldid')

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('year', year)
    if (week) {
      query.where('week', week)
    }
    if (seas_type) {
      query.where('seas_type', seas_type)
    }
  }

  query.orderBy(['year', 'week', 'esbid'])
  return query
}

async function process_game({
  game,
  client,
  stats,
  dry = false
}) {
  const { esbid, shieldid, week, h, v } = game

  log(`processing game ${esbid} (shield: ${shieldid}, week ${week}, ${v}@${h})`)

  let plays_data
  try {
    plays_data = await client.get_plays({ game_id: shieldid })
  } catch (error) {
    log(`failed to fetch plays for game ${esbid}: ${error.message}`)
    stats.games_failed += 1
    return
  }

  if (!plays_data || !Array.isArray(plays_data)) {
    log(`no plays data returned for game ${esbid}`)
    stats.games_empty += 1
    return
  }

  log(`fetched ${plays_data.length} plays for game ${esbid}`)

  // Preload existing plays for this game
  await preload_plays({
    esbids: [esbid],
    include_context_index: true,
    force_reload: true
  })

  // Build sequence-based index from cached plays for fast lookup
  const game_plays = play_cache.plays_by_esbid.get(esbid) || []
  const plays_by_sequence = new Map()
  for (const p of game_plays) {
    if (p.sequence != null) {
      plays_by_sequence.set(p.sequence, p)
    }
  }

  let plays_matched = 0
  let plays_unmatched = 0
  let fields_updated = 0

  for (const source_play of plays_data) {
    const mapped_fields = map_charting_play_to_db_fields(source_play)

    // Primary match: sequence number (most reliable)
    let db_play = plays_by_sequence.get(source_play.playSequenceNumber) || null

    // Fallback: try sequence - 1 for special plays (timeouts have off-by-one)
    if (!db_play && source_play.down === 0 && source_play.playSequenceNumber > 0) {
      db_play =
        plays_by_sequence.get(source_play.playSequenceNumber - 1) || null
    }

    // Fallback: context-based matching for plays without sequence match
    if (!db_play && source_play.down > 0) {
      const match_criteria = {
        esbid,
        qtr: mapped_fields.qtr || source_play.quarter,
        dwn: mapped_fields.dwn || source_play.down,
        yards_to_go: mapped_fields.yards_to_go || source_play.distance,
        ydl_100: mapped_fields.ydl_100,
        sec_rem_qtr: mapped_fields.sec_rem_qtr
      }

      try {
        db_play = find_play(match_criteria)
      } catch (error) {
        // MultiplePlayMatchError -- try with team info for disambiguation
        try {
          db_play = find_play({
            ...match_criteria,
            off: mapped_fields.off,
            def: mapped_fields.def,
            return_all_matches: false
          })
        } catch (inner_error) {
          log(
            `multiple matches for play in game ${esbid}: qtr=${match_criteria.qtr} dwn=${match_criteria.dwn} ytg=${match_criteria.yards_to_go} ydl=${match_criteria.ydl_100}`
          )
        }
      }
    }

    if (!db_play) {
      plays_unmatched += 1
      continue
    }

    plays_matched += 1

    if (!dry) {
      const changes = await update_play({
        play_row: db_play,
        update: mapped_fields
      })
      fields_updated += changes
    }
  }

  stats.games_processed += 1
  stats.total_plays_matched += plays_matched
  stats.total_plays_unmatched += plays_unmatched
  stats.total_fields_updated += fields_updated

  const match_rate = plays_data.length
    ? ((plays_matched / plays_data.length) * 100).toFixed(1)
    : 0
  log(
    `game ${esbid}: ${plays_matched}/${plays_data.length} matched (${match_rate}%), ${fields_updated} fields updated, ${plays_unmatched} unmatched`
  )
}

export async function import_plays_charting({
  year = current_season.year,
  week,
  esbid,
  dry = false,
  proxy_pool = 'default',
  use_proxy = true,
  request_delay = 3000,
  seas_type = null,
  collector = null
} = {}) {
  console.time('import-plays-charting')
  log(
    `starting charting play import: year=${year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry}`
  )

  const client = new ChartingDataClient({
    proxy_pool,
    use_proxy,
    request_delay_ms: request_delay
  })

  const games = await get_games_for_import({ year, week, esbid, seas_type })
  log(`found ${games.length} games to process`)

  if (games.length === 0) {
    console.timeEnd('import-plays-charting')
    return { games_processed: 0 }
  }

  const stats = {
    games_processed: 0,
    games_failed: 0,
    games_empty: 0,
    total_plays_matched: 0,
    total_plays_unmatched: 0,
    total_fields_updated: 0
  }

  for (const game of games) {
    await process_game({ game, client, stats, dry })
  }

  console.timeEnd('import-plays-charting')

  log('--- Import Summary ---')
  log(`games processed: ${stats.games_processed}`)
  log(`games failed: ${stats.games_failed}`)
  log(`games empty: ${stats.games_empty}`)
  log(`plays matched: ${stats.total_plays_matched}`)
  log(`plays unmatched: ${stats.total_plays_unmatched}`)
  log(`fields updated: ${stats.total_fields_updated}`)

  return stats
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        type: 'number',
        description: 'Year to import',
        default: current_season.year
      })
      .option('week', {
        type: 'number',
        description: 'Specific week to import'
      })
      .option('esbid', {
        type: 'number',
        description: 'Specific game ID to import'
      })
      .option('dry', {
        type: 'boolean',
        description: 'Dry run mode',
        default: false
      })
      .option('proxy_pool', {
        type: 'string',
        description: 'Proxy pool name',
        default: 'default'
      })
      .option('request_delay', {
        type: 'number',
        description: 'Delay between requests (ms)',
        default: 3000
      })
      .option('seas_type', {
        type: 'string',
        description: 'Season type (REG, POST, PRE)'
      })
      .option('no_proxy', {
        type: 'boolean',
        description: 'Disable proxy usage',
        default: false
      })
      .argv

    debug.enable('import-plays-charting,charting-data')

    await import_plays_charting({
      year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      proxy_pool: argv.proxy_pool,
      use_proxy: !argv.no_proxy,
      request_delay: argv.request_delay,
      seas_type: argv.seas_type
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYS_CHARTING,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_plays_charting
