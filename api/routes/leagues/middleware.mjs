import { getLeague, validators } from '#libs-server'

/**
 * Validate authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} True if authenticated, false if response was sent
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
 * @param {string} leagueId - League ID from params
 * @param {Object} res - Express response object
 * @returns {Promise<Object|null>} League object or null if validation failed
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
 * Require user to be league commissioner
 * @param {Object} league - League object
 * @param {number} userId - User ID
 * @param {Object} res - Express response object
 * @param {string} action - Action being performed (for error message)
 * @returns {boolean} True if authorized, false if response was sent
 */
export function require_commissioner(league, userId, res, action) {
  if (league.commishid !== userId) {
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
 * column at all; teams.uid is the team's own id, so the previous predicate
 * (`teams.where({ lid, uid: userId })`) compared a user id against a team id
 * and authorized on a coincidental collision between the two id spaces.
 *
 * Membership counts in ANY year, not just the current season. teams rows are
 * per-year, so a current-season-only check would revoke every member's access
 * during the offseason window before the new season's rows exist, and every
 * caller of this helper is a league-scoped read.
 *
 * @param {Object} league - League object
 * @param {number} userId - User ID
 * @param {string} leagueId - League ID
 * @param {Object} db - Database connection
 * @param {Object} res - Express response object
 * @returns {Promise<boolean>} True if authorized, false if response was sent
 */
export async function require_league_access(league, userId, leagueId, db, res) {
  if (league.commishid === userId) {
    return true
  }

  const user_team = await db('teams')
    .join('users_teams', function () {
      this.on('teams.uid', '=', 'users_teams.tid').andOn(
        'teams.season_year',
        '=',
        'users_teams.season_year'
      )
    })
    .where('teams.lid', leagueId)
    .where('users_teams.userid', userId)
    .first('teams.uid')

  if (!user_team) {
    res.status(403).send({ error: 'Access denied' })
    return false
  }

  return true
}

/**
 * Standard error handler for route handlers
 * @param {Error} err - Error object
 * @param {Function} logger - Logger function
 * @param {Object} res - Express response object
 */
export function handle_error(err, logger, res) {
  logger(err)
  res.status(500).send({
    success: false,
    error: err.toString()
  })
}
