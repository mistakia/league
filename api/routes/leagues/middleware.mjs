// @ts-check
import { getLeague, validators } from '#libs-server'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'

/** @typedef {import('#libs-server/get-league.mjs').League} League */
/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('knex').Knex} Knex */

// Requests that cannot write, and so are never blocked by a pause.
const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// The commissioner's own lever. Mounted beneath the guard like everything else,
// so it has to be named here or a paused league could never be resumed.
const PAUSE_ROUTE_PATH = /^\/pause\/?$/

/**
 * Validate authentication
 * @param {Request & { auth?: { userId: number } }} req - `auth` is attached by
 *   express-jwt and is absent on the pre-guard routers, which is the whole
 *   reason this helper exists.
 * @param {Response} res
 * @returns {req is Request & { auth: { userId: number } }} True if
 *   authenticated, false if response was sent.
 *
 *   A TYPE PREDICATE rather than a plain boolean, because a boolean narrows
 *   nothing: after `if (!require_auth(req, res)) return`, every caller's
 *   `req.auth.userId` still read as possibly-undefined, and the alternative was
 *   a non-null assertion at each of them asserting the same fact this function
 *   already establishes. The narrowing is now the function's declared job.
 */
export function require_auth(req, res) {
  if (!req.auth) {
    res.status(401).send({ error: 'Authentication required' })
    return false
  }
  return true
}

/**
 * Validate and get league
 * @param {string|number} leagueId - League ID from params
 * @param {Response} res
 * @returns {Promise<League|null>} League object or null if validation failed
 */
export async function validate_and_get_league(leagueId, res) {
  // Validate league ID
  const lid_check = validators.league_id_validator(Number(leagueId))
  if (lid_check !== true) {
    res.status(400).send({ error: 'invalid leagueId' })
    return null
  }

  // Verify league exists
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    res.status(400).send({ error: 'invalid leagueId' })
    return null
  }

  return league
}

/**
 * The `leagues` columns that are CREDENTIALS, and so must never reach a client.
 *
 * A Discord webhook URL is a bearer credential: anyone holding the URL can post
 * to that channel, with no key and no login. Both of these were readable by an
 * anonymous caller until 2026-09-04, because `getLeague` selects the whole
 * `leagues` row and the two routes below sent it wholesale — and `/leagues`
 * mounts above the blanket 401 in `api/index.mjs`. Nothing in the SPA ever
 * showed them (`app/core/leagues/league.js` declares neither), so the exposure
 * was on the wire only and invisible from the UI.
 *
 * The list is the single point of truth: a credential column added to `leagues`
 * later is stripped by naming it here, with no second edit at the send sites.
 * It is typed as the literal key union rather than `string[]`, so a name that
 * is not a `leagues` column fails the type check here instead of silently
 * deleting nothing.
 *
 * Stripped at the RESPONSE boundary rather than inside `getLeague`, because the
 * server-side consumers are the ones that need the values —
 * `libs-server/send-notifications.mjs` reads `league.discord_webhook_url` to
 * post, and `scripts/announce-draft-slate.mjs` reads the announcements one.
 * Removing them upstream would break notifications silently.
 */
/** @type {ReadonlyArray<'discord_webhook_url' | 'discord_announcements_webhook_url'>} */
export const league_credential_fields = Object.freeze([
  'discord_webhook_url',
  'discord_announcements_webhook_url'
])

/**
 * A copy of the league object safe to send to a client.
 * @param {League} league - League object
 * @returns {League} The league without any credential column
 */
export function remove_league_credential_fields(league) {
  const client_league = { ...league }
  for (const field of league_credential_fields) {
    delete client_league[field]
  }
  return client_league
}

/**
 * Require user to be league commissioner
 * @param {League} league - League object
 * @param {number} userId - User ID
 * @param {Response} res
 * @param {string} action - Action being performed (for error message)
 * @returns {boolean} True if authorized, false if response was sent
 */
export function require_commissioner(league, userId, res, action) {
  if (league.commissioner_user_id !== userId) {
    res.status(403).send({
      error: `Only league commissioner can ${action}`
    })
    return false
  }
  return true
}

