// @ts-check
import default_db from '#db'
import { LeaguePaused } from '#libs-shared/errors.mjs'

/** @typedef {import('#db/schema-types.js').LeaguePausesRow} LeaguePausesRow */
/** @typedef {import('knex').Knex} Knex */

/**
 * @typedef {object} LeaguePauseState
 * @property {Date | null} paused_at
 * @property {Date | null} resumed_at
 */

/**
 * The single module that decides whether a league is paused.
 *
 * Every enforcement site -- the express guard, the auction socket, the ten cron
 * processors, the import worker -- reads pause state through here and nowhere
 * else, so there is exactly one predicate to change and exactly one place a
 * pause can be defined. `league_pauses` is queried directly rather than
 * denormalized onto `leagues` or `seasons`, so there is no boolean to drift out
 * of agreement with the interval rows.
 *
 * `db` is injectable but defaults to the shared connection. Routes hold their
 * own handle on `req.app.locals.db` and pass it; scripts and tests take the
 * default.
 */

/**
 * The league's open pause, or null when it is live.
 *
 * At most one row can match: `league_pauses_one_open_per_league` is a partial
 * unique index on `resumed_at IS NULL`, so this returns a row or nothing and
 * never has to choose between two candidates.
 *
 * @param {Object} args
 * @param {number} args.league_id
 * @param {Knex} [args.db]
 * @returns {Promise<LeaguePausesRow|null>} The open pause row, or null.
 */
export const get_open_league_pause = async ({ league_id, db = default_db }) => {
  if (!league_id) return null

  const open_pause = await db('league_pauses')
    .where({ league_id: Number(league_id) })
    .whereNull('resumed_at')
    .first()

  return open_pause || null
}

/**
 * The league's latest resume, for the draft clock.
 *
 * A SCALAR, where this used to return the whole interval array. The open-seconds
 * credit needed intervals because it had to clip each one to a per-pick anchor
 * resolved inside `getDraftWindow`. The published slate does not credit
 * anything: a resume simply VOIDS the standing publication, and windows are
 * read from the first boundary at or after it. Only the latest resume can
 * matter under that rule — two pauses in a day are equivalent to one — so
 * anything more than the scalar is a shape for the two sides to disagree over.
 *
 * Null while a league has never been resumed, INCLUDING while its first pause
 * is still open. That is correct rather than a gap: an open pause blocks every
 * league write with a 423, so no window it might have voided is reachable, and
 * the SPA freezes its display clock off `paused_at` instead.
 *
 * A `Date` or null, NEVER a string. `league_pauses.resumed_at` is
 * `timestamp with time zone` and is selected without a cast, so node-pg's
 * parser for that OID hands back a `Date`; the annotation here read
 * `string|Date|null` until the type-check tier surfaced it, and a union of two
 * representations is the shape that invites the retype family of defects this
 * repo has already paid for — `Number(date)` yields milliseconds and
 * `dayjs.unix(date)` yields a year-58,000 date, neither of which throws. A
 * consumer branching on which one it got is guessing about something the
 * column settles.
 *
 * @param {Object} args
 * @param {number} args.league_id
 * @param {Knex} [args.db]
 * @returns {Promise<Date|null>} The latest `resumed_at`, or null.
 */
export const get_latest_league_resume = async ({
  league_id,
  db = default_db
}) => {
  if (!league_id) return null

  const pause_state = await get_pause_state_by_league_id({
    leagues: [{ league_id }],
    db
  })

  return pause_state[Number(league_id)].resumed_at
}

/**
 * The wire's pause state for several leagues in one query.
 *
 * `GET /api/me` returns every league the user is in, and its league payload is
 * what the SPA's store holds for an authenticated member — so the pause fields
 * have to travel on it as well as on `GET /leagues/:leagueId`, or the banner
 * and every frozen clock are inert for exactly the people a pause is for.
 *
 * The two shapes come from ONE implementation on purpose: the single-league
 * reader above delegates here, so which resume voids the draft's publication
 * cannot come to mean different things on the two routes.
 *
 * @param {Object} args
 * @param {Array<{league_id: number}>} args.leagues
 * @param {Knex} [args.db]
 * @returns {Promise<Record<number, LeaguePauseState>>} Keyed by league id.
 */
export const get_pause_state_by_league_id = async ({
  leagues,
  db = default_db
}) => {
  const league_ids = leagues.map((league) => Number(league.league_id))
  if (!league_ids.length) return {}

  const pause_rows = await db('league_pauses')
    .whereIn('league_id', league_ids)
    .orderBy('paused_at', 'asc')
    .select('league_id', 'paused_at', 'resumed_at')

  /** @type {Record<number, LeaguePauseState>} */
  const pause_state = {}
  for (const league of leagues) {
    const league_id = Number(league.league_id)
    const league_rows = pause_rows.filter(
      (/** @type {LeaguePausesRow} */ pause_row) =>
        Number(pause_row.league_id) === league_id
    )
    const open_pause = league_rows.find(
      (/** @type {LeaguePausesRow} */ pause_row) => !pause_row.resumed_at
    )

    // Ordered by `paused_at` ascending, so the last CLOSED row is the latest
    // resume. Reading it off the pause order rather than sorting on
    // `resumed_at` costs nothing here — pauses cannot overlap, since
    // `league_pauses_one_open_per_league` allows only one open at a time.
    let resumed_at = null
    for (const pause_row of league_rows) {
      if (pause_row.resumed_at) resumed_at = pause_row.resumed_at
    }

    pause_state[league_id] = {
      paused_at: open_pause ? open_pause.paused_at : null,
      resumed_at
    }
  }

  return pause_state
}

/**
 * Throws `LeaguePaused` when the league has an open pause.
 *
 * The throwing form exists so a caller cannot forget to branch on a boolean.
 * Callers that need to DECLINE rather than fail -- the cron processors -- catch
 * it and record a hold; see the class comment in `libs-shared/errors.mjs`.
 *
 * @param {Object} args
 * @param {number} args.league_id
 * @param {Knex} [args.db]
 * @throws {LeaguePaused}
 */
export const assert_league_not_paused = async ({
  league_id,
  db = default_db
}) => {
  const open_pause = await get_open_league_pause({ league_id, db })

  if (open_pause) {
    throw new LeaguePaused(`league ${league_id} is paused`)
  }
}
