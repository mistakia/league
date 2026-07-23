/**
 * Validate Historical Injury Index (population-level smoke tests)
 *
 * Runs against league_production after a backfill or rebuild. Asserts:
 *  1. Per-year row-count floor (year >= 2016 > 20k rows; 2009-2015 > 10k).
 *  2. Changelog coverage rate > 0 for every year 2021+.
 *  3. Practice coverage > 100 distinct PIDs for every year 2009-2025.
 *  4. Mean source_concurrence > 1.0 for every year 2021+ on rows with
 *     missed_reason set.
 *
 * Exit non-zero on any assertion failure so the cron error path
 * (report_job + signal queue) catches regressions.
 *
 * Usage:
 *   NODE_ENV=production node scripts/validate-historical-injury-index.mjs
 */

import debug from 'debug'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('validate-historical-injury-index')
debug.enable('validate-historical-injury-index')

const validate = async () => {
  const failures = []

  // 1. Row-count floor per year.
  const counts = await db('historical_injury_index')
    .select('season_year')
    .count({ c: '*' })
    .groupBy('season_year')
    .orderBy('season_year')
  log(`row counts by year: ${counts.length} years`)
  for (const { season_year: year, c } of counts) {
    const n = Number(c)
    const floor = year >= 2016 ? 20000 : 10000
    log(`  ${year}: ${n} (floor ${floor})`)
    if (n < floor) failures.push(`year ${year}: ${n} rows < ${floor} floor`)
  }

  // 2. Changelog coverage rate > 0 for 2021+.
  const cl_rates = await db('historical_injury_index')
    .select('season_year')
    .avg({
      r: db.raw('CASE WHEN changelog_injury_event THEN 1.0 ELSE 0.0 END')
    })
    .where('season_year', '>=', 2021)
    .groupBy('season_year')
    .orderBy('season_year')
  for (const { season_year: year, r } of cl_rates) {
    const rate = Number(r)
    log(`  changelog-event rate ${year}: ${(rate * 100).toFixed(1)}%`)
    if (rate <= 0)
      failures.push(
        `year ${year}: changelog_injury_event rate = 0 (join not firing)`
      )
  }

  // 3. Practice coverage > 100 distinct PIDs per year.
  const practice_pids = await db('historical_injury_index')
    .select('season_year')
    .countDistinct({ c: 'pid' })
    .where('practice_listed_injury', true)
    .groupBy('season_year')
    .orderBy('season_year')
  for (const { season_year: year, c } of practice_pids) {
    const n = Number(c)
    log(`  practice-listed distinct pids ${year}: ${n}`)
    if (n <= 100)
      failures.push(`year ${year}: only ${n} practice-listed PIDs (floor 100)`)
  }

  // 4. Mean source_concurrence > 1.0 on missed rows for 2021+.
  const conc = await db('historical_injury_index')
    .select('season_year')
    .avg({ a: 'source_concurrence' })
    .whereNotNull('missed_reason')
    .andWhere('season_year', '>=', 2021)
    .groupBy('season_year')
    .orderBy('season_year')
  for (const { season_year: year, a } of conc) {
    const avg = Number(a)
    log(`  mean source_concurrence on missed rows ${year}: ${avg.toFixed(2)}`)
    if (avg <= 1.0)
      failures.push(
        `year ${year}: mean source_concurrence ${avg.toFixed(2)} <= 1.0`
      )
  }

  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(`  - ${f}`)
    process.exit(1)
  }
  log('all population-level assertions passed')
  process.exit(0)
}

if (is_main(import.meta.url)) {
  validate().catch((err) => {
    log(err)
    process.exit(1)
  })
}

export default validate
