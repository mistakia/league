import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ userId, leagueId, teamId, requireLeague }) {
  if (!teamId) {
    throw new Error('missing teamId')
  }
  const tid = Number(teamId)

  if (isNaN(tid)) {
    throw new Error('invalid teamId')
  }

  if (requireLeague && !leagueId) {
    throw new Error('missing leagueId')
  }

  const lid = Number(leagueId)

  // verify team belongs to user
  const userTeams = await db('teams')
    .select('teams.*', 'users_teams.*', 'leagues.commishid')
    .leftJoin('users_teams', function () {
      this.on('teams.uid', '=', 'users_teams.tid').andOn(
        'teams.year',
        '=',
        'users_teams.year'
      )
    })
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
