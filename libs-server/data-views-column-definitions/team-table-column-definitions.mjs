import { create_immutable_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

// Team-identity prefix columns. Sourced from the `team` VALUES CTE
// registered by setup_from_table_and_player_joins (team subject) or the
// `team -> team_year` identity bridge. The setup function unconditionally
// inner-joins `team` to the outer query under team subject, so these
// columns reach `team.<col>` regardless of which team identity (team,
// team_year, team_year_week) anchors the FROM source.
//
// Under player subject these columns have no `team` CTE registered and
// will fail with "missing FROM-clause entry for table team". That gap is
// tracked separately as subject-compatibility validation.

const team_table_get_cache_info = create_immutable_cache_info()

export default {
  team_code: {
    table_name: 'team',
    column_name: 'team_code',
    source: { grain: 'team' },
    get_cache_info: team_table_get_cache_info
  },
  team_name: {
    table_name: 'team',
    column_name: 'team_name',
    source: { grain: 'team' },
    get_cache_info: team_table_get_cache_info
  },
  team_conference: {
    table_name: 'team',
    column_name: 'team_conference',
    source: { grain: 'team' },
    get_cache_info: team_table_get_cache_info
  },
  team_division: {
    table_name: 'team',
    column_name: 'team_division',
    source: { grain: 'team' },
    get_cache_info: team_table_get_cache_info
  }
}