/**
 * Require user to be league commissioner or team owner
 *
 * Ownership lives in users_teams, joined to teams on (tid, year) -- the same
 * shape libs-server/verify-user-team.mjs uses. The teams table has no user
 * column at all; teams.team_id is the team's own id, so the previous predicate
 * (`teams.where({ lid, uid: userId })`) compared a user id against a team id
 * and authorized on a coincidental collision between the two id spaces.
 *
 * Membership counts in ANY year, not just the current season. teams rows are
 * per-year, so a current-season-only check would revoke every member's access
 * during the offseason window before the new season's rows exist, and every
 * caller of this helper is a league-scoped read.
 *
 * @param {League} league - League object
 * @param {number} userId - User ID
 * @param {string|number} leagueId - League ID
 * @param {Knex} db - Database connection
 * @param {Response} res
 * @returns {Promise<boolean>} True if authorized, false if response was sent
 */
export async function require_league_access(league, userId, leagueId, db, res) {
  if (league.commissioner_user_id === userId) {
    return true
  }

  const user_team = await db('teams')
    .join('users_teams', function () {
      this.on('teams.team_id', '=', 'users_teams.tid').andOn(
        'teams.season_year',
        '=',
        'users_teams.season_year'
      )
    })
    .where('teams.lid', leagueId)
    .where('users_teams.user_id', userId)
    .first('teams.team_id')

  if (!user_team) {
    res.status(403).send({ error: 'Access denied' })
    return false
  }

  return true
}

/**
 * Express guard refusing every write to a paused league with 423 Locked.
 *
 * MOUNTING: this MUST be mounted with a path that carries the id --
 * `router.use('/:leagueId', ...)` or `router.use('/:teamId', ...)`. A bare
 * `router.use(handler)` leaves `req.params` as `{}` (verified against this
 * repo's express 4.22.2), so the guard would resolve no league, pass every
 * request, and look exactly like a working guard. It must also be mounted ABOVE
 * each router's own PUT, which sits above the sub-router mounts.
 *
 * TWO RESOLUTION MODES. `/api/leagues/:leagueId/...` carries the league id
 * directly; `/api/teams/:teamId/...` does not, so the league is resolved from
 * the team. An unresolvable team PASSES rather than 423s: this guard runs
 * pre-auth (both routers mount above the blanket 401 in api/index.mjs), so a
 * 423 on an unknown team id would confirm team existence to an anonymous caller
 * and turn the guard into an enumeration oracle. The route's own validation
 * answers for a bad id.
 *
 * The response body carries `{ error }` and nothing else -- never `paused_at`
 * and never the free-text `pause_reason`, both of which would then be readable
 * by anyone who can shape a POST at a paused league.
 *
 * BEST-EFFORT AT REQUEST ENTRY. It cannot interrupt a handler that passed
 * microseconds before the pause row landed, and a pause does not roll back
 * committed work.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export async function require_league_not_paused(req, res, next) {
  try {
    if (SAFE_HTTP_METHODS.has(req.method)) return next()
    if (PAUSE_ROUTE_PATH.test(req.path)) return next()

    const { db } = req.app.locals
    const { leagueId, teamId } = req.params

    let league_id = leagueId ? Number(leagueId) : null

    if (!league_id && teamId) {
      const team = await db('teams')
        .where({ team_id: Number(teamId) })
        .first('lid')

      if (!team) return next()
      league_id = team.lid
    }

    if (!league_id || Number.isNaN(league_id)) return next()

    const open_pause = await get_open_league_pause({ league_id, db })
    if (!open_pause) return next()

    return res.status(423).send({
      error: 'league is paused'
    })
  } catch (error) {
    return next(error)
  }
}

/**
 * Standard error handler for route handlers
 * @param {Error} err - Error object
 * @param {(err: Error) => void} logger - Logger function
 * @param {Response} res
 */
export function handle_error(err, logger, res) {
  logger(err)
  res.status(500).send({
    success: false,
    error: err.toString()
  })
}
