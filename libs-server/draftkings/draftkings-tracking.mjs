import debug from 'debug'
import db from '#db'

const log = debug('draftkings-tracking')

const TABLE = 'draftkings_category_activity'

// Per-run write counters. track_category_activity keeps its catch -- one failed
// tracking write must not abort a 21-minute odds sweep and lose the real prop
// data -- but a swallowed error that leaves the healthy and failing paths with
// the same observable is exactly what hid a total write failure for ten months.
// These are the run's oracle: import-draftkings-odds.mjs asserts on them at the
// end of every run and emits/resolves a signal accordingly.
let write_attempts = 0
let write_failures = 0
let first_failure_message = null

export const reset_tracking_write_stats = () => {
  write_attempts = 0
  write_failures = 0
  first_failure_message = null
}

export const get_tracking_write_stats = () => ({
  write_attempts,
  write_failures,
  first_failure_message
})

export const track_category_activity = async ({
  category_id,
  subcategory_id = null,
  category_name,
  subcategory_name = null,
  offers_found = 0
}) => {
  write_attempts += 1
  try {
    const timestamp = new Date()

    // Insert or update tracking record
    await db(TABLE)
      .insert({
        category_id,
        subcategory_id: subcategory_id || 0,
        category_name,
        subcategory_name,
        last_checked: timestamp,
        // Explicit null rather than undefined. Both produce the same INSERT
        // here -- knex omits an undefined key and the column has no default --
        // but the intent is load-bearing and should not rest on that: a
        // category never yet seen with offers must read NULL, which is what
        // get_dead_categories's whereNull branch selects on.
        last_seen_with_offers: offers_found > 0 ? timestamp : null,
        total_checks: 1,
        total_offers_found: offers_found
      })
      .onConflict(['category_id', 'subcategory_id'])
      .merge({
        category_name, // Update name in case it changed
        subcategory_name,
        last_checked: timestamp,
        // Every bare column reference in a DO UPDATE SET expression is
        // AMBIGUOUS -- the namespace holds both the target table and `excluded`
        // -- so Postgres raises 42702 and rejects the whole statement, insert
        // half included. That is why this table sat at zero rows from the day
        // it shipped. All three reads below intend the TARGET table's stored
        // value: keep the last sighting when this check found nothing, and
        // accumulate the running totals. Reading `excluded` instead would wipe
        // last_seen_with_offers on every offerless check and reset the totals.
        last_seen_with_offers: db.raw(
          `CASE WHEN ? > 0 THEN ? ELSE ${TABLE}.last_seen_with_offers END`,
          [offers_found, timestamp]
        ),
        total_checks: db.raw(`${TABLE}.total_checks + 1`),
        total_offers_found: db.raw(`${TABLE}.total_offers_found + ?`, [
          offers_found
        ])
      })

    if (offers_found > 0) {
      log(
        `Tracked active: ${category_name}${subcategory_name ? ` -> ${subcategory_name}` : ''} (${offers_found} offers)`
      )
    }
  } catch (err) {
    write_failures += 1
    if (!first_failure_message) first_failure_message = err.message
    log(`Failed to track category activity: ${err.message}`)
  }
}

export const get_active_categories = async (days_back = 7) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days_back)

  return await db('draftkings_category_activity')
    .select('*')
    .select(
      db.raw(
        'CASE WHEN total_checks > 0 THEN (total_offers_found::decimal / total_checks * 100) ELSE 0 END as success_rate'
      )
    )
    .select(
      db.raw(
        'CASE WHEN subcategory_id = 0 THEN null ELSE subcategory_id END as subcategory_id'
      )
    )
    .where('last_seen_with_offers', '>=', cutoff)
    .orderBy('success_rate', 'desc')
}

export const get_priority_categories = async () => {
  // Categories that have shown recent activity or good success rates
  return await db('draftkings_category_activity')
    .select('*')
    .select(
      db.raw(
        'CASE WHEN total_checks > 0 THEN (total_offers_found::decimal / total_checks * 100) ELSE 0 END as success_rate'
      )
    )
    .select(
      db.raw(
        'CASE WHEN subcategory_id = 0 THEN null ELSE subcategory_id END as subcategory_id'
      )
    )
    .where(function () {
      this.where(
        db.raw(
          'CASE WHEN total_checks > 0 THEN (total_offers_found::decimal / total_checks * 100) ELSE 0 END'
        ),
        '>',
        10
      ).orWhere(
        'last_seen_with_offers',
        '>',
        db.raw("CURRENT_TIMESTAMP - INTERVAL '3 days'")
      )
    })
    .orderBy('success_rate', 'desc')
}

export const get_dead_categories = async (days_back = 30) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days_back)

  return await db('draftkings_category_activity')
    .where(function () {
      this.whereNull('last_seen_with_offers').orWhere(
        'last_seen_with_offers',
        '<',
        cutoff
      )
    })
    .where('total_checks', '>', 5) // Only show categories we've actually tested
    .orderBy('last_checked', 'desc')
}

export const cleanup_old_tracking = async (days_to_keep = 90) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days_to_keep)

  const deleted = await db('draftkings_category_activity')
    .where('last_checked', '<', cutoff)
    .whereNull('last_seen_with_offers')
    .del()

  log(`Cleaned up ${deleted} old tracking records`)
  return deleted
}
