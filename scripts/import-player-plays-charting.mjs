import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { ChartingDataClient } from '#libs-server/charting-data/index.mjs'
import { match_charting_player } from '#libs-server/charting-data/player-matching.mjs'
import { resolve_nfl_team_sumer_id } from '#libs-server/charting-data/team-mapping.mjs'
import { preload_active_players } from '#libs-server/player-cache.mjs'
import grade_player_play_import_run from '#libs-server/charting-data/grade-player-play-import-run.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import-player-plays-charting')

enable_debug_namespaces(
  'import-player-plays-charting,charting-data,charting-data:player-matching'
)

// A game still in progress is charted partially or not at all, and selecting
// one would count against the oracle as a failed request.
const GAME_COMPLETION_BUFFER_HOURS = 6

const DEFAULT_SEASON_TYPES = ['REG', 'POST']

const BATCH_SIZE = 500

// Vendor-field -> column, for the fields that pass through unchanged. The
// remaining scalars are booleans renamed with an is_ prefix and are listed
// separately below, because the rename is the whole transformation.
const DIRECT_FIELDS = {
  jerseyNumber: 'jersey_number',
  alignment: 'alignment',
  alignmentSide: 'alignment_side',
  role: 'snap_role',
  defenderTechnique: 'defender_technique',
  route: 'route_run',
  routeRelease: 'route_release',
  routeBreakDepth: 'route_break_depth',
  coverageResponsibility: 'coverage_responsibility',
  coverageResponsibilitySide: 'coverage_responsibility_side',
  gapAssignment: 'gap_assignment',
  gapAssignmentSide: 'gap_assignment_side',
  pressType: 'press_type',
  passingDepthOfTarget: 'passing_depth_of_target',
  passingEpa: 'passing_epa',
  receivingDepthOfTarget: 'receiving_depth_of_target',
  receivingReceptions: 'receiving_receptions',
  receivingYardsAfterCatch: 'receiving_yards_after_catch',
  receivingEpa: 'receiving_epa',
  rushingEpa: 'rushing_epa',
  yardsAfterContact: 'yards_after_contact',
  defenseSoloTackles: 'defense_solo_tackles',
  defenseAssistedTackles: 'defense_assisted_tackles',
  defenseTacklesForLoss: 'defense_tackles_for_loss',
  defenseSacks: 'defense_sacks'
}

const BOOLEAN_FIELDS = {
  boxAlignment: 'is_box_alignment',
  primaryCoverage: 'is_primary_coverage',
  press: 'is_press',
  pressure: 'is_pressure',
  pressureAllowed: 'is_pressure_allowed',
  hurry: 'is_hurry',
  hurryAllowed: 'is_hurry_allowed',
  sackAllowed: 'is_sack_allowed',
  isHit: 'is_hit',
  isQbHitter: 'is_quarterback_hitter',
  qbScramble: 'is_quarterback_scramble',
  qbDesignedRun: 'is_quarterback_designed_run',
  firstContact: 'is_first_contact',
  stop: 'is_stop',
  tackleMissed: 'is_tackle_missed',
  passBreakup: 'is_pass_breakup',
  receptionAllowed: 'is_reception_allowed'
}

export function map_player_play_to_db_fields(row) {
  const result = {}

  for (const [source_field, column] of Object.entries(DIRECT_FIELDS)) {
    const value = row[source_field]
    if (value === undefined || value === null) continue
    result[column] = value
  }

  for (const [source_field, column] of Object.entries(BOOLEAN_FIELDS)) {
    const value = row[source_field]
    if (value === undefined || value === null) continue
    result[column] = value
  }

  return result
}

