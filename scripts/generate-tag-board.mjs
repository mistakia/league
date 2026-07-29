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

const log = debug('generate:tag-board')
debug.enable('generate:tag-board')

const DYNASTY_ASSET_TYPE_PLAYER = 1

const load_board_inputs = async ({ lid, year, now_unix, viewer_tid }) => {
  const season_rows = await db('seasons')
    .where({ lid })
    .where('year', '<=', year)
  const season = season_rows.find((row) => row.year === year)
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
    .select('uid', 'name', 'cap', 'faab', 'draft_order')
    .where({ lid, year })
    .orderBy('uid')

  const roster_rows = await db('rosters_players')
    .select('tid', 'pid', 'slot', 'pos', 'tag', 'extensions')
    .where({ lid, year, week: 0 })

  const pids = [...new Set(roster_rows.map((row) => row.pid))]

  // Contract value is the latest transaction per team and player, not a column
  // on the roster row.
  const contract_rows = await db
    .select('tid', 'pid', 'value')
    .from(
      db
        .select('tid', 'pid', 'value')
        .distinctOn('tid', 'pid')
        .from('transactions')
        .where({ lid })
        .whereIn('pid', pids)
        .orderBy('tid')
        .orderBy('pid')
        .orderBy('timestamp', 'desc')
        .orderBy('uid', 'desc')
        .as('latest')
    )
  const contracts = new Map(
    contract_rows.map((row) => [contract_key(row.tid, row.pid), row.value])
  )

  const franchise_tag_history = await db('transactions')
    .select('tid', 'pid', 'year')
    .where({ lid, type: transaction_types.FRANCHISE_TAG })
    .whereIn('year', [year - 1, year - 2])

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

    viewer_rfa_bids = await db('restricted_free_agency_bids')
      .select('tid', 'pid', 'bid', 'submitted', 'announced')
      .where({ lid, year, tid: viewer_tid })
      .whereNull('cancelled')
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
    franchise_tag_history,
    dynasty_values,
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
