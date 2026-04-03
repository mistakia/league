import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { is_main, batch_insert } from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { wait } from '#libs-server/wait.mjs'
import { fixTeam } from '#libs-shared'

const log = debug('import-fantasylabs-backfill')
debug.enable('import-fantasylabs-backfill')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FL_BEARER_TOKEN = 'd69ca52a1f7e4f059360c2d5c3dce0c2'
const FL_PER_CONTEST_URL =
  'https://dh5nxc6yx3kwy.cloudfront.net/contests/nfl'
const REQUEST_DELAY_MS = 3000
const BACKFILL_TARGETS_PATH = path.resolve(
  __dirname,
  '../../../../data/dfs/fantasylabs-backfill-targets.json'
)

const fetch_fl_contest_ownership = async ({ date, contest_id }) => {
  const date_str = date.replace(/-/g, '')
  const url = `${FL_PER_CONTEST_URL}/${date_str}/${contest_id}/data/`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FL_BEARER_TOKEN}`,
      Origin: 'https://terminal.fantasylabs.com',
      Referer: 'https://terminal.fantasylabs.com/',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  })

  if (res.status === 401) {
    throw new Error('FL API returned 401 -- bearer token may be expired')
  }

  if (!res.ok) {
    throw new Error(`FL API returned ${res.status} for contest ${contest_id}`)
  }

  const data = await res.json()
  return data
}


const import_fantasylabs_backfill = async ({
  dry_run = false,
  type_filter = null,
  year_filter = null,
  week_filter = null,
  contest_id_filter = null
} = {}) => {
  // load backfill targets
  const targets_path = BACKFILL_TARGETS_PATH
  if (!fs.existsSync(targets_path)) {
    throw new Error(`backfill targets not found at ${targets_path}`)
  }

  let targets = JSON.parse(fs.readFileSync(targets_path, 'utf-8'))
  log('loaded %d backfill targets', targets.length)

  // apply filters
  if (type_filter) {
    targets = targets.filter(
      (t) => t.type.toLowerCase() === type_filter.toLowerCase()
    )
    log('filtered to %d targets of type "%s"', targets.length, type_filter)
  }
  if (year_filter) {
    targets = targets.filter((t) => t.year === Number(year_filter))
    log('filtered to %d targets for year %s', targets.length, year_filter)
  }
  if (week_filter) {
    targets = targets.filter((t) => t.week === Number(week_filter))
    log('filtered to %d targets for week %s', targets.length, week_filter)
  }
  if (contest_id_filter) {
    targets = targets.filter(
      (t) => String(t.contest_id) === String(contest_id_filter)
    )
    log(
      'filtered to %d targets for contest_id %s',
      targets.length,
      contest_id_filter
    )
  }

  if (!targets.length) {
    log('no targets match filters')
    return
  }

  // check which contests are already imported
  const existing_contests = await db('dfs_contests')
    .where({ source_id: 'DRAFTKINGS', ownership_imported: true })
    .whereIn(
      'source_contest_id',
      targets.map((t) => String(t.contest_id))
    )
    .select('source_contest_id')

  const already_imported = new Set(
    existing_contests.map((r) => r.source_contest_id)
  )
  const remaining_targets = targets.filter(
    (t) => !already_imported.has(String(t.contest_id))
  )
  log(
    '%d already imported, %d remaining',
    already_imported.size,
    remaining_targets.length
  )

  if (!remaining_targets.length) {
    log('all targets already imported')
    return
  }

  await preload_active_players({
    all_players: true,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  let total_contests = 0
  let total_records = 0
  let total_matched = 0
  let total_unmatched = 0

  for (const target of remaining_targets) {
    log(
      'processing: %s wk%d -- %s (contest %d)',
      target.year,
      target.week,
      target.name,
      target.contest_id
    )

    let fl_data
    try {
      fl_data = await fetch_fl_contest_ownership({
        date: target.date,
        contest_id: target.contest_id
      })
    } catch (err) {
      log('ERROR: %s', err.message)
      if (err.message.includes('401')) {
        log('aborting -- bearer token expired')
        break
      }
      await wait(REQUEST_DELAY_MS)
      continue
    }

    if (!fl_data?.players || Object.keys(fl_data.players).length === 0) {
      log('no player data for contest %d -- skipping', target.contest_id)
      await wait(REQUEST_DELAY_MS)
      continue
    }

    const ownership_inserts = []
    let matched = 0
    let unmatched = 0

    for (const [, player_data] of Object.entries(fl_data.players)) {
      const full_name =
        `${player_data.firstName} ${player_data.lastName}`.trim()
      if (!full_name || full_name === ' ') continue

      // FL provides currentTeam which is team at time of contest
      const fl_team = player_data.currentTeam
        ? fixTeam(player_data.currentTeam)
        : null
      const teams = fl_team ? [fl_team] : []

      let player_row = null
      try {
        player_row = find_player({
          name: full_name,
          teams,
          ignore_free_agent: false,
          ignore_retired: false
        })
      } catch (err) {
        // ignore
      }

      if (!player_row) {
        unmatched++
        if (player_data.ownership > 5) {
          log(
            'unmatched high-ownership player: %s (%s %s) - %.1f%%',
            full_name,
            player_data.position,
            fl_team || '??',
            player_data.ownership
          )
        }
        continue
      }

      matched++
      ownership_inserts.push({
        pid: player_row.pid,
        source_contest_id: String(target.contest_id),
        source_id: 'DRAFTKINGS',
        source_draft_group_id: String(target.dk_dg),
        ownership_pct: player_data.ownership,
        roster_position: player_data.rosterPosition || player_data.position,
        fpts: player_data.actualPoints != null ? player_data.actualPoints : null,
        source_player_display_name: full_name,
        year: target.year,
        week: target.week
      })
    }

    log(
      'contest %d: matched %d, unmatched %d, ownership rows %d',
      target.contest_id,
      matched,
      unmatched,
      ownership_inserts.length
    )

    if (dry_run) {
      log('DRY RUN -- would insert %d records', ownership_inserts.length)
      if (ownership_inserts.length) log(ownership_inserts[0])
      await wait(REQUEST_DELAY_MS)
      continue
    }

    // insert contest record
    const contest_insert = {
      source_contest_id: String(target.contest_id),
      source_id: 'DRAFTKINGS',
      source_draft_group_id: String(target.dk_dg),
      contest_name: target.name,
      entry_fee: target.fee,
      entry_count: target.size,
      max_entries: target.size,
      game_type: target.type,
      sport: 'NFL',
      year: target.year,
      week: target.week,
      is_guaranteed: true,
      ownership_imported: true,
      ownership_imported_at: new Date()
    }

    await db('dfs_contests')
      .insert(contest_insert)
      .onConflict(['source_contest_id', 'source_id'])
      .merge()

    // insert ownership records
    if (ownership_inserts.length) {
      await batch_insert({
        items: ownership_inserts,
        batch_size: 500,
        save: async (batch) => {
          await db('player_dfs_ownership')
            .insert(batch)
            .onConflict(['pid', 'source_contest_id', 'source_id'])
            .merge()
        }
      })
    }

    total_contests++
    total_records += ownership_inserts.length
    total_matched += matched
    total_unmatched += unmatched

    log(
      'progress: %d/%d contests, %d total records',
      total_contests,
      remaining_targets.length,
      total_records
    )

    await wait(REQUEST_DELAY_MS)
  }

  log(
    'backfill complete: %d contests, %d ownership records, %d matched, %d unmatched',
    total_contests,
    total_records,
    total_matched,
    total_unmatched
  )
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('dry', {
        type: 'boolean',
        description: 'Dry run -- do not write to database'
      })
      .option('type', {
        type: 'string',
        description:
          'Filter by contest type (Millionaire, Play-Action, etc.)'
      })
      .option('year', {
        type: 'number',
        description: 'Filter by year'
      })
      .option('week', {
        type: 'number',
        description: 'Filter by week'
      })
      .option('contest_id', {
        type: 'string',
        description: 'Filter by specific DK contest ID'
      })
      .parse()

    await import_fantasylabs_backfill({
      dry_run: argv.dry,
      type_filter: argv.type,
      year_filter: argv.year,
      week_filter: argv.week,
      contest_id_filter: argv.contest_id
    })
  } catch (err) {
    error = err
    log(error)
  }

  // no report_job -- ephemeral one-time script
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_fantasylabs_backfill
