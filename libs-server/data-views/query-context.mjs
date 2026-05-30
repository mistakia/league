import {
  identities,
  get_identity,
  is_team_identity,
  resolve_references
} from './identities.mjs'
import { identity_for } from './row-grain-registry.mjs'

export const build_query_context = ({
  subjects = ['player'],
  splits = [],
  year_range = [],
  nfl_week_ids = [],
  params = {},
  db,
  players_query,
  position_filter_sql = null
}) => {
  const row_grain_id = subjects[0]
  const identity_id = identity_for({ row_grain_id, splits })
  const identity = get_identity(identity_id)

  return {
    db,
    players_query,
    identity_id,
    row_grain_id,
    subjects,
    splits,
    year_range,
    nfl_week_ids,
    params,
    pid_reference: identity.pid_column,
    team_reference: identity.team_column,
    year_reference: identity.year_column,
    week_reference: identity.week_column,
    is_team: is_team_identity(identity_id),
    position_filter_sql,
    applied_bridges: new Set(),
    applied_output_ctes: new Set(),
    joined_output_ctes: new Set(),
    registered_ctes: new Set(),
    having_clauses: []
  }
}

export { identities, get_identity, is_team_identity, resolve_references }
