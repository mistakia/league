import db from '#db'
import debug from 'debug'

const log = debug('sweep-unreferenced-data-view-queries')

// data_view_queries carries NO owner column -- deliberately, so that nothing
// structural keys on user_id and opening generation to anonymous callers later
// is a deleted admission check rather than a re-keyed table. The cost of that
// choice is exactly this: an unreferenced row has nobody to attribute it to and
// nothing that would ever clean it up, and the table grows without bound one
// abandoned generation at a time.
//
// So the sweep ships WITH the table rather than being retrofitted onto a live
// unbounded one. Retrofitting is how a first sweep ends up deleting a hundred
// thousand rows in one transaction against a table nobody has ever vacuumed.

// A grace period, not a debounce. The authoring path writes the query row and
// the view row in ONE transaction, so a correctly-created pair is never
// momentarily unreferenced -- but a generation job that persists the query
// first and the view after a user confirms would be, and that shape is coming.
// One day is long enough that no interactive flow can lose a race with it.
const DEFAULT_MIN_AGE_HOURS = 24

/**
 * @param {object} [opts]
 * @param {number} [opts.min_age_hours] - rows younger than this are never collected
 * @param {boolean} [opts.dry_run] - report what would be collected, delete nothing
 * @param {object} [opts.query_runner]
 * @returns {Promise<{ collected: Array<string>, dry_run: boolean }>}
 */
export default async function sweep_unreferenced_data_view_queries({
  min_age_hours = DEFAULT_MIN_AGE_HOURS,
  dry_run = false,
  query_runner = db
} = {}) {
  const cutoff = new Date(Date.now() - min_age_hours * 60 * 60 * 1000)

  // NOT EXISTS rather than NOT IN: user_data_views.query_id is nullable, and a
  // NOT IN against a subquery that can yield NULL returns no rows at all --
  // silently collecting nothing, forever, while reporting success. That is the
  // failure this whole file exists to make impossible, so it must not be the
  // one the file itself has.
  const unreferenced = await query_runner('data_view_queries')
    .select('query_id')
    .where('created_at', '<', cutoff)
    .whereNotExists(function () {
      this.select(1)
        .from('user_data_views')
        .whereRaw('user_data_views.query_id = data_view_queries.query_id')
    })

  const collected = unreferenced.map((row) => row.query_id)

  if (!collected.length) {
    log('no unreferenced data_view_queries rows older than the cutoff')
    return { collected, dry_run }
  }

  if (dry_run) {
    log(`would collect ${collected.length} unreferenced queries`)
    return { collected, dry_run }
  }

  await query_runner('data_view_queries').whereIn('query_id', collected).del()
  log(`collected ${collected.length} unreferenced queries`)

  return { collected, dry_run }
}
