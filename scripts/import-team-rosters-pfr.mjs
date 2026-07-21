import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { JSDOM } from 'jsdom'

import db from '#db'
import { active_nfl_teams } from '#private/libs-server/pro-football-reference.mjs'

const log = debug('import-team-rosters-pfr')
debug.enable('import-team-rosters-pfr,pro-football-reference,proxy-manager')

const BROWSER_TASK = path.resolve(
  import.meta.dirname,
  '../private/scripts/browser-tasks/pro-football-reference.mjs'
)
const SANDBOX_WRAPPER = '/usr/local/bin/run-as-stealth-browser-node'
const PRO_FOOTBALL_REFERENCE_URL = 'https://www.pro-football-reference.com'

// Mirrors the format_game_html function in the pfr lib to uncomment hidden tables
const format_game_html = (html) => {
  const regex = /<div class="placeholder"><\/div>[^<]{0,10}<!--([\s\S]*?)-->/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const [full_match, comment] = match
    html = html.replace(full_match, comment)
  }
  return html
}

/**
 * Parse a PFR team roster HTML page into player objects.
 * Mirrors parse_roster_table in private/libs-server/pro-football-reference.mjs.
 */
const parse_roster_html = (html, team, year) => {
  const formatted = format_game_html(html)
  const dom = new JSDOM(formatted)
  const doc = dom.window.document
  const roster_table = doc.querySelector('table#roster')
  if (!roster_table) {
    throw new Error(`no roster table found for ${team} ${year}`)
  }

  const players = []
  const rows = roster_table.querySelectorAll('tbody tr')

  for (const row of rows) {
    if (!row.querySelector('td[data-stat="player"]')) continue
    const player_link = row.querySelector('td[data-stat="player"] a')
    if (!player_link) continue

    const extract_text = (selector, convert_to_number = false) => {
      const element = row.querySelector(selector)
      const text = element ? element.textContent : null
      return convert_to_number ? (text ? Number(text) : null) : text
    }

    players.push({
      pfr_id: player_link.href.split('/').slice(-1)[0].split('.')[0],
      name: player_link.textContent,
      number: extract_text('th[data-stat="uniform_number"]', true),
      position: extract_text('td[data-stat="pos"]'),
      age: extract_text('td[data-stat="age"]', true),
      games_played: extract_text('td[data-stat="g"]', true) || 0,
      games_started: extract_text('td[data-stat="gs"]', true) || 0,
      weight: extract_text('td[data-stat="weight"]', true),
      height: extract_text('td[data-stat="height"]'),
      college: extract_text('td[data-stat="college_id"]'),
      birth_date: extract_text('td[data-stat="birth_date_mod"]'),
      experience: extract_text('td[data-stat="experience"]'),
      av: extract_text('td[data-stat="av"]', true) || 0,
      draft_info: extract_text('td[data-stat="draft_info"]'),
      team,
      year
    })
  }

  return players
}

/**
 * Run the sandboxed PFR browser task. Fetches all team roster URLs for the
 * given year via CloakBrowser and returns raw HTML pages array.
 */
const run_browser_task = async ({ year, ignore_cache = false }) => {
  const tmp_dir = fs.mkdtempSync('/tmp/cb-pfr-')
  fs.chmodSync(tmp_dir, 0o777)
  log('handoff tempdir: %s', tmp_dir)

  const caller_label =
    process.env.CLOAKBROWSER_CALLER ||
    (process.env.JOB_PROJECT
      ? `job:${process.env.JOB_PROJECT}`
      : 'import-team-rosters-pfr')

  // Write URL list to a temp file to avoid shell arg length limits
  const url_file = path.join(tmp_dir, 'urls.txt')
  const roster_urls = active_nfl_teams.map(
    (team) => `${PRO_FOOTBALL_REFERENCE_URL}/teams/${team}/${year}_roster.htm`
  )
  fs.writeFileSync(url_file, roster_urls.join('\n'), 'utf-8')

  const args = [
    BROWSER_TASK,
    '--out-dir',
    tmp_dir,
    '--url-file',
    url_file,
    '--wait-between-ms',
    '5000',
    '--caller-label',
    caller_label
  ]
  if (ignore_cache) args.push('--ignore-cache')

  try {
    log(
      'spawning sandboxed browser task as _stealth-browser (%d roster URLs)',
      roster_urls.length
    )
    await new Promise((resolve, reject) => {
      const child = spawn(SANDBOX_WRAPPER, args, {
        stdio: ['ignore', 'inherit', 'inherit']
      })
      child.on('error', reject)
      child.on('exit', (code, signal) => {
        if (signal)
          return reject(new Error(`browser-task killed by signal ${signal}`))
        if (code !== 0)
          return reject(new Error(`browser-task exited with code ${code}`))
        resolve()
      })
    })

    const out_path = path.join(tmp_dir, 'pages.json')
    if (!fs.existsSync(out_path)) {
      throw new Error(`browser-task did not produce ${out_path}`)
    }
    const pages = JSON.parse(fs.readFileSync(out_path, 'utf-8'))
    log('read %d pages from sandbox handoff', pages.length)
    return { pages, roster_urls }
  } finally {
    try {
      fs.rmSync(tmp_dir, { recursive: true, force: true })
    } catch (err) {
      log('handoff cleanup failed (non-fatal): %s', err.message)
    }
  }
}