// Returns the games matching the scope and, separately, the subset still
// needing an import. Without the second half a weekly cron re-fetches every
// game of the season every week, forever, on the pinned residential address --
// two requests per game rather than one, at this grain.
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
    .where(
      'kickoff_at',
      '<',
      db.raw(`now() - interval '${GAME_COMPLETION_BUFFER_HOURS} hours'`)
    )

  if (esbid) {
    query.where('esbid', esbid)
  } else {
    query.where('season_year', season_year)
    if (week) query.where('week', week)
    if (season_type) {
      query.where('season_type', season_type)
    } else {
      query.whereIn('season_type', DEFAULT_SEASON_TYPES)
    }
  }

  query.orderBy(['season_year', 'week', 'esbid'])
  const games_selected = await query

  if (force || games_selected.length === 0) {
    return { games_selected, games_to_process: games_selected }
  }

  // Covered means BOTH teams present. A game whose second request failed
  // halfway through a prior run is half-imported, and skipping it on the
  // strength of the first team's rows would make that permanent.
  const covered_rows = await db('nfl_player_play_charting')
    .select('esbid')
    .countDistinct('nfl_team as team_count')
    .whereIn(
      'esbid',
      games_selected.map((game) => game.esbid)
    )
    .groupBy('esbid')
  const covered_esbids = new Set(
    covered_rows
      .filter((row) => Number(row.team_count) >= 2)
      .map((row) => row.esbid)
  )

  return {
    games_selected,
    games_to_process: games_selected.filter(
      (game) => !covered_esbids.has(game.esbid)
    )
  }
}

async function process_team({ game, nfl_team, client, stats, dry = false }) {
  const { esbid, shield_game_id, season_year } = game

  const sumer_team_id = resolve_nfl_team_sumer_id(nfl_team)
  if (!sumer_team_id) {
    // Not a transient. The map is static and covers all 32 teams, so a miss
    // means the schedule holds a team abbreviation the map does not spell the
    // same way -- a defect to fix, not a game to retry.
    console.error(`game ${esbid}: no sumer team id for '${nfl_team}'`)
    stats.requests_failed += 1
    return
  }

  let rows
  try {
    rows = await client.get_player_plays({
      game_id: shield_game_id,
      team_id: sumer_team_id
    })
  } catch (error) {
    log(`game ${esbid} team ${nfl_team}: fetch failed -- ${error.message}`)
    stats.requests_failed += 1
    return
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    // A 200 with an empty list covers a wrong game id, an out-of-window season
    // and a genuinely uncharted game alike. Counted, not failed: the vendor
    // charts partially, and legitimately thin games exist.
    log(`game ${esbid} team ${nfl_team}: no rows returned`)
    stats.requests_empty += 1
    return
  }

  stats.rows_returned += rows.length

  const rows_to_insert = []
  for (const [source_row_index, row] of rows.entries()) {
    if (!row.sumerPlayerId) {
      // sumer_player_id is the row's durable identity and is NOT NULL. A row
      // without one cannot be stored, and dropping it silently is exactly what
      // the oracle's rows_dropped exists to catch.
      log(
        `game ${esbid} team ${nfl_team}: row ${source_row_index} has no player id`
      )
      continue
    }

    const player = row.sumerPlayer || {}
    const pid = await match_charting_player({
      sumer_player_id: row.sumerPlayerId,
      football_name: player.footballName,
      last_name: player.lastName,
      team_code: nfl_team,
      jersey_number: row.jerseyNumber,
      position: player.position,
      // The game's own season, not the player's team today.
      season_year
    })

    if (!pid) stats.pid_unresolved += 1

    rows_to_insert.push({
      esbid,
      nfl_team,
      source_row_index,
      sumer_player_id: row.sumerPlayerId,
      // Nullable and derived. Never drop a row for an unresolved player: the
      // vendor id above is the identity, and pid can be backfilled at any time
      // as matching improves.
      pid: pid || null,
      ...map_player_play_to_db_fields(row)
    })
  }

  if (dry) {
    stats.requests_with_rows += 1
    stats.rows_inserted += rows_to_insert.length
    stats.rows_dropped += rows.length - rows_to_insert.length
    return
  }

  try {
    // Delete-then-insert scoped to one (esbid, team), in one transaction, so a
    // re-import is idempotent and a failure part-way cannot leave the team
    // holding a mix of two runs' rows. There is no content key to merge on --
    // source_row_index is a surrogate, so an upsert would silently keep stale
    // rows whenever a re-fetch returned fewer of them.
    await db.transaction(async (trx) => {
      await trx('nfl_player_play_charting').where({ esbid, nfl_team }).del()
      for (let i = 0; i < rows_to_insert.length; i += BATCH_SIZE) {
        await trx('nfl_player_play_charting').insert(
          rows_to_insert.slice(i, i + BATCH_SIZE)
        )
      }
    })
  } catch (error) {
    // Containment is per team-request: one unwritable batch used to abort an
    // entire remaining run in the sibling importer, and every later game went
    // unimported.
    console.error(
      `game ${esbid} team ${nfl_team}: insert failed -- ${error.message}`
    )
    stats.requests_failed += 1
    return
  }

  stats.requests_with_rows += 1
  stats.rows_inserted += rows_to_insert.length
  stats.rows_dropped += rows.length - rows_to_insert.length

  log(
    `game ${esbid} team ${nfl_team}: ${rows_to_insert.length}/${rows.length} rows inserted`
  )
}

