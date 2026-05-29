import {
  nfl_team_abbreviations,
  nfl_team_value_groups,
  build_nfl_team_values
} from '#libs-shared/constants/nfl-teams-constants.mjs'

// Materializes the team-identity CTE: one row per NFL team carrying
// (team_code, team_name, team_conference, team_division). Metadata is
// sourced from nfl-teams-constants.mjs so that file remains the single
// catalog of team identity values; this helper only joins the conference
// groups (`nfl_team_value_groups`) with the per-team label list
// (`build_nfl_team_values`).
//
// Consumed by:
//   - libs-server/data-views/identities.mjs (team identity from_source)
//   - libs-server/data-views/identity-bridges/team-to-team-year.mjs
//
// Both call sites materialize a CTE named "team" with the column
// contract above. Any new consumer must keep that name + columns stable.

const division_lookup = new Map(
  nfl_team_value_groups.flatMap((conference) =>
    conference.children.map((division) => [
      division.id,
      { conference: conference.id, division_label: division.label }
    ])
  )
)

const team_info_by_code = new Map(
  build_nfl_team_values().map(({ value, label, group }) => [
    value,
    { label, group }
  ])
)

const get_team_row = (code) => {
  const info = team_info_by_code.get(code)
  if (!info) throw new Error(`Unknown nfl team_code: ${code}`)
  const division = division_lookup.get(info.group)
  if (!division) {
    throw new Error(`Unknown division id ${info.group} for team_code ${code}`)
  }
  return {
    team_code: code,
    team_name: info.label,
    team_conference: division.conference,
    team_division: division.division_label
  }
}

export const team_values_cte_sql = () => {
  const tuples = nfl_team_abbreviations
    .map((code) => {
      const row = get_team_row(code)
      return `('${row.team_code}','${row.team_name}','${row.team_conference}','${row.team_division}')`
    })
    .join(',')
  return `SELECT team_code, team_name, team_conference, team_division FROM (VALUES ${tuples}) AS t(team_code, team_name, team_conference, team_division)`
}
