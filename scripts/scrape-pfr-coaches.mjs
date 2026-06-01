// Scrape Pro-Football-Reference coach pages for full_name + DOB + first_season.
//
// Acquires the PFR-primary source-of-record for the nfl_coaches own-id
// migration (task: user:task/league/migrate-nfl-coaches-to-own-id.md).
//
// Mirrors the sandboxed-browser dispatch pattern used by
// import-team-rosters-pfr.mjs and import-pro-football-reference-player-ids.mjs:
// spawn /usr/local/bin/run-as-stealth-browser-node with the generic PFR
// browser-task; the browser-task returns raw HTML in pages.json; this script
// parses orchestrator-side with JSDOM. The browser-task cannot import
// #libs-shared (UID sandbox), so all parsing must happen here.
//
// Inputs:
//   - default: SELECT pfr_coach_id FROM nfl_coaches WHERE pfr_coach_id IS NOT NULL
//   - --ids <comma-list>: rescrape a specific subset (e.g. when samhoppen
//     surfaces a new id post-initial-scrape)
//   - --refresh: ignore the local HTML cache and re-fetch every requested id
//
// Local HTML cache: tmp/pfr-coaches-html/<pfr_coach_id>.{html|404|err}
//   - .html: successful fetch (parseable)
//   - .404: HTTP 404 sentinel (do not re-fetch on subsequent runs unless --refresh)
//   - .err: other fetch error sentinel (re-fetched on next run)
// Cache exists so a parse-side change or OOM does not force re-hitting PFR,
// and so incremental --ids rescrapes are cheap. Cache files are gitignored.
//
// Output: static-data/pfr-coaches.json -- [{pfr_coach_id, full_name, dob, first_season_pfr}]
//   - dob: ISO 'YYYY-MM-DD' or null
//   - first_season_pfr: smallint or null
//   - On HTTP 404 or parse failure: row is still emitted with null dob/full_name
//     and an entry is logged ([scrape] http-404 / missing-dob); downstream
//     Phase 0 disposition step categorizes the nulls.
//
// Rate-limit via CloakBrowser --wait-between-ms 5000 (12 req/min). Expected
// runtime for a full uncached 472-coach fetch: ~40 min. Cached re-runs are
// parse-only and complete in seconds.

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import * as cheerio from 'cheerio'

import db from '#db'

const log = debug('scrape-pfr-coaches')
debug.enable('scrape-pfr-coaches,pro-football-reference')

const BROWSER_TASK = path.resolve(
  import.meta.dirname,
  '../private/scripts/browser-tasks/pro-football-reference.mjs'
)
const SANDBOX_WRAPPER = '/usr/local/bin/run-as-stealth-browser-node'
const PRO_FOOTBALL_REFERENCE_URL = 'https://www.pro-football-reference.com'
const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  '../static-data/pfr-coaches.json'
)
const CACHE_DIR = path.resolve(import.meta.dirname, '../tmp/pfr-coaches-html')

const cache_paths = (pfr_coach_id) => ({
  html: path.join(CACHE_DIR, `${pfr_coach_id}.html`),
  not_found: path.join(CACHE_DIR, `${pfr_coach_id}.404`),
  error: path.join(CACHE_DIR, `${pfr_coach_id}.err`)
})

// Returns {kind: 'html'|'404'|'err'|'missing', html?, error?}
const read_cache = (pfr_coach_id) => {
  const p = cache_paths(pfr_coach_id)
  if (fs.existsSync(p.html))
    return { kind: 'html', html: fs.readFileSync(p.html, 'utf-8') }
  if (fs.existsSync(p.not_found)) return { kind: '404' }
  if (fs.existsSync(p.error))
    return { kind: 'err', error: fs.readFileSync(p.error, 'utf-8') }
  return { kind: 'missing' }
}

const write_cache_html = (pfr_coach_id, html) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cache_paths(pfr_coach_id).html, html, 'utf-8')
}
const write_cache_404 = (pfr_coach_id) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cache_paths(pfr_coach_id).not_found, '', 'utf-8')
}
const write_cache_err = (pfr_coach_id, msg) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cache_paths(pfr_coach_id).error, msg, 'utf-8')
}
const clear_cache_entries = (pfr_coach_id) => {
  const p = cache_paths(pfr_coach_id)
  for (const f of [p.html, p.not_found, p.error]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
}

const format_game_html = (html) => {
  const regex = /<div class="placeholder"><\/div>[^<]{0,10}<!--([\s\S]*?)-->/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const [full_match, comment] = match
    html = html.replace(full_match, comment)
  }
  return html
}

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12'
}

