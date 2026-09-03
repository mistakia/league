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

/**
 * The age cutoff, as a DATABASE expression.
 *
 * Exported so the one-clock property can be asserted directly. It cannot be
 * asserted behaviourally: the skew that breaks it is tens of milliseconds, so a
 * spec that inserts a row and sweeps it either passes or fails on how long the
 * connection pool took, which is precisely how the defect survived for days
 * while a test for it existed and ran (bulletin #613). The SQL either names
 * `now()` or carries a client timestamp, and that is decidable.
 *
 * @param {object} params
 * @param {object} params.query_runner
 * @param {number} params.min_age_hours
 * @returns {object} a knex raw expression
 */
export const build_sweep_cutoff = ({ query_runner, min_age_hours }) =>
  query_runner.raw("now() - (? * interval '1 hour')", [min_age_hours])

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
  // THE CUTOFF IS DERIVED ON THE DATABASE CLOCK, and it has to be. `created_at`
  // is stamped by the column DEFAULT, so it is the database's now; computing
  // the cutoff here as `Date.now() - min_age_hours` compares that against the
  // API host's now, and the two are different machines in production and
  // different clocks even in the test container.
  //
  // The skew is not theoretical and it is not small enough to ignore. The
  // no-floor control in test/data-views-query-backed.spec.mjs collected NOTHING
  // for days (bulletin #613): league-test-pg runs ~50ms AHEAD of the host, so a
  // just-inserted row's `created_at` sits in the FUTURE relative to a
  // Node-computed cutoff of `now`, and a strict `<` excludes it. It passed in
  // isolation and failed in a full run purely because a cold connection pool
  // put more than 50ms between the insert and the sweep.
  //
  // At the default 24-hour floor the same defect is invisible -- it moves the
  // grace period by milliseconds -- which is why it survived review. It is only
  // fatal at a floor near zero, and a floor near zero is exactly what the
  // control uses to prove the grace period is real.
  //
  // This is the rule the sibling module already states for itself:
  // generation-job-queue.mjs leaves `deadline_at` to the column DEFAULT rather
  // than computing it in Node, "so host skew would move it".
  // Off `query_runner`, not the module's `db`, so a caller passing a
  // transaction gets a cutoff evaluated inside it rather than on a second
  // connection.
  const cutoff_expression = build_sweep_cutoff({ query_runner, min_age_hours })

  // NOT EXISTS rather than NOT IN: user_data_views.query_id is nullable, and a
  // NOT IN against a subquery that can yield NULL returns no rows at all --
  // silently collecting nothing, forever, while reporting success. That is the
  // failure this whole file exists to make impossible, so it must not be the
  // one the file itself has.
  const unreferenced = await query_runner('data_view_queries')
    .select('query_id')
    .where('created_at', '<', cutoff_expression)
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
