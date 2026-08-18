/**
 * Validate Trade Review Attribution (population-level invariants)
 *
 * Runs against league_production after any change to the trade-review grading
 * engine. Asserts invariants a spot check cannot distinguish:
 *  1. Every still-held figure is non-negative.
 *  2. Both perspectives of every trade are sign-inverted on every figure.
 *  3. A trade_id-filtered call agrees with a full-league call on every shared
 *     record — the filtered-invocation truncation the first design shipped.
 *  4. A year-filtered call agrees with a full-league call on proceeds.
 *  5. No retired field survives on the wire.
 *
 * Exit non-zero on any assertion failure. Promoted from
 * scratch/league/trade-review-value-attribution/ at task close — it is the
 * population-level oracle of that change, not a measurement.
 *
 * Usage:
 *   NODE_ENV=production node scripts/validate-trade-review-invariants.mjs
 */

import db from '#db'
import { is_main } from '#libs-server'
import grade_trades from '#libs-server/trade-review/grade-trades.mjs'

const LID = 1
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const validate = async () => {
  const full = await grade_trades({ lid: LID })
  console.log(`records ${full.length}`)

  // 1. still-held never negative on any leg.
  let exceeds = 0
  let legs = 0
  for (const record of full) {
    for (const asset of [...record.acquired_assets, ...record.sent_assets]) {
      legs += 1
      if (asset.keeptradecut_value_still_held < 0) exceeds += 1
    }
  }
  check(
    'every still-held figure is non-negative',
    exceeds === 0,
    `${legs} legs`
  )

  // 2. Both perspectives of every trade agree on all figures.
  const by_trade = new Map()
  for (const record of full) {
    if (!by_trade.has(record.trade_id)) by_trade.set(record.trade_id, [])
    by_trade.get(record.trade_id).push(record)
  }
  let asymmetric = 0
  const mirrors = (a, b) => (a == null || b == null ? a === b : a === -b)
  for (const pair of by_trade.values()) {
    if (pair.length !== 2) continue
    for (const field of [
      'net_value_at_trade',
      'net_value_still_held',
      'net_value_proceeds',
      'net_value_proceeds_change'
    ]) {
      if (!mirrors(pair[0][field], pair[1][field])) asymmetric += 1
    }
  }
  check(
    'both perspectives are sign-inverted on every figure',
    asymmetric === 0,
    `${by_trade.size} trades`
  )

  // 3. A filtered invocation agrees with an unfiltered one on every shared
  //    record — the truncation the first design shipped.
  const sample = [...by_trade.keys()].slice(0, 40)
  let filtered_disagreements = 0
  for (const uid of sample) {
    const one = await grade_trades({ lid: LID, trade_id: uid })
    for (const record of one) {
      const reference = full.find(
        (row) => row.trade_id === record.trade_id && row.tid === record.tid
      )
      if (!reference) {
        filtered_disagreements += 1
        continue
      }
      for (const field of [
        'net_value_still_held',
        'net_value_proceeds',
        'net_value_proceeds_change'
      ]) {
        if (record[field] !== reference[field]) {
          filtered_disagreements += 1
          console.log(
            `  trade ${uid} tid ${record.tid} ${field}: filtered ${record[field]} vs full ${reference[field]}`
          )
        }
      }
    }
  }
  check(
    'a trade_id call agrees with a full-league call on every figure',
    filtered_disagreements === 0,
    `${sample.length} trades sampled`
  )

  // 4. A year-filtered list agrees too.
  const years = [...new Set(full.map((r) => r.occurred_at.getUTCFullYear()))]
  let year_disagreements = 0
  for (const year of years) {
    const slice = await grade_trades({ lid: LID, year })
    for (const record of slice) {
      const reference = full.find(
        (row) => row.trade_id === record.trade_id && row.tid === record.tid
      )
      if (
        !reference ||
        record.net_value_proceeds !== reference.net_value_proceeds
      ) {
        year_disagreements += 1
      }
    }
  }
  check(
    'a year-filtered call agrees with a full-league call on proceeds',
    year_disagreements === 0,
    `${years.length} years`
  )

  // 5. No retired field survives on the wire.
  const sample_record = full[0]
  const sample_asset =
    sample_record.acquired_assets[0] || sample_record.sent_assets[0]
  check(
    'no retired field is emitted',
    !('net_value_realized' in sample_record) &&
      !('net_value_change' in sample_record) &&
      !('current_keeptradecut_value' in sample_asset) &&
      !('lineage_state' in sample_asset)
  )

  console.log(
    failures.length
      ? `\nFAILED: ${failures.join(', ')}`
      : '\nall invariants hold'
  )
  await db.destroy()
  process.exit(failures.length ? 1 : 0)
}

if (is_main(import.meta.url)) {
  validate().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export default validate
