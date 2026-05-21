import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

import db from '#db'
import { is_main, report_job, batch_insert, draftkings } from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { draftkings_session_manager } from '#private/libs-server/draftkings/draftkings-session-manager.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const BROWSER_TASK = path.resolve(
  import.meta.dirname,
  '../private/scripts/browser-tasks/draftkings.mjs'
)
const SANDBOX_WRAPPER = '/usr/local/bin/run-as-stealth-browser-node'

/**
 * Run the sandboxed DraftKings browser task. The same sandbox call captures
 * session cookies (page.route() interception) AND -- if contest_ids is
 * supplied -- downloads the per-contest CSVs inside the same persistent
 * context. The Playwright BrowserContext cannot cross processes, so the
 * CSV-download phase must stay co-resident with the cookie capture.
 *
 * Returns { cookies, tmp_dir, csv_files } -- the orchestrator owns the
 * tmp_dir lifetime and reads CSVs by name (contest-<id>.csv) before
 * cleaning up.
 */
const run_browser_task = async ({ contest_ids = [] } = {}) => {
  const tmp_dir = fs.mkdtempSync('/tmp/cb-draftkings-')
  fs.chmodSync(tmp_dir, 0o777)
  log('handoff tempdir: %s', tmp_dir)

  const caller_label =
    process.env.CLOAKBROWSER_CALLER ||
    (process.env.JOB_PROJECT ? `job:${process.env.JOB_PROJECT}` : 'import-draftkings-dfs-ownership')

  const args = [
    BROWSER_TASK,
    '--out-dir', tmp_dir,
    '--caller-label', caller_label
  ]
  if (contest_ids.length) {
    args.push('--contest-ids', contest_ids.join(','))
  }

  log('spawning sandboxed browser task as _stealth-browser (contests=%d)', contest_ids.length)
  await new Promise((resolve, reject) => {
    const child = spawn(SANDBOX_WRAPPER, args, {
      stdio: ['ignore', 'inherit', 'inherit']
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`browser-task killed by signal ${signal}`))
      if (code !== 0) return reject(new Error(`browser-task exited with code ${code}`))
      resolve()
    })
  })

  const out_path = path.join(tmp_dir, 'session_cookies.json')
  if (!fs.existsSync(out_path)) {
    fs.rmSync(tmp_dir, { recursive: true, force: true })
    throw new Error(`browser-task did not produce ${out_path}`)
  }
  const cookies = JSON.parse(fs.readFileSync(out_path, 'utf-8'))
  log('read DK session cookies from sandbox handoff')

  await draftkings_session_manager.store_draftkings_session_data({
    cookies,
    is_session_valid: true
  })
  log('DraftKings session cookies persisted to DB')

  return { cookies, tmp_dir }
}

const log = debug('import-draftkings-dfs-ownership')
debug.enable(
  'import-draftkings-dfs-ownership,draft-kings:dfs:api,draftkings-session-manager'
)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const discover_contests = async ({ year, dry_run = false }) => {
  log('discovering DraftKings NFL contests for year %d', year)

  const lobby_contests = await draftkings.get_draftkings_nfl_lobby_contests()
  log('found %d Classic NFL contests in lobby', lobby_contests.length)

  if (!lobby_contests.length) {
    log('no contests found in lobby -- lobby only shows active contests')
    return
  }

  // load existing draft groups from player_salaries for this year
  const salary_draft_groups = await db('player_salaries')
    .where({ source_id: 'DRAFTKINGS' })
    .whereNotNull('source_contest_id')
    .select('source_contest_id')
    .groupBy('source_contest_id')

  const known_draft_group_ids = new Set(
    salary_draft_groups.map((r) => String(r.source_contest_id))
  )

  const contest_inserts = []
  for (const contest of lobby_contests) {
    const draft_group_id = String(contest.dg)

    // only import contests matching known draft groups (i.e. we have salary data)
    if (!known_draft_group_ids.has(draft_group_id)) {
      log(
        'skipping contest %d -- draft group %s not in salary data',
        contest.id,
        draft_group_id
      )
      continue
    }

    const is_guaranteed =
      contest.attr?.IsGuaranteed === 'true' ||
      contest.attr?.IsGuranteed === 'true'

    // parse start date from DK format /Date(ms)/
    let start_date = null
    if (contest.sd) {
      const ms_match = String(contest.sd).match(/\/Date\((\d+)\)\//)
      if (ms_match) {
        start_date = new Date(parseInt(ms_match[1], 10))
      }
    }

    contest_inserts.push({
      source_contest_id: String(contest.id),
      source_id: 'DRAFTKINGS',
      source_draft_group_id: draft_group_id,
      contest_name: contest.n,
      entry_fee: contest.a,
      entry_count: contest.ec,
      max_entries: contest.m,
      game_type: contest.gameType || 'Classic',
      sport: 'NFL',
      year,
      week: null, // will be filled from nfl_games if needed
      start_date,
      is_guaranteed
    })
  }

  log('matched %d contests to known draft groups', contest_inserts.length)

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
    log(
      'inserted/updated %d contests into dfs_contests',
      contest_inserts.length
    )
  }
}

