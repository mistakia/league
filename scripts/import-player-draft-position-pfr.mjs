import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { JSDOM } from 'jsdom'

import db from '#db'
import { current_season } from '#constants'
import { is_main, updatePlayer, find_player_row } from '#libs-server'
import { fixTeam } from '#libs-shared'
import { create_logger } from '#libs-shared/log.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const signal_log = create_logger('import-player-draft-position-pfr', {
  service: 'league-imports'
})

const BROWSER_TASK = path.resolve(
  import.meta.dirname,
  '../private/scripts/browser-tasks/pro-football-reference.mjs'
)
const SANDBOX_WRAPPER = '/usr/local/bin/run-as-stealth-browser-node'
const PRO_FOOTBALL_REFERENCE_URL = 'https://www.pro-football-reference.com'

/**
 * Run the sandboxed PFR browser task. Fetches the given URL(s) via CloakBrowser
 * (handles Cloudflare challenges) and returns raw HTML pages array.
 */
const run_browser_task = async ({ urls, ignore_cache = false }) => {
  const tmp_dir = fs.mkdtempSync('/tmp/cb-pfr-')
  fs.chmodSync(tmp_dir, 0o777)
  log('handoff tempdir: %s', tmp_dir)

  const caller_label =
    process.env.CLOAKBROWSER_CALLER ||
    (process.env.JOB_PROJECT
      ? `job:${process.env.JOB_PROJECT}`
      : 'import-player-draft-position-pfr')

  const args = [
    BROWSER_TASK,
    '--out-dir',
    tmp_dir,
    '--caller-label',
    caller_label
  ]
  for (const url of urls) {
    args.push('--url', url)
  }
  if (ignore_cache) args.push('--ignore-cache')

  try {
    log('spawning sandboxed browser task as _stealth-browser')
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
    return pages
  } finally {
    try {
      fs.rmSync(tmp_dir, { recursive: true, force: true })
    } catch (err) {
      log('handoff cleanup failed (non-fatal): %s', err.message)
    }
  }
}

/**
 * Parse PFR draft page HTML into draft player objects.
 * Mirrors the parsing logic in private/libs-server/pro-football-reference.mjs.
 */
