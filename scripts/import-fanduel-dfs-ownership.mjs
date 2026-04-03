import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  is_main,
  report_job,
  batch_insert,
  fanduel
} from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { fanduel_dfs_session_manager } from '../private/libs-server/fanduel/index.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const log = debug('import-fanduel-dfs-ownership')
debug.enable(
  'import-fanduel-dfs-ownership,fanduel:dfs,fanduel-dfs-session-manager'
)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const discover_contests = async ({ year, dry_run = false }) => {
  log('discovering FanDuel DFS contests for year %d', year)

  // load FD fixture list IDs from player_salaries
  const fixture_lists = await db('player_salaries')
    .where({ source_id: 'FANDUEL' })
    .whereNotNull('source_contest_id')
    .select('source_contest_id')
    .groupBy('source_contest_id')

  log('found %d fixture lists from salary data', fixture_lists.length)

  if (!fixture_lists.length) {
    log('no FanDuel fixture lists found in salary data')
    return
  }

  const headers =
    await fanduel_dfs_session_manager.get_valid_dfs_session_headers()

  const contest_inserts = []

  for (const { source_contest_id: fixture_list_id } of fixture_lists) {
    let contests_data
    try {
      contests_data = await fanduel.get_fanduel_dfs_contests({
        fixture_list_id,
        headers
      })
    } catch (err) {
      log(
        'failed to fetch contests for fixture list %s: %s',
        fixture_list_id,
        err.message
      )
      continue
    }

    const contests = contests_data?.contests || []
    if (!contests.length) {
      log(
        'no contests found for fixture list %s (may be completed)',
        fixture_list_id
      )
      continue
    }

    // pick the largest GPP (highest entry count)
    const sorted = [...contests].sort(
      (a, b) => (b.entry_count || 0) - (a.entry_count || 0)
    )
    const largest = sorted[0]

    if (!largest?.id) continue

    contest_inserts.push({
      source_contest_id: String(largest.id),
      source_id: 'FANDUEL',
      source_draft_group_id: String(fixture_list_id),
      contest_name: largest.name || largest.title,
      entry_fee: largest.entry_fee,
      entry_count: largest.entry_count || largest.size,
      max_entries: largest.max_entries || largest.size,
      game_type: largest.game_type || 'GPP',
      sport: 'NFL',
      year,
      week: null,
      is_guaranteed: largest.is_guaranteed || false
    })
  }

  log('discovered %d contests', contest_inserts.length)

  if (dry_run) {
    log('DRY RUN -- would insert %d contests', contest_inserts.length)
    if (contest_inserts.length) log(contest_inserts[0])
    return
  }

  if (contest_inserts.length) {
    await batch_insert({
      items: contest_inserts,
      batch_size: 100,
      save: async (batch) => {
        await db('dfs_contests')
          .insert(batch)
          .onConflict(['source_contest_id', 'source_id'])
          .merge()
      }
    })
    log('inserted/updated %d contests', contest_inserts.length)
  }
}

