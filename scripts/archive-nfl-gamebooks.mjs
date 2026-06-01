/**
 * Archive NFL Gamebook PDFs
 *
 * Downloads pregame-declared starter sheets ("gamebooks") from
 * https://static.www.nfl.com/image/upload/gamecenter/{shieldid}.pdf
 * to /root/cache/nfl/gamebook/{esbid}.pdf for every nfl_games row
 * with a populated shieldid in the requested year range.
 *
 * Usage:
 *   node scripts/archive-nfl-gamebooks.mjs --year 2024
 *   node scripts/archive-nfl-gamebooks.mjs --start_year 2002 --end_year 2025
 *   node scripts/archive-nfl-gamebooks.mjs --year 2024 --week 1
 *   node scripts/archive-nfl-gamebooks.mjs --year 2024 --ignore_cache
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, report_job, wait } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('archive-nfl-gamebooks')
debug.enable('archive-nfl-gamebooks')

const stream_pipeline = promisify(pipeline)

const GAMEBOOK_URL = (shieldid) =>
  `https://static.www.nfl.com/image/upload/gamecenter/${shieldid}.pdf`

const cache_path_for = (esbid) =>
  path.join(os.homedir(), 'cache/nfl/gamebook', `${esbid}.pdf`)

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('week', { type: 'number' })
    .option('ignore_cache', { type: 'boolean', default: false })
    .option('dry_run', { type: 'boolean', default: false }).argv

const fetch_pdf = async ({ url, max_retries = 3 }) => {
  let last_error
  for (let attempt = 0; attempt <= max_retries; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 404) return { status: 404, body: null }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return { status: 200, body: response.body }
    } catch (err) {
      last_error = err
      if (attempt < max_retries) {
        await wait(1000 * Math.pow(2, attempt))
      }
    }
  }
  throw last_error
}

const archive_year = async ({ year, week, ignore_cache, dry_run }) => {
  const query = db('nfl_games')
    .select('esbid', 'shieldid', 'seas_type', 'week')
    .where({ year })
    .whereNotNull('shieldid')
  if (week !== undefined) query.where({ week })

  const games = await query
  log(`${year}${week !== undefined ? ` W${week}` : ''}: ${games.length} games with shieldid`)

  const counts = { found: games.length, cached: 0, downloaded: 0, not_found: 0, errored: 0 }
  const dest_dir = path.join(os.homedir(), 'cache/nfl/gamebook')
  if (!dry_run) fs.mkdirSync(dest_dir, { recursive: true })

  for (const game of games) {
    const dest = cache_path_for(game.esbid)
    if (!ignore_cache && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      counts.cached += 1
      continue
    }

    if (dry_run) {
      counts.downloaded += 1
      continue
    }

    try {
      const result = await fetch_pdf({ url: GAMEBOOK_URL(game.shieldid) })
      if (result.status === 404) {
        counts.not_found += 1
        log(`404 ${game.esbid} (${game.seas_type} W${game.week}) shieldid=${game.shieldid}`)
        continue
      }
      const tmp = `${dest}.tmp`
      await stream_pipeline(result.body, fs.createWriteStream(tmp))
      fs.renameSync(tmp, dest)
      counts.downloaded += 1
    } catch (err) {
      counts.errored += 1
      log(`error ${game.esbid}: ${err.message}`)
    }
  }

  log(`${year}: ${JSON.stringify(counts)}`)
  return counts
}

const archive_nfl_gamebooks = async ({
  year,
  start_year,
  end_year,
  week,
  ignore_cache = false,
  dry_run = false
}) => {
  const years = []
  if (start_year && end_year) {
    if (start_year > end_year) {
      throw new Error(`start_year ${start_year} > end_year ${end_year}`)
    }
    for (let y = start_year; y <= end_year; y++) years.push(y)
  } else {
    years.push(year || current_season.year)
  }

  const totals = { found: 0, cached: 0, downloaded: 0, not_found: 0, errored: 0 }
  for (const y of years) {
    const c = await archive_year({ year: y, week, ignore_cache, dry_run })
    for (const k of Object.keys(totals)) totals[k] += c[k]
  }

  log(`totals across ${years.length} year(s): ${JSON.stringify(totals)}`)

  const processed = totals.cached + totals.downloaded + totals.not_found + totals.errored
  const shortfall =
    totals.found > 0 && processed !== totals.found
      ? `archive-nfl-gamebooks: processed ${processed}/${totals.found} games`
      : totals.errored > Math.max(5, totals.found * 0.01)
        ? `archive-nfl-gamebooks: ${totals.errored} non-404 errors (>1% of ${totals.found})`
        : null
  return { shortfall, totals }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await archive_nfl_gamebooks({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      week: argv.week,
      ignore_cache: argv.ignore_cache,
      dry_run: argv.dry_run
    })
    if (result.shortfall) throw new Error(result.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.ARCHIVE_NFL_GAMEBOOKS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default archive_nfl_gamebooks
