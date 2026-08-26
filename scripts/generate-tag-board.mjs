import fs from 'fs'
import path from 'path'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { transaction_types } from '#constants'
import { is_main } from '#libs-server'
import build_tag_board, {
  contract_key,
  resolve_rookie_class_year
} from '#libs-server/tag-board/build-tag-board.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('generate:tag-board')
enable_debug_namespaces('generate:tag-board')

const DYNASTY_ASSET_TYPE_PLAYER = 1

const load_board_inputs = async ({ lid, year, now_unix, viewer_tid }) => {
  const season_rows = await db('seasons')
    .select('*')
    .where({ lid })
    .where('season_year', '<=', year)
  const season = season_rows.find((row) => row.season_year === year)
  if (!season) {
    throw new Error(`no seasons row for lid ${lid} year ${year}`)
  }

  const league_format = await db('league_formats')
    .where({ id: season.league_format_id })
    .first()
  if (!league_format) {
    throw new Error(`no league_formats row for ${season.league_format_id}`)
  }

  const teams = await db('teams')
    .select(
      'team_id',
      'name',
      'salary_cap',
      'free_agent_acquisition_budget_balance',
      'draft_order'
    )
    .where({ lid, season_year: year })
    .orderBy('team_id')

  const roster_rows = await db('rosters_players')
    .select('tid', 'pid', 'slot', 'player_position', 'tag', 'extensions')
    .where({ lid, season_year: year, week: 0 })

  const pids = [...new Set(roster_rows.map((row) => row.pid))]

  // Contract value is the latest transaction per team and player, not a column
  // on the roster row.
  const contract_rows = await db
    .select('tid', 'pid', 'player_salary')
    .from(
      db
        .select('tid', 'pid', 'player_salary')
        .distinctOn('tid', 'pid')
        .from('transactions')
        .where({ lid })
        .whereIn('pid', pids)
        .orderBy('tid')
        .orderBy('pid')
        .orderBy('occurred_at', 'desc')
        .orderBy('uid', 'desc')
        .as('latest')
    )
  const contracts = new Map(
    contract_rows.map((row) => [
      contract_key(row.tid, row.pid),
      row.player_salary
    ])
  )

  // Whether the extension deadline has actually been PROCESSED, which is a
  // database question and not a clock question. process-extensions.mjs runs on a
  // */5 cron, so there is a window in which now is past `season.extension_deadline_at` and no
  // extension has been written. Reading the deadline off the clock makes the
  // board understate every contract for the length of that window.
  const extension_row = await db('transactions')
    .where({ lid, season_year: year, type: transaction_types.EXTENSION })
    .first()
  const extensions_processed = Boolean(extension_row)

  const franchise_tag_history = await db('transactions')
    .select('tid', 'pid', 'season_year')
    .where({ lid, type: transaction_types.FRANCHISE_TAG })
    .whereIn('season_year', [year - 1, year - 2])

  const dynasty_date_row = await db('composite_market_value_daily')
    .max('date as date')
    .where({
      format_category: league_format.format_category,
      asset_type: DYNASTY_ASSET_TYPE_PLAYER
    })
    .first()
  const dynasty_rows = dynasty_date_row?.date
    ? await db('composite_market_value_daily')
        .select(
          'player_id',
          'composite_value',
          'composite_coverage_score',
          'ktc_value'
        )
        .where({
          format_category: league_format.format_category,
          asset_type: DYNASTY_ASSET_TYPE_PLAYER,
          date: dynasty_date_row.date
        })
        .whereIn('player_id', pids)
    : []
  const dynasty_values = new Map(
    dynasty_rows.map((row) => [row.player_id, row])
  )

  // Season-long projection, from the season period table. Two columns with two
  // distinct uses:
  //   projected_points_added_net — the worth floor on the franchise screen, and
  //                   a CONTINUOUS signal below replacement. It must be the NET
  //                   variant: build-tag-board.mjs keeps this column precisely
  //                   because it does not clip at the bottom the way a price
  //                   does, so it still separates -6.9 from -83.9. The positive
  //                   variant is floored by construction and would collapse
  //                   that ordering to a single value, silently.
  //   market_salary_positive — a single-season price, carried ONLY for the
  //                   auction supply view, where the horizon matches. It must
  //                   never sit beside a franchise or rookie price as a surplus;
  //                   those are multi-year decisions this column cannot price.
  const projection_rows = await db(
    'league_format_player_season_projection_values'
  )
    .select('pid', 'projected_points_added_net', 'market_salary_positive')
    .where({
      league_format_id: season.league_format_id,
      season_year: year
    })
    .whereIn('pid', pids)
  const projected_points_added = new Map(
    projection_rows.map((row) => [
      row.pid,
      Number(row.projected_points_added_net)
    ])
  )
  const projected_market_salary = new Map(
    projection_rows.map((row) => [row.pid, Number(row.market_salary_positive)])
  )

  const player_rows = await db('player')
    .select('pid', 'short_name', 'primary_position', 'nfl_draft_year')
    .whereIn('pid', pids)
  const players = new Map(
    player_rows.map((row) => [
      row.pid,
      {
        name: row.short_name,
        pos: row.primary_position,
        nfl_draft_year: row.nfl_draft_year
      }
    ])
  )

  // INFORMATION BOUNDARY. Both queries below are scoped to the viewer's own
  // franchise in the WHERE clause. A rival's cutlist (standing private intent)
  // and a rival's unprocessed restricted free agency offer (blind by Article IX
  // §2) therefore have no path into the artifact at all — the exclusion is the
  // query, not a downstream filter.
  let viewer_cutlist = null
  let viewer_rfa_bids = null
  if (viewer_tid !== null) {
    viewer_cutlist = await db('league_cutlist')
      .select('tid', 'pid', 'sort_order')
      .where({ tid: viewer_tid })
      .orderBy('sort_order')

    // The bid column is deliberately NOT selected. A restricted free agency
    // offer is blind under Article IX §2, and the amount is the one number that
    // must never travel — not to a rival, and not back to the offering manager
    // through a rendered page that could be shown, shared or mis-scoped. The
    // board reports THAT a nomination exists, never what it is worth.
    viewer_rfa_bids = await db('restricted_free_agency_bids')
      .leftJoin(
        'restricted_free_agency_nominations',
        'restricted_free_agency_nominations.nomination_id',
        'restricted_free_agency_bids.nomination_id'
      )
      .select(
        'restricted_free_agency_bids.tid',
        'restricted_free_agency_bids.pid',
        'restricted_free_agency_bids.submitted',
        // The announcement belongs to the player's nomination, so a competing
        // offer reports the auction's announcement rather than a null of its
        // own.
        'restricted_free_agency_nominations.announced_at as announced'
      )
      .where({
        'restricted_free_agency_bids.lid': lid,
        'restricted_free_agency_bids.season_year': year,
        'restricted_free_agency_bids.tid': viewer_tid
      })
      .whereNull('restricted_free_agency_bids.cancelled')
  }

  return {
    lid,
    year,
    now_unix,
    season,
    league_format,
    teams,
    roster_rows,
    contracts,
    extensions_processed,
    franchise_tag_history,
    dynasty_values,
    projected_points_added,
    projected_market_salary,
    players,
    rookie_class_year: resolve_rookie_class_year({ season_rows, now_unix }),
    viewer_tid,
    viewer_cutlist,
    viewer_rfa_bids
  }
}