const import_ownership = async ({
  year,
  dry_run = false,
  contest_id = null,
  week = null
} = {}) => {
  // load unimported DK contests
  let query = db('dfs_contests').where({
    source_id: 'DRAFTKINGS',
    ownership_imported: false
  })

  if (contest_id) {
    query = query.where('source_contest_id', String(contest_id))
  }
  if (year) {
    query = query.where('year', year)
  }
  if (week) {
    query = query.where('week', week)
  }

  const contests = await query.orderBy('entry_count', 'desc')

  if (!contests.length) {
    log('no unimported DK contests found')
    return
  }

  log('found %d unimported contests to process', contests.length)

  await preload_active_players({
    all_players: true,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  // Single sandboxed pass: captures session cookies AND downloads each
  // contest CSV inside the same _stealth-browser BrowserContext. The CSVs
  // land in the handoff tempdir as contest-<id>.csv; the orchestrator
  // reads them by name below.
  const contest_ids = contests.map((c) => c.source_contest_id)
  log('capturing DraftKings session + downloading %d contest CSVs via sandboxed browser task', contest_ids.length)
  const { tmp_dir } = await run_browser_task({ contest_ids })

  let total_ownership_records = 0
  let contests_processed = 0
  const draftables_cache = new Map()

  try {
    for (const contest of contests) {
      log(
        'processing contest %s: %s (entries: %d, draft_group: %s)',
        contest.source_contest_id,
        contest.contest_name,
        contest.entry_count,
        contest.source_draft_group_id
      )

      const csv_path = path.join(tmp_dir, `contest-${contest.source_contest_id}.csv`)
      if (!fs.existsSync(csv_path)) {
        log(
          'no CSV produced by sandbox for contest %s -- skipping',
          contest.source_contest_id
        )
        continue
      }
      const csv_text = fs.readFileSync(csv_path, 'utf-8')

      if (!csv_text || csv_text.trim().length === 0) {
        log('empty CSV for contest %s -- skipping', contest.source_contest_id)
        continue
      }

      const ownership_rows = draftkings.parse_draftkings_ownership_csv({
        csv_text
      })
      log(
        'parsed %d ownership rows from contest %s',
        ownership_rows.length,
        contest.source_contest_id
      )

      if (!ownership_rows.length) {
        continue
      }

      // load draftables for this draft group to build name -> dk_id index (cached across contests)
      let draftables_index = draftables_cache.get(contest.source_draft_group_id)
      if (!draftables_index && contest.source_draft_group_id) {
        draftables_index = new Map()
        try {
          const draftables_data =
            await draftkings.get_draftkings_draft_group_draftables({
              draft_group_id: contest.source_draft_group_id
            })
          if (draftables_data?.draftables) {
            for (const d of draftables_data.draftables) {
              const full_name = `${d.firstName} ${d.lastName}`
              draftables_index.set(full_name, d.playerDkId)
            }
          }
        } catch (err) {
          log(
            'could not load draftables for draft group %s: %s',
            contest.source_draft_group_id,
            err.message
          )
        }
        draftables_cache.set(contest.source_draft_group_id, draftables_index)
      }
      if (!draftables_index) {
        draftables_index = new Map()
      }

      const ownership_inserts = []
      let matched = 0
      let unmatched = 0

      for (const row of ownership_rows) {
        let player_row = null

        // try by DK ID from draftables first
        const dk_id = draftables_index.get(row.player_name)
        if (dk_id) {
          try {
            player_row = find_player({
              draftkings_id: dk_id,
              ignore_free_agent: false,
              ignore_retired: false
            })
          } catch (err) {
            // ignore
          }
        }

        // fallback to name match
        if (!player_row) {
          try {
            player_row = find_player({
              name: row.player_name,
              ignore_free_agent: false,
              ignore_retired: false
            })
          } catch (err) {
            // ignore
          }
        }

        if (!player_row) {
          unmatched++
          log('unmatched player: %s', row.player_name)
          continue
        }

        matched++
        ownership_inserts.push({
          pid: player_row.pid,
          source_contest_id: contest.source_contest_id,
          source_id: 'DRAFTKINGS',
          source_draft_group_id: contest.source_draft_group_id,
          ownership_pct: row.ownership_pct,
          roster_position: row.roster_position,
          fpts: row.fpts,
          source_player_display_name: row.player_name,
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

      // mark contest as imported only if we matched players
      if (ownership_inserts.length) {
        await db('dfs_contests')
          .where({
            source_contest_id: contest.source_contest_id,
            source_id: 'DRAFTKINGS'
          })
          .update({
            ownership_imported: true,
            ownership_imported_at: new Date()
          })
      }

      contests_processed++
      log(
        'contest %s ownership imported (%d records)',
        contest.source_contest_id,
        ownership_inserts.length
      )
    }
  } finally {
    try {
      fs.rmSync(tmp_dir, { recursive: true, force: true })
    } catch (err) {
      log('handoff cleanup failed (non-fatal): %s', err.message)
    }
  }

  log(
    'completed: %d contests processed, %d total ownership records',
    contests_processed,
    total_ownership_records
  )
}

const import_draftkings_dfs_ownership = async ({
  dry_run = false,
  year,
  week,
  contest_id,
  discover_only = false
} = {}) => {
  // Phase 1: discover contests from lobby
  await discover_contests({ year, dry_run })

  if (discover_only) {
    log('discover_only mode -- skipping ownership import')
    return
  }

  // Phase 2: import ownership from unimported contests
  await import_ownership({ year, week, dry_run, contest_id })
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const dry_run = argv.dry
    const contest_id = argv.contest_id
    const discover_only = argv.discover_only

    await handle_season_args_for_script({
      argv,
      script_name: 'import-draftkings-dfs-ownership',
      script_function: import_draftkings_dfs_ownership,
      year_query: async () => [{ year: current_season.year }],
      script_args: { dry_run, contest_id, discover_only },
      season_only: true
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_DRAFTKINGS_DFS_OWNERSHIP,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_draftkings_dfs_ownership
