import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { get_market_type } from '#libs-server/draftkings/draftkings-market-types.mjs'
import {
  known_unmapped_subcategory_ids,
  known_unmapped_offer_category_ids
} from '#libs-server/draftkings/draftkings-constants.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

// console.log, not debug, for every line below -- these lines ARE this job's
// audit trail, and its log file is the only durable record of what it found.
// See the same note on audit-keeptradecut-liquidity-coverage.mjs.

// Coverage oracle for the DraftKings market-type mapper, answering the one
// question the per-run oracle in import-draftkings-odds.mjs structurally
// cannot.
//
// That oracle fires on NOVELTY: a subcategory or category id nobody has ruled
// on yet. It is correct and quiet, and it is the right shape for its question.
// But the moment an id is ruled out of scope it enters
// known_unmapped_subcategory_ids or known_unmapped_offer_category_ids and goes
// permanently dark -- roughly 221 subcategories and 44 categories today. Every
// one of those refusals was made against the volume observed AT THE TIME, and
// nothing re-reads them. Category 1972 (Drive Props) was declined the day after
// it first appeared, on 92 observed markets across one game, with the rationale
// "revisit once a few weeks of volume show the families persist" written into
// the constant. Nothing was going to revisit it. That is what this job is.
//
// WHY NOT AN UNCLASSIFIED-SHARE CHECK, which is the obvious shape and the one
// the continuation brief proposed. The share of DraftKings markets carrying a
// null market_type is dominated by families we declined ON PURPOSE, so it has
// no baseline anyone can defend: it moves when DraftKings publishes more
// exotics, which is not a defect, and it moves when a mapping regresses, which
// is. A threshold over it would either sit above every real regression or fire
// on vendor behaviour nobody controls. The share is REPORTED below because it
// is worth reading; it is paged on never. What is gradeable is the per-id
// question -- has a specific refusal gone stale -- because that has an owner
// and an action.
//
// Seeded from a REPLAY of the mapper over distinct published tuples, never from
// `market_type is null` in the table. market_type is last-write-wins on
// re-observation (MARKET_INDEX_MERGE_COLUMNS in insert-prop-markets.mjs), so a
// row not re-observed since a mapping landed still reads null and over-reports.
// The comment above known_unmapped_subcategory_ids says the same thing and a
// prior session ignored it and produced inflated counts for three categories.

// Trailing window the volume is measured over. One NFL month: long enough that
// a family published for a single game does not clear the bar on novelty
// alone, short enough that a family DraftKings retired years ago stops counting
// and cannot hold the signal open forever.
export const VOLUME_WINDOW_DAYS = 30

// SHARE of all DraftKings markets in the window, not a market count, above
// which a declined id is reported as a refusal worth revisiting.
//
// A raw count cannot work here and the first draft of this job proved it. Run
// on 2026-09-05 over the preseason, the whole 30-day window held 7,718 markets
// and the largest declined family published 290; by week 8 the same families
// publish in the tens of thousands. Any count that is quiet in September fires
// on everything in November, and any count that is quiet in November is blind
// for six months of the year. The share is scale-free across that swing, which
// is the only property that makes a single number defensible.
//
// Set from the measured distribution -- see the backtest in the observations on
// user:continuation/investigate-unclassified-draftkings-market-backlog.md, and
// reproduce it with --as-of.
export const STALE_REFUSAL_SHARE_THRESHOLD = 0.03

// And a floor on the raw count, because the share alone is not enough EITHER --
// the two failure modes are opposite and both are real. In the offseason the
// denominator collapses to a few thousand markets and an offseason-flavoured
// family clears 3% on nothing: measured 2026-09-05, category 1559 came to
// 3.76% on 290 markets while sitting at 1.58% and 1.94% in the two November
// windows where it published four times as many. A family publishing a few
// hundred markets a month is not worth a market type at any share.
//
// 1000 sits above every preseason artifact seen in the backtest and below both
// families the check is meant to catch (1303 at 4,071-5,353 and 1744 at
// 6,671-8,161 across three in-season windows).
export const STALE_REFUSAL_MARKET_FLOOR = 1000

const parse_tuple_field = (name) =>
  `(substring(source_market_name from '${name}: ([0-9]+)'))::int`

