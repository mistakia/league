import debug from 'debug'
import db from '#db'

const log = debug('draftkings-tracking')

export const track_category_activity = async ({
  category_id,
  subcategory_id = null,
  category_name,
  subcategory_name = null,
  offers_found = 0
}) => {
  try {
    const timestamp = new Date()

    // Insert or update tracking record
    await db('draftkings_category_activity')
      .insert({
        category_id,
        subcategory_id: subcategory_id || 0,
        category_name,
        subcategory_name,
        last_checked: timestamp,
        last_seen_with_offers: offers_found > 0 ? timestamp : undefined,
        total_checks: 1,
        total_offers_found: offers_found
      })
      .onConflict(['category_id', 'subcategory_id'])
      .merge({
        category_name, // Update name in case it changed
        subcategory_name,
        last_checked: timestamp,
        last_seen_with_offers: db.raw(
          'CASE WHEN ? > 0 THEN ? ELSE last_seen_with_offers END',
          [offers_found, timestamp]
        ),
        total_checks: db.raw('total_checks + 1'),
        total_offers_found: db.raw('total_offers_found + ?', [offers_found])
      })

    if (offers_found > 0) {
      log(
        `Tracked active: ${category_name}${subcategory_name ? ` -> ${subcategory_name}` : ''} (${offers_found} offers)`
      )
    }
  } catch (err) {
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