// Parse "October 25, 1973" or similar fallback DOB strings to ISO YYYY-MM-DD.
const parse_dob_text = (text) => {
  if (!text) return null
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/)
  if (!match) return null
  const month = MONTHS[match[1].toLowerCase()]
  if (!month) return null
  const day = String(match[2]).padStart(2, '0')
  const year = match[3]
  return `${year}-${month}-${day}`
}

const pick_text = ($, selectors) => {
  for (const sel of selectors) {
    const el = $(sel).first()
    if (el.length) {
      const t = el.text().trim()
      if (t) return t
    }
  }
  return null
}

const parse_coach_html = (html, pfr_coach_id) => {
  const formatted = format_game_html(html)
  const $ = cheerio.load(formatted)

  const full_name = pick_text($, [
    'h1[itemprop="name"] span',
    'h1[itemprop="name"]',
    '#meta h1 span',
    '#meta h1'
  ])

  let dob = null
  const birth_span = $('span[itemprop="birthDate"]').first()
  if (birth_span.length) {
    const data_birth = birth_span.attr('data-birth')
    if (data_birth && /^\d{4}-\d{2}-\d{2}$/.test(data_birth)) {
      dob = data_birth
    } else {
      dob = parse_dob_text(birth_span.text())
    }
  }
  if (!dob) {
    const meta = $('#meta').first()
    if (meta.length) {
      const born_match = meta.text().match(/Born:\s*([^\n]+)/i)
      if (born_match) dob = parse_dob_text(born_match[1])
    }
  }

  let first_season_pfr = null
  let stats_table = $('table#coach_stats').first()
  if (!stats_table.length) stats_table = $('table#coach_results').first()
  if (!stats_table.length) stats_table = $('table#coaching_history').first()
  if (stats_table.length) {
    const first_row = stats_table.find('tbody tr').first()
    if (first_row.length) {
      let year_cell = first_row.find('th[data-stat="year_id"]').first()
      if (!year_cell.length)
        year_cell = first_row.find('td[data-stat="year_id"]').first()
      if (!year_cell.length)
        year_cell = first_row.find('th[data-stat="year"]').first()
      if (!year_cell.length)
        year_cell = first_row.find('td[data-stat="year"]').first()
      if (year_cell.length) {
        const year_text = year_cell.text().trim().match(/\d{4}/)
        if (year_text) first_season_pfr = Number(year_text[0])
      }
    }
  }

  if (!full_name) log('[scrape] missing-name %s', pfr_coach_id)
  if (!dob) log('[scrape] missing-dob %s (%s)', pfr_coach_id, full_name || '?')

  return { full_name, dob, first_season_pfr }
}

