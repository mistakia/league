import default_db from '#db'
import { LeaguePaused } from '#libs-shared/errors.mjs'

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
 * @param {Object} [args.db]
 * @returns {Promise<Object|null>} The open pause row, or null.
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
 * Every pause interval that overlaps the draft, for the draft clock's credit.
 *
 * Returns the raw intervals rather than a precomputed total. A scalar would be
 * computed under whatever daily-window bounds were in force when it was
 * written, and -- more importantly -- it cannot be clipped to the window
 * anchor, which is resolved inside `getDraftWindow` and is not known here. See
 * `libs-shared/get-paused-open-seconds.mjs` for why the clip is the whole
 * correctness argument.
 *
 * `resumed_at` is left NULL for an open pause rather than filled with "now".
 * The consumer closes it against its own clock, which is what lets the SPA
 * measure a live pause continuously instead of ticking down between refetches.
 *
 * Intervals that ended before the draft opened are dropped: they cost the draft
 * nothing. Intervals are NOT clipped at the lower bound here, because
 * `getDraftWindow` clips to the resolved reference anyway and a second clip
 * would just be a place for the two to disagree.
 *
 * @param {Object} args
 * @param {number} args.league_id
 * @param {Date|string} args.draft_start - timestamptz.
 * @param {Object} [args.db]
 * @returns {Promise<Array<{paused_at: string, resumed_at: string|null}>>}
 */
export const get_draft_pause_periods = async ({
  league_id,
  draft_start,
  db = default_db
}) => {
  if (!league_id || !draft_start) return []

  const pause_state = await get_pause_state_by_league_id({
    leagues: [{ uid: league_id, draft_start }],
    db
  })

  return pause_state[Number(league_id)].draft_pause_periods
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
 * reader above delegates here, so the rule for which intervals matter to the
 * draft cannot come to mean different things on the two routes.
 *
 * @param {Object} args
 * @param {Array<{uid: number, draft_start: Date|string}>} args.leagues
 * @param {Object} [args.db]
 * @returns {Promise<Object>} Keyed by league id, each
 *   `{ paused_at, draft_pause_periods }`.
 */
export const get_pause_state_by_league_id = async ({
  leagues,
  db = default_db
}) => {
  const league_ids = leagues.map((league) => Number(league.uid))
  if (!league_ids.length) return {}

  const pause_rows = await db('league_pauses')
    .whereIn('league_id', league_ids)
    .orderBy('paused_at', 'asc')
    .select('league_id', 'paused_at', 'resumed_at')

  const pause_state = {}
  for (const league of leagues) {
    const league_id = Number(league.uid)
    const league_rows = pause_rows.filter(
      (pause_row) => Number(pause_row.league_id) === league_id
    )
    const open_pause = league_rows.find((pause_row) => !pause_row.resumed_at)

    pause_state[league_id] = {
      paused_at: open_pause ? open_pause.paused_at : null,
      draft_pause_periods: league.draft_start
        ? league_rows
            .filter(
              (pause_row) =>
                !pause_row.resumed_at ||
                new Date(pause_row.resumed_at) > new Date(league.draft_start)
            )
            .map((pause_row) => ({
              paused_at: pause_row.paused_at,
              resumed_at: pause_row.resumed_at
            }))
        : []
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
 * @param {Object} [args.db]
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
