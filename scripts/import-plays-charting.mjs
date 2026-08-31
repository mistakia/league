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
import grade_plays_import_run from '#libs-server/charting-data/grade-plays-import-run.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import-plays-charting')

// A game that already carries charting values is skipped. Without this a weekly
// cron re-fetches every game of the season every week, forever, on the pinned
// residential address -- the same reason league-imports.cron gives for the
// matchup importer's skip. Coverage is read off epa_charting, which this
// importer writes on every charted play and no other source writes at all.
//
// --force is what asks for a game to be fetched again, and it is not a
// theoretical flag: the 2025 games imported before the sequence-lookup fix
// matched almost nothing, so they need exactly one forced re-run to pick up
// what the broken matcher could not write.
async function get_games_for_import({
  season_year,
  week,
  esbid,
  season_type,
  force
}) {
  const query = db('nfl_games')
    .select(
      'esbid',
      'shield_game_id',
      'season_year',
      'week',
      'season_type',
      'home_nfl_team',
      'away_nfl_team'
    )
    .whereNotNull('shield_game_id')

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('season_year', season_year)
    if (week) {
      query.where('week', week)
    }
    if (season_type) {
      query.where('season_type', season_type)
    }
  }

  query.orderBy(['season_year', 'week', 'esbid'])
  const games_selected = await query

  if (force || games_selected.length === 0)
    return { games_selected, games_to_process: games_selected }

  const covered_rows = await db('nfl_plays')
    .distinct('esbid')
    .whereNotNull('epa_charting')
    .whereIn(
      'esbid',
      games_selected.map((game) => game.esbid)
    )
  const covered_esbids = new Set(covered_rows.map((row) => row.esbid))

  return {
    games_selected,
    games_to_process: games_selected.filter(
      (game) => !covered_esbids.has(game.esbid)
    )
  }
}

// nfl_plays.sequence is numeric(10,1) and the pg driver hands it back as the
// STRING '888.0', while the vendor sends playSequenceNumber as the NUMBER 4178.
// A Map compares keys by identity, so '888.0' and 888 are different keys and
// this lookup never hit once -- measured 0 of 961 vendor plays across six 2025
// games, 960 of 961 with both sides coerced. Every play fell through to the
// context fallback instead, which is the matcher that was running without a
// quarter or down constraint until 1b4133709.
//
// The coercion belongs on BOTH sides or it fixes nothing, which is why the
// lookup goes through a function rather than being a bare Map.get at the call
// site: a reader fixing one end and not the other gets the same silent zero.
export function build_sequence_index(plays) {
  const index = new Map()
  for (const play of plays) {
    if (play.sequence == null) continue
    const key = Number(play.sequence)
    if (Number.isNaN(key)) continue
    index.set(key, play)
  }
  return index
}

export function find_play_by_sequence(index, sequence) {
  if (sequence == null) return null
  const key = Number(sequence)
  if (Number.isNaN(key)) return null
  return index.get(key) || null
}

