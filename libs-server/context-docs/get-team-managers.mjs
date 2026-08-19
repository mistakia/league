/**
 * Resolve the manager username(s) for every team in a league-year.
 *
 * Closes the manager-name assembly gap for the context docs: team rows carry
 * no owner identity, so this joins `users_teams` -> `users` and returns a map
 * of `{ [tid]: [username, ...] }`. A team with no linked user resolves to an
 * empty array rather than being absent.
 *
 * @param {object} params
 * @param {import('knex').Knex} params.db
 * @param {number} params.lid
 * @param {number} params.year
 * @returns {Promise<Record<number, string[]>>}
 */
export default async function get_team_managers({ db, lid, year }) {
  const rows = await db('users_teams')
    .join('teams', function () {
      this.on('users_teams.tid', '=', 'teams.team_id').andOn(
        'users_teams.season_year',
        '=',
        'teams.season_year'
      )
    })
    .join('users', 'users_teams.user_id', 'users.id')
    .where('teams.lid', lid)
    .where('teams.season_year', year)
    .select('users_teams.tid', 'users.username')

  /** @type {Record<number, string[]>} */
  const managers = {}
  for (const row of rows) {
    if (!managers[row.tid]) {
      managers[row.tid] = []
    }
    managers[row.tid].push(row.username)
  }

  return managers
}
