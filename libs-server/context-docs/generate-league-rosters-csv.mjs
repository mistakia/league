import { current_season } from '#constants'
import convert_to_csv from '#libs-shared/convert-to-csv.mjs'

import { load_configured_league } from './generate-league-context.mjs'
import load_league_rosters from './rosters.mjs'
import { resolve_salary_basis } from './salary-basis.mjs'

// One row per rostered player across the whole league. A CSV cannot carry
// frontmatter, so the fields that qualify the salary -- which season it is for
// and which side of the extension deadline it is on -- ride on every row rather
// than being stated once somewhere the reader may not have fetched.
const csv_columns = [
  'league_id',
  'year',
  'team_id',
  'team_name',
  'group',
  'slot',
  'player_id',
  'player_name',
  'position',
  'nfl_team',
  'salary',
  'salary_basis',
  'salary_year',
  'tag',
  'extensions'
]

export default async function generate_league_rosters_csv({
  db,
  lid,
  year = current_season.year
}) {
  const league = await load_configured_league({ db, lid, year })
  const team_rosters = await load_league_rosters({ db, lid, year, league })
  const salary_basis = resolve_salary_basis({ league, year })

  const header = Object.fromEntries(
    csv_columns.map((column) => [column, column])
  )

  const rows = team_rosters.flatMap(({ rows }) =>
    rows.map((row) => ({
      league_id: league.league_id,
      year,
      team_id: row.tid,
      team_name: row.team_name,
      group: row.group,
      slot: row.slot,
      player_id: row.pid,
      player_name: row.name,
      position: row.pos,
      nfl_team: row.nfl_team,
      salary: row.salary,
      salary_basis: salary_basis.frontmatter_value,
      salary_year: year,
      tag: row.tag,
      extensions: row.extensions
    }))
  )

  return convert_to_csv([header, ...rows])
}