export async function import_player_plays_charting({
  season_year = current_season.year,
  week,
  esbid,
  dry = false,
  // nfl_pro is the only sticky dedicated-ISP residential pool, and it is the
  // ONE place this default lives -- the yargs option below declares none.
  proxy_pool = 'nfl_pro',
  use_proxy = true,
  request_delay = 3000,
  season_type = null,
  force = false
} = {}) {
  console.time('import-player-plays-charting')
  console.log(
    `starting charting player-play import: year=${season_year} week=${week || 'all'} esbid=${esbid || 'all'} dry=${dry} force=${force}`
  )

  const client = new ChartingDataClient({
    proxy_pool,
    use_proxy,
    request_delay_ms: request_delay
  })

  await preload_active_players({ all_players: true })

  const { games_selected, games_to_process } = await get_games_for_import({
    season_year,
    week,
    esbid,
    season_type,
    force
  })
  console.log(
    `selected ${games_selected.length} played game(s) in scope, ${games_to_process.length} needing import`
  )

  const stats = {
    games_selected: games_selected.length,
    games_attempted: games_to_process.length,
    requests_attempted: games_to_process.length * 2,
    requests_with_rows: 0,
    requests_failed: 0,
    requests_empty: 0,
    rows_returned: 0,
    rows_inserted: 0,
    rows_dropped: 0,
    pid_unresolved: 0
  }

  for (const game of games_to_process) {
    for (const nfl_team of [game.home_nfl_team, game.away_nfl_team]) {
      await process_team({ game, nfl_team, client, stats, dry })
    }
  }

  console.timeEnd('import-player-plays-charting')

  // Graded here rather than in main() so every caller is graded --
  // import-full-season.mjs runs this too, and a stage that idles there is as
  // invisible as one that idles under cron.
  const grade = grade_player_play_import_run({
    ...stats,
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
        // The alias is the fix, not decoration. Three of these four scripts
        // declared this option as `seas_type` and then read `argv.season_type`,
        // which yargs never set -- so --seas_type PRE parsed cleanly, was
        // dropped, and every run silently used the default scope. The alias
        // makes yargs populate BOTH keys, so neither spelling can be the wrong
        // one. Same defect class as the qtr/dwn keys find_play used to accept.
        alias: 'season_type',
        description: 'Season type (REG, POST, PRE)'
      })
      .option('no_proxy', {
        type: 'boolean',
        description: 'Disable proxy usage',
        default: false
      })
      .option('force', {
        type: 'boolean',
        description: 'Re-import games that already have player-play rows',
        default: false
      }).argv

    await import_player_plays_charting({
      season_year: argv.year,
      week: argv.week,
      esbid: argv.esbid,
      dry: argv.dry,
      proxy_pool: argv.proxy_pool,
      use_proxy: !argv.no_proxy,
      request_delay: argv.request_delay,
      season_type: argv.seas_type,
      force: argv.force
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYER_PLAYS_CHARTING,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_player_plays_charting
