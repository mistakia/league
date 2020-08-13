const db = require('../db')

module.exports = async ({ userId, leagueId, teamId, requireLeague }) => {
  if (!teamId) {
    throw new Error('missing teamId')
  }
  const tid = parseInt(teamId, 10)

  if (requireLeague && !leagueId) {
    throw new Error('missing leagueId')
  }

  const lid = parseInt(leagueId, 10)

  // verify team belongs to user
  const userTeams = await db('users_teams')
    .join('teams', 'users_teams.tid', 'teams.uid')
    .where('userid', userId)
  const team = userTeams.find(p => p.tid === tid)
  if (!team) {
    throw new Error('invalid teamId')
  }

  if (requireLeague && team.lid !== lid) {
    throw new Error('invalid leagueId')
  }

  return team
}