async function process_game({ game, client, stats, dry = false }) {
  const { esbid, shield_game_id, week, home_nfl_team, away_nfl_team } = game

  log(
    `processing game ${esbid} (shield: ${shield_game_id}, week ${week}, ${away_nfl_team}@${home_nfl_team})`
  )

  let plays_data
  try {
    plays_data = await client.get_plays({ game_id: shield_game_id })
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
  const plays_by_sequence = build_sequence_index(game_plays)

  let plays_matched = 0
  let plays_unmatched = 0
  let plays_skipped_marker = 0
  let fields_updated = 0

  for (const source_play of plays_data) {
    // Skip MARKER entries (TV timeouts, commercial breaks, etc.)
    if (source_play.playType === 'MARKER') {
      plays_skipped_marker += 1
      continue
    }

    const mapped_fields = map_charting_play_to_db_fields(source_play)

    // Primary match: sequence number (most reliable)
    let db_play = find_play_by_sequence(
      plays_by_sequence,
      source_play.playSequenceNumber
    )

    // Fallback: try sequence - 1 for special plays (timeouts have off-by-one)
    if (
      !db_play &&
      source_play.down === 0 &&
      source_play.playSequenceNumber > 0
    ) {
      db_play = find_play_by_sequence(
        plays_by_sequence,
        source_play.playSequenceNumber - 1
      )
    }

    // Fallback: context-based matching for plays without sequence match
    if (!db_play && source_play.down > 0) {
      const match_criteria = {
        esbid,
        quarter: mapped_fields.quarter ?? source_play.quarter,
        down_number: mapped_fields.down_number ?? source_play.down,
        yards_to_go: mapped_fields.yards_to_go || source_play.distance,
        yard_line_100: mapped_fields.yard_line_100,
        seconds_remaining_quarter: mapped_fields.seconds_remaining_quarter
      }

      try {
        db_play = find_play(match_criteria)
      } catch (error) {
        // MultiplePlayMatchError -- try with team info for disambiguation
        try {
          db_play = find_play({
            ...match_criteria,
            offense_nfl_team: mapped_fields.offense_nfl_team,
            defense_nfl_team: mapped_fields.defense_nfl_team,
            return_all_matches: false
          })
        } catch (inner_error) {
          log(
            `multiple matches for play in game ${esbid}: quarter=${match_criteria.quarter} down=${match_criteria.down_number} ytg=${match_criteria.yards_to_go} ydl=${match_criteria.yard_line_100}`
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
        update: mapped_fields,
        source: 'charting'
      })
      fields_updated += changes
    }
  }

  stats.games_processed += 1
  stats.total_plays_matched += plays_matched
  stats.total_plays_unmatched += plays_unmatched
  stats.total_plays_skipped_marker += plays_skipped_marker
  stats.total_fields_updated += fields_updated

  const actual_plays = plays_data.length - plays_skipped_marker
  const match_rate = actual_plays
    ? ((plays_matched / actual_plays) * 100).toFixed(1)
    : 0
  log(
    `game ${esbid}: ${plays_matched}/${actual_plays} matched (${match_rate}%), ${fields_updated} fields updated, ${plays_unmatched} unmatched${plays_skipped_marker ? `, ${plays_skipped_marker} markers skipped` : ''}`
  )
}

export async function import_plays_charting({
  season_year = current_season.year,
  week,
  esbid,
  dry = false,
  // nfl_pro is the only sticky dedicated-ISP residential pool, and it is the
  // ONE place this default lives. The yargs option below deliberately declares
  // no `default`: it used to carry 'default' too, which silently won on every
  // CLI invocation -- meaning every cron run -- so changing this line alone
  // would have pinned nothing.
  ignore_cache = false,
  proxy_pool = 'nfl_pro',
  use_proxy = true,
  request_delay = 3000,
  season_type = null,
  force = false,
  collector = null
} = {}) {
  console.time('import-plays-charting')
  log(
    `starting charting play import: year=${season_year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry}`
  )

  const client = new ChartingDataClient({
    ignore_cache,
    proxy_pool,
    use_proxy,
    request_delay_ms: request_delay
  })

  const { games_selected, games_to_process } = await get_games_for_import({
    season_year,
    week,
    esbid,
    season_type,
    force
  })
  console.log(
    `selected ${games_selected.length} game(s) in scope, ${games_to_process.length} needing import`
  )

  const stats = {
    games_processed: 0,
    games_failed: 0,
    games_empty: 0,
    total_plays_matched: 0,
    total_plays_unmatched: 0,
    total_plays_skipped_marker: 0,
    total_fields_updated: 0
  }

  for (const game of games_to_process) {
    await process_game({ game, client, stats, dry })
  }

  console.timeEnd('import-plays-charting')

  log('--- Import Summary ---')
  log(`games processed: ${stats.games_processed}`)
  log(`games failed: ${stats.games_failed}`)
  log(`games empty: ${stats.games_empty}`)
  log(`plays matched: ${stats.total_plays_matched}`)
  log(`plays unmatched: ${stats.total_plays_unmatched}`)
  log(`marker plays skipped: ${stats.total_plays_skipped_marker}`)
  log(`fields updated: ${stats.total_fields_updated}`)

  // Graded here rather than in main() so every caller is graded --
  // import-full-season.mjs runs this import too, and a stage that idles there
  // is as invisible as one that idles under cron.
  const grade = grade_plays_import_run({
    ...stats,
    games_selected: games_selected.length,
    // A season-wide scope on the CURRENT season may hold no game yet; any
    // narrower ask named something the caller expects to exist.
    expects_games: Boolean(week || esbid) || season_year !== current_season.year
  })
  console.log(grade.summary)
  if (!grade.passed) {
    throw new Error(grade.summary)
  }

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
      .option('ignore_cache', {
        type: 'boolean',
        description: 'Re-ask the vendor instead of reading the raw cache',
        default: false
      })
      .option('proxy_pool', {
        type: 'string',
        description: 'Proxy pool name (default: nfl_pro)'
      })
      .option('request_delay', {
        type: 'number',
        description: 'Delay between requests (ms)',
        default: 3000
      })
      .option('seas_type', {
        type: 'string',
        alias: 'season_type',
        // The alias is the fix, not decoration. Three of these four scripts
        // declared this option as `seas_type` and then read `argv.season_type`,
        // which yargs never set -- so --seas_type PRE parsed cleanly, was
        // dropped, and every run silently used the default scope. The alias
        // makes yargs populate BOTH keys, so neither spelling can be the wrong
        // one. Same defect class as the qtr/dwn keys find_play used to accept.
        description: 'Season type (REG, POST, PRE)'
      })
      .option('no_proxy', {
        type: 'boolean',
        description: 'Disable proxy usage',
        default: false
      })
      .option('force', {
        type: 'boolean',
        description: 'Re-import games that already have charting values',
        default: false
      }).argv

    enable_debug_namespaces('import-plays-charting,charting-data')

    await import_plays_charting({
      season_year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      ignore_cache: argv.ignore_cache,
      proxy_pool: argv.proxy_pool,
      use_proxy: !argv.no_proxy,
      request_delay: argv.request_delay,
      season_type: argv.season_type,
      force: argv.force
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
