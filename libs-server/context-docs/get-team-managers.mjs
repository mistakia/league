/**
 * Resolve the manager username(s) for every team in a league-year.
 *
 * Closes the manager-name assembly gap for the context docs: team rows carry
 * no owner identity, so this joins `users_teams` -> `users` and returns a map
 * of `{ [tid]: [username, ...] }`. A team with no linked user resolves to an
 * empty array rather than being absent.
 */
export default async function get_team_managers({ db, lid, year }) {
  const rows = await db('users_teams')
    .join('teams', function () {
      this.on('users_teams.tid', '=', 'teams.uid').andOn(
        'users_teams.year',
        '=',
        'teams.year'
      )
    })
    .join('users', 'users_teams.userid', 'users.id')
    .where('teams.lid', lid)
    .where('teams.year', year)
    .select('users_teams.tid', 'users.username')

  const managers = {}
  for (const row of rows) {
    if (!managers[row.tid]) {
      managers[row.tid] = []
    }
    managers[row.tid].push(row.username)
  }

  return managers
}
