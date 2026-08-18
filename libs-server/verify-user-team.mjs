import db from '#db'
import { current_season } from '#constants'

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
    .select('teams.*', 'users_teams.*', 'leagues.commissioner_user_id')
    .leftJoin('users_teams', function () {
      this.on('teams.team_id', '=', 'users_teams.tid').andOn(
        'teams.season_year',
        '=',
        'users_teams.season_year'
      )
    })
    .join('leagues', 'teams.lid', 'leagues.league_id')
    .where('teams.team_id', tid)
    .where('teams.season_year', current_season.year)
  const team = userTeams.find(
    (p) => p.user_id === userId || p.commissioner_user_id === userId
  )
  if (!team) {
    throw new Error('invalid teamId')
  }

  if (requireLeague && team.lid !== lid) {
    throw new Error('invalid leagueId')
  }

  return team
}