const import_ownership = async ({
  year,
  dry_run = false,
  fixture_list_id = null,
  week = null,
  sample_size = 2000
} = {}) => {
  let query = db('dfs_contests')
    .where({ source_id: 'FANDUEL', ownership_imported: false })

  if (fixture_list_id) {
    query = query.where('source_draft_group_id', String(fixture_list_id))
  }
  if (year) {
    query = query.where('year', year)
  }
  if (week) {
    query = query.where('week', week)
  }

  const contests = await query.orderBy('entry_count', 'desc')

  if (!contests.length) {
    log('no unimported FD contests found')
    return
  }

  log('found %d unimported contests', contests.length)

  await preload_active_players({
    all_players: true,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  const headers =
    await fanduel_dfs_session_manager.get_valid_dfs_session_headers()

  let total_ownership_records = 0
  let contests_processed = 0

  for (const contest of contests) {
    log(
      'processing contest %s: %s (entries: %d, fixture_list: %s)',
      contest.source_contest_id,
      contest.contest_name,
      contest.entry_count,
      contest.source_draft_group_id
    )

    // load fixture players for fanduel_id -> player mapping
    let fixture_player_index = new Map()
    if (contest.source_draft_group_id) {
      try {
        const fixture_data = await fanduel.get_dfs_fixture_players({
          fixture_id: contest.source_draft_group_id
        })
        if (fixture_data?.players) {
          for (const p of fixture_data.players) {
            fixture_player_index.set(String(p.id), p)
          }
        }
      } catch (err) {
        log(
          'could not load fixture players for %s: %s',
          contest.source_draft_group_id,
          err.message
        )
      }
    }

    let ownership_result
    try {
      ownership_result = await fanduel.compute_fanduel_ownership({
        contest_id: contest.source_contest_id,
        headers,
        sample_size
      })
    } catch (err) {
      log(
        'failed to compute ownership for contest %s: %s',
        contest.source_contest_id,
        err.message
      )
      continue
    }

    if (
      !ownership_result?.ownership ||
      ownership_result.ownership.length === 0
    ) {
      log('no ownership data for contest %s', contest.source_contest_id)
      continue
    }

    log(
      'computed ownership for %d players from %d sampled entries',
      ownership_result.total_players,
      ownership_result.total_entries_sampled
    )

    const ownership_inserts = []
    let matched = 0
    let unmatched = 0

    for (const row of ownership_result.ownership) {
      const fixture_player = fixture_player_index.get(
        String(row.fixture_player_id)
      )

      let player_row = null

      // try fanduel_id lookup first (fixture_player.id is the fanduel_id)
      const fd_id = fixture_player?.id || row.fixture_player_id
      if (fd_id) {
        try {
          player_row = find_player({
            fanduel_id: String(fd_id),
            ignore_free_agent: false,
            ignore_retired: false
          })
        } catch (err) {
          // ignore
        }
      }

      // fallback to name
      if (!player_row && fixture_player) {
        const name =
          `${fixture_player.first_name || ''} ${fixture_player.last_name || ''}`.trim()
        if (name) {
          try {
            player_row = find_player({
              name,
              ignore_free_agent: false,
              ignore_retired: false
            })
          } catch (err) {
            // ignore
          }
        }
      }

      if (!player_row) {
        unmatched++
        if (row.ownership_pct > 5) {
          log(
            'unmatched high-ownership fixture_player %s - %.1f%%',
            row.fixture_player_id,
            row.ownership_pct
          )
        }
        continue
      }

      matched++
      const display_name = fixture_player
        ? `${fixture_player.first_name || ''} ${fixture_player.last_name || ''}`.trim()
        : null

      ownership_inserts.push({
        pid: player_row.pid,
        source_contest_id: contest.source_contest_id,
        source_id: 'FANDUEL',
        source_draft_group_id: contest.source_draft_group_id,
        ownership_pct: row.ownership_pct,
        roster_position: fixture_player?.position || null,
        fpts: null,
        source_player_display_name: display_name,
        year: contest.year,
        week: contest.week
      })
    }

    log(
      'contest %s: matched %d, unmatched %d',
      contest.source_contest_id,
      matched,
      unmatched
    )

    if (dry_run) {
      log(
        'DRY RUN -- would insert %d ownership records',
        ownership_inserts.length
      )
      if (ownership_inserts.length) log(ownership_inserts[0])
      continue
    }

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

      total_ownership_records += ownership_inserts.length
    }

    if (ownership_inserts.length) {
      await db('dfs_contests')
        .where({
          source_contest_id: contest.source_contest_id,
          source_id: 'FANDUEL'
        })
        .update({
          ownership_imported: true,
          ownership_imported_at: new Date(),
          ownership_entry_sample_size: ownership_result.total_entries_sampled
        })
    }

    contests_processed++
    log(
      'contest %s ownership imported (%d records, %d sampled)',
      contest.source_contest_id,
      ownership_inserts.length,
      ownership_result.total_entries_sampled
    )
  }

  log(
    'completed: %d contests processed, %d total ownership records',
    contests_processed,
    total_ownership_records
  )
}

const import_fanduel_dfs_ownership = async ({
  dry_run = false,
  year,
  week,
  fixture_list_id,
  sample_size = 2000
} = {}) => {
  await discover_contests({ year, dry_run })
  await import_ownership({ year, week, dry_run, fixture_list_id, sample_size })
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const dry_run = argv.dry
    const fixture_list_id = argv.fixture_list_id
    const sample_size = argv.sample_size || 2000

    await handle_season_args_for_script({
      argv,
      script_name: 'import-fanduel-dfs-ownership',
      script_function: import_fanduel_dfs_ownership,
      year_query: async () => [{ year: current_season.year }],
      script_args: { dry_run, fixture_list_id, sample_size },
      season_only: true
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_FANDUEL_DFS_OWNERSHIP,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_fanduel_dfs_ownership