export const generate_tag_board = async ({
  lid = 1,
  year,
  viewer_tid = null,
  now_unix = Math.round(Date.now() / 1000)
} = {}) => {
  const inputs = await load_board_inputs({ lid, year, now_unix, viewer_tid })
  const board = build_tag_board(inputs)
  board.dynasty_source = {
    table: 'composite_market_value_daily',
    format_category: inputs.league_format.format_category,
    asset_type: DYNASTY_ASSET_TYPE_PLAYER
  }
  return board
}

const run = async ({ lid, year, tid, output }) => {
  const board = await generate_tag_board({
    lid,
    year,
    viewer_tid: tid === undefined ? null : Number(tid)
  })
  const serialized = JSON.stringify(board, null, 2)

  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, `${serialized}\n`)
    log(`wrote ${output}`)
  } else {
    process.stdout.write(`${serialized}\n`)
  }

  return board
}

export default run

if (is_main(import.meta.url)) {
  const argv = yargs(hideBin(process.argv))
    .option('lid', { type: 'number', default: 1 })
    .option('year', { type: 'number' })
    .option('tid', {
      type: 'number',
      describe:
        'viewer franchise; scopes the private block to that team only. Omit for the public board.'
    })
    .option('output', { type: 'string', describe: 'write JSON to this path' })
    .demandOption('year').argv

  run(argv)
    .then(() => process.exit(0))
    .catch((error) => {
      log(error)
      process.exit(1)
    })
}
