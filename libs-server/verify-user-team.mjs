import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ userId, leagueId, teamId, requireLeague }) {
  if (!teamId) {
    throw new Error('missing teamId')
  }
  const tid = parseInt(teamId, 10)

  if (isNaN(tid)) {
    throw new Error('invalid teamId')
  }

  if (requireLeague && !leagueId) {
    throw new Error('missing leagueId')
  }

  const lid = parseInt(leagueId, 10)

  // verify team belongs to user
  const userTeams = await db('teams')
    .select('teams.*', 'users_teams.*', 'leagues.commishid')
    .leftJoin('users_teams', 'teams.uid', 'users_teams.tid')
    .join('leagues', 'teams.lid', 'leagues.uid')
    .where('teams.uid', tid)
    .where('teams.year', constants.season.year)
  const team = userTeams.find(
    (p) => p.userid === userId || p.commishid === userId
  )
  if (!team) {
    throw new Error('invalid teamId')
  }

  if (requireLeague && team.lid !== lid) {
    throw new Error('invalid leagueId')
  }

  return team
}