// Pure: takes the published tuples with their volumes and returns the finding.
// Kept free of DB and signal concerns so it is testable against a constructed
// corpus rather than against whatever DraftKings happens to publish today.
export const classify_market_type_coverage = ({
  tuples,
  declined_subcategory_ids,
  declined_category_ids,
  threshold = STALE_REFUSAL_SHARE_THRESHOLD,
  floor = STALE_REFUSAL_MARKET_FLOOR
}) => {
  const declined_subcategories = new Map()
  const declined_categories = new Map()
  const novel = []

  let mapped_market_count = 0
  let unmapped_market_count = 0

  for (const tuple of tuples) {
    const market_type = get_market_type({
      offerCategoryId: tuple.offer_category_id,
      subcategoryId: tuple.subcategory_id,
      betOfferTypeId: tuple.bet_offer_type_id,
      marketTypeId: tuple.market_type_id
    })

    if (market_type) {
      mapped_market_count += tuple.market_count
      continue
    }

    unmapped_market_count += tuple.market_count

    // Category-grain decline outranks subcategory-grain: when the whole family
    // is out of scope, the subcategory ids under it were never ruled on
    // individually and reporting them would name ids nobody has an opinion
    // about.
    if (declined_category_ids.has(tuple.offer_category_id)) {
      const prior = declined_categories.get(tuple.offer_category_id) || {
        offer_category_id: tuple.offer_category_id,
        market_count: 0,
        subcategory_ids: new Set()
      }
      prior.market_count += tuple.market_count
      prior.subcategory_ids.add(tuple.subcategory_id)
      declined_categories.set(tuple.offer_category_id, prior)
      continue
    }

    if (declined_subcategory_ids.has(tuple.subcategory_id)) {
      const prior = declined_subcategories.get(tuple.subcategory_id) || {
        offer_category_id: tuple.offer_category_id,
        subcategory_id: tuple.subcategory_id,
        market_count: 0
      }
      prior.market_count += tuple.market_count
      declined_subcategories.set(tuple.subcategory_id, prior)
      continue
    }

    // Neither mapped nor declined. The per-run oracle owns this arm and fires
    // on it within four hours, so it is reported here and never paged on --
    // two detectors on one condition is one detector and one duplicate.
    novel.push({
      offer_category_id: tuple.offer_category_id,
      subcategory_id: tuple.subcategory_id,
      market_count: tuple.market_count
    })
  }

  const by_volume = (a, b) => b.market_count - a.market_count
  const total_market_count = mapped_market_count + unmapped_market_count
  const with_share = (entry) => ({
    ...entry,
    market_share: total_market_count
      ? entry.market_count / total_market_count
      : 0
  })

  const declined_subcategory_volumes = [...declined_subcategories.values()]
    .map(with_share)
    .sort(by_volume)

  const declined_category_volumes = [...declined_categories.values()]
    .map(({ subcategory_ids, ...rest }) => ({
      ...rest,
      subcategory_ids: [...subcategory_ids].sort((a, b) => a - b)
    }))
    .map(with_share)
    .sort(by_volume)

  const is_stale_refusal = (entry) =>
    entry.market_share > threshold && entry.market_count > floor

  const stale_subcategory_refusals =
    declined_subcategory_volumes.filter(is_stale_refusal)

  const stale_category_refusals =
    declined_category_volumes.filter(is_stale_refusal)

  return {
    total_market_count,
    mapped_market_count,
    unmapped_market_count,
    // Reported always, paged on never -- see the header.
    unclassified_share: total_market_count
      ? unmapped_market_count / total_market_count
      : null,
    stale_subcategory_refusals,
    stale_category_refusals,
    novel_tuples: novel.sort(by_volume),
    declined_subcategory_volumes,
    declined_category_volumes
  }
}

const load_published_tuples = async ({ window_start, window_end }) => {
  const rows = await db
    .select(
      db.raw(`${parse_tuple_field('categoryId')} as offer_category_id`),
      db.raw(`${parse_tuple_field('subcategoryId')} as subcategory_id`),
      db.raw(`${parse_tuple_field('betOfferTypeId')} as bet_offer_type_id`),
      db.raw(`${parse_tuple_field('marketTypeId')} as market_type_id`),
      db.raw('count(*)::int as market_count')
    )
    .from('prop_markets_index')
    .where('source_id', 'DRAFTKINGS')
    .andWhere('observed_at', '>=', window_start.toDate())
    .andWhere('observed_at', '<', window_end.toDate())
    .andWhereRaw("source_market_name ~ 'categoryId: [0-9]+'")
    .groupBy(1, 2, 3, 4)

  return rows
}