// Spawn the browser-task for a subset of pfr_coach_ids and write each
// fetched HTML / 404 / error to the local cache. Caller already filtered
// to ids that need a fresh fetch.
const fetch_and_cache = async ({ pfr_coach_ids }) => {
  if (!pfr_coach_ids.length) {
    log('all requested ids are cached; skipping browser-task spawn')
    return { fetched: 0, http_404: 0, errors: 0 }
  }
  const tmp_dir = fs.mkdtempSync('/tmp/cb-pfr-coaches-')
  fs.chmodSync(tmp_dir, 0o777)
  log('handoff tempdir: %s', tmp_dir)

  const caller_label =
    process.env.CLOAKBROWSER_CALLER ||
    (process.env.JOB_PROJECT
      ? `job:${process.env.JOB_PROJECT}`
      : 'scrape-pfr-coaches')

  const url_file = path.join(tmp_dir, 'urls.txt')
  const urls = pfr_coach_ids.map(
    (id) => `${PRO_FOOTBALL_REFERENCE_URL}/coaches/${id}.htm`
  )
  fs.writeFileSync(url_file, urls.join('\n'), 'utf-8')

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

  let fetched = 0
  let http_404 = 0
  let errors = 0
  try {
    log(
      'spawning sandboxed browser task as _stealth-browser (%d coach URLs)',
      urls.length
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
    log('read %d pages from sandbox handoff; writing to cache', pages.length)

    const url_to_id = new Map(urls.map((u, i) => [u, pfr_coach_ids[i]]))
    for (const page_result of pages) {
      const pfr_coach_id = url_to_id.get(page_result.url)
      if (!pfr_coach_id) continue
      if (page_result.html) {
        write_cache_html(pfr_coach_id, page_result.html)
        fetched++
      } else if (page_result.error && /404/.test(page_result.error)) {
        write_cache_404(pfr_coach_id)
        http_404++
      } else {
        write_cache_err(pfr_coach_id, page_result.error || 'no HTML')
        errors++
      }
    }
  } finally {
    try {
      fs.rmSync(tmp_dir, { recursive: true, force: true })
    } catch (err) {
      log('handoff cleanup failed (non-fatal): %s', err.message)
    }
  }
  return { fetched, http_404, errors }
}

const load_existing_fixture = () => {
  if (!fs.existsSync(OUTPUT_PATH)) return new Map()
  try {
    const rows = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'))
    return new Map(rows.map((r) => [r.pfr_coach_id, r]))
  } catch (err) {
    log('existing fixture unreadable (%s); starting fresh', err.message)
    return new Map()
  }
}

const get_pfr_coach_ids = async ({ ids_override }) => {
  if (ids_override && ids_override.length) return ids_override
  const rows = await db('nfl_coaches')
    .whereNotNull('pfr_coach_id')
    .select('pfr_coach_id')
    .orderBy('pfr_coach_id')
  return rows.map((r) => r.pfr_coach_id)
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('ids', {
        type: 'string',
        describe:
          'Comma-separated pfr_coach_ids to (re)scrape; default = all from nfl_coaches'
      })
      .option('refresh', {
        type: 'boolean',
        default: false,
        describe:
          'Ignore the local HTML cache for the requested ids and re-fetch from PFR'
      })
      .help()
      .alias('help', 'h').argv

    const ids_override = argv.ids
      ? argv.ids
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null

    const pfr_coach_ids = await get_pfr_coach_ids({ ids_override })
    log(
      'processing %d coach ids (refresh=%s)',
      pfr_coach_ids.length,
      argv.refresh
    )

    // Always re-fetch error sentinels (transient failures); skip 404s and
    // .html files unless --refresh was passed.
    const needs_fetch = []
    for (const id of pfr_coach_ids) {
      if (argv.refresh) {
        clear_cache_entries(id)
        needs_fetch.push(id)
        continue
      }
      const entry = read_cache(id)
      if (entry.kind === 'missing' || entry.kind === 'err') needs_fetch.push(id)
    }
    log(
      'cache: %d cached / %d need fetch',
      pfr_coach_ids.length - needs_fetch.length,
      needs_fetch.length
    )

    const fetch_summary = await fetch_and_cache({ pfr_coach_ids: needs_fetch })

    const existing = load_existing_fixture()
    const results = new Map(existing)

    let http_404_count = 0
    let parse_fail_count = 0
    let null_dob_count = 0

    for (const pfr_coach_id of pfr_coach_ids) {
      const entry = read_cache(pfr_coach_id)
      if (entry.kind === '404') {
        log('[scrape] http-404 %s', pfr_coach_id)
        http_404_count++
        results.set(pfr_coach_id, {
          pfr_coach_id,
          full_name: null,
          dob: null,
          first_season_pfr: null
        })
        continue
      }
      if (entry.kind !== 'html') {
        log(
          '[scrape] fetch-error %s: %s',
          pfr_coach_id,
          entry.error || 'no HTML'
        )
        parse_fail_count++
        results.set(pfr_coach_id, {
          pfr_coach_id,
          full_name: null,
          dob: null,
          first_season_pfr: null
        })
        continue
      }
      try {
        const parsed = parse_coach_html(entry.html, pfr_coach_id)
        results.set(pfr_coach_id, { pfr_coach_id, ...parsed })
        if (!parsed.dob) null_dob_count++
      } catch (err) {
        log('[scrape] parse-error %s: %s', pfr_coach_id, err.message)
        parse_fail_count++
        results.set(pfr_coach_id, {
          pfr_coach_id,
          full_name: null,
          dob: null,
          first_season_pfr: null
        })
      }
    }

    const sorted = [...results.values()].sort((a, b) =>
      a.pfr_coach_id.localeCompare(b.pfr_coach_id)
    )
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2), 'utf-8')
    log(
      'wrote %d rows to %s (fetched=%d http_404=%d parse_fail=%d null_dob=%d)',
      sorted.length,
      OUTPUT_PATH,
      fetch_summary.fetched,
      http_404_count,
      parse_fail_count,
      null_dob_count
    )
  } catch (err) {
    error = err
    log(`Error: ${error.message}`)
    if (error.stack) log(error.stack)
  }

  process.exit(error ? 1 : 0)
}

main()