const parse_draft_html = (html, year) => {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const draft_players = []
  const rows = doc.querySelectorAll('#drafts tbody tr:not(.thead)')

  for (const row of rows) {
    const round_el = row.querySelector('[data-stat="draft_round"]')
    const pick_el = row.querySelector('[data-stat="draft_pick"]')
    const team_el = row.querySelector('[data-stat="team"] a')
    const player_el = row.querySelector('[data-stat="player"] a')
    const pos_el = row.querySelector('[data-stat="pos"]')

    if (!round_el || !pick_el) continue

    const round = Number(round_el.textContent)
    const overall_pick = Number(pick_el.textContent)
    if (!round || !overall_pick) continue

    const team = team_el ? fixTeam(team_el.textContent) : null
    const player_name = player_el
      ? player_el.textContent
      : row.querySelector('[data-stat="player"]')?.textContent || ''
    const pfr_id = player_el
      ? player_el.getAttribute('href').split('/').pop().replace('.htm', '')
      : null
    const draft_position = pos_el?.textContent || null

    const all_pro_first_team_selections = Number(
      row.querySelector('[data-stat="all_pros_first_team"]')?.textContent || 0
    )
    const pro_bowl_selections = Number(
      row.querySelector('[data-stat="pro_bowls"]')?.textContent || 0
    )
    const years_as_primary_starter = Number(
      row.querySelector('[data-stat="years_as_primary_starter"]')
        ?.textContent || 0
    )
    const pfr_weighted_career_approximate_value = Number(
      row.querySelector('[data-stat="career_av"]')?.textContent || 0
    )
    const pfr_weighted_career_approximate_value_drafted_team = Number(
      row.querySelector('[data-stat="draft_av"]')?.textContent || 0
    )
    const college_link = row.querySelector('[data-stat="college_id"] a')
    const college_team = college_link ? college_link.textContent : null

    draft_players.push({
      round,
      overall_pick,
      team,
      player_name,
      pfr_id,
      draft_position,
      all_pro_first_team_selections,
      pro_bowl_selections,
      years_as_primary_starter,
      pfr_weighted_career_approximate_value,
      pfr_weighted_career_approximate_value_drafted_team,
      college_team
    })
  }

  return draft_players
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-player-draft-position-pfr')
debug.enable(
  'import-player-draft-position-pfr,update-player,get-player,pro-football-reference'
)

const import_player_draft_position_pfr = async ({
  year = current_season.year,
  ignore_cache = false,
  dry = false
} = {}) => {
  const draft_url = `${PRO_FOOTBALL_REFERENCE_URL}/years/${year}/draft.htm`
  const pages = await run_browser_task({ urls: [draft_url], ignore_cache })

  const page_result = pages.find((p) => p.url === draft_url)
  if (!page_result || !page_result.html) {
    throw new Error(
      `browser-task failed to fetch draft page for ${year}: ${page_result?.error || 'no HTML'}`
    )
  }

  const draft_players = parse_draft_html(page_result.html, year)

  log(`Importing ${draft_players.length} draft players for ${year}`)

  // Oracle: zero parsed rows is indistinguishable from "PFR draft page not
  // yet populated" (early-cycle) and "browser-task returned the Cloudflare
  // challenge HTML instead of the page" (silent scrape failure). Treat any
  // zero-row outcome on a year that should be drafted (year <= current_season.year)
  // as an alertable failure. Callers re-running for a future-year board
  // (year > current_season.year) can suppress via --allow-zero.
  if (draft_players.length === 0 && !dry) {
    const html_len = page_result.html ? page_result.html.length : 0
    const message = `PFR draft scrape for ${year} parsed 0 rows (HTML ${html_len} bytes). Likely Cloudflare challenge returned unsolved; check browser-task selector / cloakbrowser version.`
    if (year <= current_season.year) {
      const emitted = signal_log.error(new Error(message), {
        severity: 'high',
        context: {
          year,
          html_bytes: html_len,
          url: draft_url
        }
      })
      if (emitted?.promise) {
        await emitted.promise
      }
      throw new Error(message)
    } else {
      log(`zero-row outcome accepted for future year ${year}: ${message}`)
    }
  }

  // In dry run mode, output the first draft player and exit
  if (dry && draft_players.length > 0) {
    const first_player = draft_players[0]
    log('Dry run mode - Sample player data:')
    log(JSON.stringify(first_player, null, 2))
    return {
      draft_players_count: draft_players.length,
      sample_player: first_player
    }
  }

  const pfr_ids = draft_players.map((player) => player.pfr_id)
  const players = await db('player').whereIn('pfr_id', pfr_ids)

  const players_map = {}
  for (const player_row of players) {
    players_map[player_row.pfr_id] = player_row
  }
  const missing_players = []

  for (const draft_player of draft_players) {
    let player_row = players_map[draft_player.pfr_id]

    if (!player_row) {
      try {
        const params = {
          name: draft_player.player_name,
          team: draft_player.team,
          nfl_draft_year: year
        }
        player_row = await find_player_row(params)
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      missing_players.push(draft_player)
      continue
    }

    // Create update object with PFR draft data fields
    // Note: College team data is available from PFR but not included for now
    // TODO: Consider including college team data in a future update
    const update = {
      round: draft_player.round,
      dpos: draft_player.overall_pick,
      pfr_id: draft_player.pfr_id,
      all_pro_first_team_selections: draft_player.all_pro_first_team_selections,
      pro_bowl_selections: draft_player.pro_bowl_selections,
      pfr_years_as_primary_starter: draft_player.years_as_primary_starter,
      pfr_weighted_career_approximate_value:
        draft_player.pfr_weighted_career_approximate_value,
      pfr_draft_team_approximate_value:
        draft_player.pfr_weighted_career_approximate_value_drafted_team
    }

    // No need to check for changes as that's handled by update-player.mjs
    await updatePlayer({
      player_row,
      update
    })
  }

  log(`missing players: ${missing_players.length}`)
  return { missing_players_count: missing_players.length }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_player_draft_position_pfr({
      year: argv.year,
      ignore_cache: argv.ignore_cache,
      dry: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_player_draft_position_pfr