const audit_draftkings_market_type_coverage = async ({
  window_days = VOLUME_WINDOW_DAYS,
  // Backtesting handle. A threshold nobody can run against a past window is a
  // threshold nobody can calibrate, and DraftKings volume swings by an order of
  // magnitude between the offseason and week 8 -- a bar set in August is
  // meaningless in November and vice versa. This is what makes the share-based
  // threshold below checkable rather than asserted.
  as_of = null,
  threshold = STALE_REFUSAL_SHARE_THRESHOLD,
  floor = STALE_REFUSAL_MARKET_FLOOR
} = {}) => {
  const window_end = as_of ? dayjs(as_of).startOf('day') : dayjs()
  const window_start = window_end.subtract(window_days, 'day').startOf('day')
  const tuples = await load_published_tuples({ window_start, window_end })

  // An oracle that cannot resolve its subject has found nothing to check, which
  // is not the same as finding nothing wrong. No tuples in a 30-day window
  // means the importer has stopped, which is a louder condition than anything
  // this job grades.
  if (!tuples.length) {
    return {
      shortfall: `domain: prop_markets_index holds no DraftKings markets with a parseable categoryId since ${window_start.format('YYYY-MM-DD')}; the importer is not writing and coverage cannot be graded`
    }
  }

  const result = classify_market_type_coverage({
    tuples,
    declined_subcategory_ids: known_unmapped_subcategory_ids,
    declined_category_ids: known_unmapped_offer_category_ids,
    threshold,
    floor
  })

  const pct = (share) => `${(share * 100).toFixed(2)}%`

  console.log(
    `window ${window_start.format('YYYY-MM-DD')}..${window_end.format('YYYY-MM-DD')} (${window_days}d): ${result.total_market_count} DraftKings markets over ${tuples.length} distinct tuples; ${result.mapped_market_count} classified, ${result.unmapped_market_count} unclassified (${pct(result.unclassified_share)})`
  )

  console.log(
    `declined and still publishing: ${result.declined_category_volumes.length} categories, ${result.declined_subcategory_volumes.length} subcategories; novel (owned by the per-run oracle): ${result.novel_tuples.length} tuples; stale-refusal threshold ${pct(threshold)} of window AND over ${floor} markets`
  )

  for (const entry of result.declined_category_volumes) {
    console.log(
      `  category ${entry.offer_category_id}: ${entry.market_count} markets (${pct(entry.market_share)}) over ${entry.subcategory_ids.length} subcategories`
    )
  }
  for (const entry of result.declined_subcategory_volumes) {
    console.log(
      `  subcategory ${entry.subcategory_id} (category ${entry.offer_category_id}): ${entry.market_count} markets (${pct(entry.market_share)})`
    )
  }
  for (const entry of result.novel_tuples) {
    console.log(
      `  NOVEL category ${entry.offer_category_id} subcategory ${entry.subcategory_id}: ${entry.market_count} markets`
    )
  }

  const shortfalls = []

  for (const entry of result.stale_category_refusals) {
    shortfalls.push(
      `stale refusal: offer category ${entry.offer_category_id} is in known_unmapped_offer_category_ids but published ${entry.market_count} markets in the last ${window_days} days, ${pct(entry.market_share)} of all DraftKings markets in the window (threshold ${pct(threshold)} and floor ${floor}), across subcategories ${entry.subcategory_ids.join(', ')}. Every market under it is ingested with a null market_type. Either map the family in draftkings-market-types.mjs or re-record why it stays declined at this volume.`
    )
  }

  for (const entry of result.stale_subcategory_refusals) {
    shortfalls.push(
      `stale refusal: subcategory ${entry.subcategory_id} (offer category ${entry.offer_category_id}) is in known_unmapped_subcategory_ids but published ${entry.market_count} markets in the last ${window_days} days, ${pct(entry.market_share)} of all DraftKings markets in the window (threshold ${pct(threshold)} and floor ${floor}). Either map it in draftkings-market-types.mjs or re-record why it stays declined at this volume.`
    )
  }

  return {
    shortfall: shortfalls.length ? shortfalls.join('; ') : null,
    ...result
  }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('as-of', {
      describe:
        'End the window on this date instead of today, for backtesting the threshold',
      type: 'string'
    })
    .option('window-days', {
      describe: 'Trailing window length in days',
      type: 'number',
      default: VOLUME_WINDOW_DAYS
    })
    .option('threshold', {
      describe:
        'Share of window markets above which a declined id is a stale refusal',
      type: 'number',
      default: STALE_REFUSAL_SHARE_THRESHOLD
    })
    .option('floor', {
      describe:
        'Minimum markets in the window before a declined id can be a stale refusal',
      type: 'number',
      default: STALE_REFUSAL_MARKET_FLOOR
    })
    .strict()
    .parse()

  let error
  try {
    const result = await audit_draftkings_market_type_coverage({
      as_of: argv.asOf,
      window_days: argv.windowDays,
      threshold: argv.threshold,
      floor: argv.floor
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    console.error(err)
  }

  // Reported as this job's outcome rather than as its own signal: the runs
  // oracle owns pipeline_failure for outcome conditions and closes it on the
  // next clean run, so the detector self-heals and cannot orphan a caller-keyed
  // signal. Same reasoning as audit-keeptradecut-liquidity-coverage.mjs.
  await report_job({
    job_type: job_types.AUDIT_DRAFTKINGS_MARKET_TYPE_COVERAGE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default audit_draftkings_market_type_coverage
