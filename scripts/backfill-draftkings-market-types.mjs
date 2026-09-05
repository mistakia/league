import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { get_market_type } from '#libs-server/draftkings/draftkings-market-types.mjs'

// console.log, not debug. A one-shot maintenance script's stdout IS the record
// of what it changed, and the `debug` route printed nothing at all here on
// first run -- the same failure audit-keeptradecut-liquidity-coverage.mjs
// documents. A backfill whose report does not reach the operator is a backfill
// nobody can check.
const log = console.log

// Re-runs the CURRENT DraftKings mapper over rows that were stored before it
// could classify them, and fills in the market_type they would get today.
//
// This exists because classification is applied at IMPORT and never revisited.
// market_type is in MARKET_INDEX_MERGE_COLUMNS (libs-server/insert-prop-markets.mjs),
// so a market that is still being re-observed picks up a new mapping on its own
// within one import cycle -- but a market whose game has kicked off is never
// observed again and keeps its null forever. Every mapping fix therefore
// recovers only the live tail by itself and silently abandons the closed one.
//
// The recoverable set is much larger than any single mapping fix suggests,
// because nothing has ever swept it: measured 2026-09-05, 71,236 rows across
// more than twenty market types, against 543,243 null rows with a parseable
// tuple. The rest are families the mapper still declines and this script
// correctly leaves alone.
//
// Idempotent and safe to re-run: it only ever writes rows whose market_type IS
// NULL, and only when the replay yields a type. It never overwrites a
// classification and never nulls one out, so a second run is a no-op and a run
// after a future mapping change picks up exactly that change's closed tail.
//
// Dry run by DEFAULT. Pass --commit to write.

// Rows per UPDATE. The table is large and this is maintenance work with no
// deadline, so batches stay small enough not to hold a long lock.
const BATCH_SIZE = 2000

const parse_tuple_field = (name) =>
  `(substring(source_market_name from '${name}: ([0-9]+)'))::int`

// Replays the mapper over the distinct tuples and returns the ones that now
// resolve. Separated from the write so the measurement can be read on its own,
// which is the whole of the --dry-run path.
export const plan_market_type_backfill = ({ tuples }) => {
  const resolvable = []
  let recoverable_row_count = 0
  let unresolved_row_count = 0

  for (const tuple of tuples) {
    const market_type = get_market_type({
      offerCategoryId: tuple.offer_category_id,
      subcategoryId: tuple.subcategory_id,
      betOfferTypeId: tuple.bet_offer_type_id,
      marketTypeId: tuple.market_type_id
    })

    if (!market_type) {
      unresolved_row_count += tuple.row_count
      continue
    }

    recoverable_row_count += tuple.row_count
    resolvable.push({ ...tuple, market_type })
  }

  const by_market_type = new Map()
  for (const entry of resolvable) {
    by_market_type.set(
      entry.market_type,
      (by_market_type.get(entry.market_type) || 0) + entry.row_count
    )
  }

  return {
    resolvable,
    recoverable_row_count,
    unresolved_row_count,
    by_market_type: [...by_market_type.entries()]
      .map(([market_type, row_count]) => ({ market_type, row_count }))
      .sort((a, b) => b.row_count - a.row_count)
  }
}

const load_unclassified_tuples = async () => {
  return db
    .select(
      db.raw(`${parse_tuple_field('categoryId')} as offer_category_id`),
      db.raw(`${parse_tuple_field('subcategoryId')} as subcategory_id`),
      db.raw(`${parse_tuple_field('betOfferTypeId')} as bet_offer_type_id`),
      db.raw(`${parse_tuple_field('marketTypeId')} as market_type_id`),
      db.raw('count(*)::int as row_count')
    )
    .from('prop_markets_index')
    .where('source_id', 'DRAFTKINGS')
    .whereNull('market_type')
    .whereRaw("source_market_name ~ 'categoryId: [0-9]+'")
    .groupBy(1, 2, 3, 4)
}

// The tuple is only recoverable from source_market_name, so the UPDATE has to
// re-parse it rather than match on stored columns. Anchored on `is null` so a
// row reclassified by an import between the plan and the write is left alone.
const update_tuple = async ({ tuple }) => {
  const matches_tuple = (query) => {
    query
      .where('source_id', 'DRAFTKINGS')
      .whereNull('market_type')
      .whereRaw(`${parse_tuple_field('categoryId')} = ?`, [
        tuple.offer_category_id
      ])
      .whereRaw(`${parse_tuple_field('subcategoryId')} = ?`, [
        tuple.subcategory_id
      ])

    // A null in the tuple means the token is absent from the name, which is a
    // different predicate from equality and does not survive `= null`.
    for (const [name, value] of [
      ['betOfferTypeId', tuple.bet_offer_type_id],
      ['marketTypeId', tuple.market_type_id]
    ]) {
      if (value === null) {
        query.whereRaw(`${parse_tuple_field(name)} is null`)
      } else {
        query.whereRaw(`${parse_tuple_field(name)} = ?`, [value])
      }
    }

    return query
  }

  let total = 0
  for (;;) {
    const ids = await matches_tuple(db('prop_markets_index'))
      .select('source_market_id')
      .limit(BATCH_SIZE)

    if (!ids.length) break

    const updated = await db('prop_markets_index')
      .whereIn(
        'source_market_id',
        ids.map((row) => row.source_market_id)
      )
      .where('source_id', 'DRAFTKINGS')
      .whereNull('market_type')
      .update({ market_type: tuple.market_type })

    total += updated
    if (updated === 0) break
  }

  return total
}

const backfill_draftkings_market_types = async ({ commit = false } = {}) => {
  const tuples = await load_unclassified_tuples()
  const plan = plan_market_type_backfill({ tuples })

  log(
    `${tuples.length} distinct unclassified tuples covering ${plan.recoverable_row_count + plan.unresolved_row_count} rows`
  )
  log(`  the current mapper resolves: ${plan.recoverable_row_count}`)
  log(`  still declined after replay: ${plan.unresolved_row_count}`)

  for (const entry of plan.by_market_type) {
    log(`  ${entry.row_count}\t${entry.market_type}`)
  }

  if (!commit) {
    log('\nDRY RUN -- nothing written. Pass --commit to apply.')
    return plan
  }

  let written = 0
  for (const tuple of plan.resolvable) {
    written += await update_tuple({ tuple })
  }

  log(`\nwrote market_type to ${written} rows`)
  return { ...plan, written }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('commit', {
      describe: 'Write the backfill. Without it the script only reports.',
      type: 'boolean',
      default: false
    })
    .strict()
    .parse()

  let error
  try {
    await backfill_draftkings_market_types({ commit: argv.commit })
  } catch (err) {
    error = err
    console.error(err)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_draftkings_market_types