const get_all_rosters = async ({ year, ignore_cache = false }) => {
  const { pages, roster_urls } = await run_browser_task({ year, ignore_cache })

  const rosters = []
  for (let i = 0; i < active_nfl_teams.length; i++) {
    const team = active_nfl_teams[i]
    const url = roster_urls[i]
    const page_result = pages.find((p) => p.url === url)

    if (!page_result || !page_result.html) {
      log(
        'failed to get roster page for %s %d: %s',
        team,
        year,
        page_result?.error || 'no HTML'
      )
      continue
    }

    try {
      const players = parse_roster_html(page_result.html, team, year)
      rosters.push(...players)
      log('parsed %d players for %s %d', players.length, team, year)
    } catch (err) {
      log('error parsing roster for %s %d: %s', team, year, err.message)
    }
  }

  return rosters
}

const save_rosters = async ({ rosters, year }) => {
  if (!rosters.length) {
    log('No rosters to save')
    return { update_count: 0, missing_count: 0 }
  }

  // Get all pfr_ids from the rosters
  const pfr_ids = rosters
    .map((roster_player) => roster_player.pfr_id)
    .filter(Boolean)

  if (!pfr_ids.length) {
    log('No valid PFR IDs found in roster data')
    return { update_count: 0, missing_count: 0 }
  }

  // Get existing players with these pfr_ids
  const existing_players = await db('player')
    .whereIn('pfr_player_id', pfr_ids)
    .select('pid', 'pfr_player_id')
  const players_by_pfr_id = {}
  for (const player of existing_players) {
    players_by_pfr_id[player.pfr_player_id] = player
  }

  let update_count = 0
  let missing_count = 0

  // Use a transaction for database operations
  await db.transaction(async (trx) => {
    for (const roster_player of rosters) {
      // If we found a matching player, update their season value in player_seasonlogs
      const matching_player = players_by_pfr_id[roster_player.pfr_id]
      if (matching_player && roster_player.av) {
        // Insert or update player_seasonlogs with the PFR season value
        await trx('player_seasonlogs')
          .where({
            pid: matching_player.pid,
            year,
            seas_type: 'REG'
          })
          .update({
            pfr_season_value: roster_player.av
          })

        update_count++
      } else if (roster_player.pfr_id && !matching_player) {
        log(
          `No matching player found for PFR ID ${roster_player.pfr_id} (${roster_player.name})`
        )
        missing_count++
      }
    }
  })

  log(`Updated season values for ${update_count} players`)
  log(`Missing players: ${missing_count}`)

  return { update_count, missing_count }
}

const validate_args = (argv) => {
  if (argv.year) {
    return { valid: true }
  }

  if (argv.start_year && argv.end_year) {
    if (argv.start_year > argv.end_year) {
      return {
        valid: false,
        message: 'start_year must be less than or equal to end_year'
      }
    }
    return { valid: true }
  }

  return {
    valid: false,
    message: 'Either --year or both --start_year and --end_year are required'
  }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        alias: 'y',
        type: 'number',
        description: 'Year to import rosters for'
      })
      .option('start_year', {
        alias: 's',
        type: 'number',
        description: 'Start year for importing multiple years'
      })
      .option('end_year', {
        alias: 'e',
        type: 'number',
        description: 'End year for importing multiple years'
      })
      .option('ignore_cache', {
        alias: 'i',
        type: 'boolean',
        description: 'Ignore cache',
        default: false
      })
      .help()
      .alias('help', 'h').argv

    const validation = validate_args(argv)
    if (!validation.valid) {
      throw new Error(validation.message)
    }

    if (argv.year) {
      log(`Importing rosters for year: ${argv.year}`)
      const rosters = await get_all_rosters({
        year: argv.year,
        ignore_cache: argv.ignore_cache
      })
      await save_rosters({ rosters, year: argv.year })
    } else if (argv.start_year && argv.end_year) {
      log(`Importing rosters for years: ${argv.start_year} to ${argv.end_year}`)
      for (let year = argv.start_year; year <= argv.end_year; year++) {
        log(`Processing year ${year}...`)
        const rosters = await get_all_rosters({
          year,
          ignore_cache: argv.ignore_cache
        })
        await save_rosters({ rosters, year })
      }
    }
  } catch (err) {
    error = err
    log(`Error: ${error.message}`)
    if (error.stack) {
      log(error.stack)
    }
  }

  process.exit(error ? 1 : 0)
}

main()
