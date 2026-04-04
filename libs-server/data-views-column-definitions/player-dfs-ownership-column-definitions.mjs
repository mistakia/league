import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { current_season } from '#constants'
import { format_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'

const get_params = ({ params = {} }) => {
  let nfl_week
  if (params.nfl_week_id) {
    nfl_week = Array.isArray(params.nfl_week_id)
      ? params.nfl_week_id
      : [params.nfl_week_id]
  } else {
    let year = params.year || [current_season.stats_season_year]
    if (!Array.isArray(year)) {
      year = [year]
    }
    let week = params.week || [Math.max(current_season.week, 1)]
    if (!Array.isArray(week)) {
      week = [week]
    }
    nfl_week = []
    for (const y of year) {
      for (const w of week) {
        nfl_week.push(
          format_nfl_week_identifier({ year: y, seas_type: 'REG', week: w })
        )
      }
    }
  }

  let platform_source_id = params.platform_source_id || ['DRAFTKINGS']
  if (!Array.isArray(platform_source_id)) {
    platform_source_id = [platform_source_id]
  }

  return {
    nfl_week,
    platform_source_id
  }
}

const get_cache_info = create_season_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { nfl_week, platform_source_id } = get_params({ params })
  const key = `player_dfs_ownership_${nfl_week.join('_')}_${platform_source_id.join('_')}`
  return get_table_hash(key)
}

const add_player_dfs_ownership_with_statement = ({
  query,
  params = {},
  with_table_name
}) => {
  const { nfl_week, platform_source_id } = get_params({ params })

  // Parse nfl_week identifiers back to year/week pairs for filtering
  const year_week_pairs = nfl_week.map((nwi) => {
    const parts = nwi.split('-')
    return { year: parseInt(parts[0], 10), week: parseInt(parts[2], 10) }
  })

  // Ranked CTE selects ownership from the contest with the most complete
  // ownership data per draft group (by non-zero ownership count), using
  // entry_count as tiebreaker. Some FL-sourced contests have partial
  // ownership despite being the largest by entries.
  const with_query = db.raw(
    `
    SELECT o.pid, o.ownership_pct, o.year, o.week
    FROM player_dfs_ownership o
    INNER JOIN (
      SELECT dc.source_contest_id, dc.source_id,
             ROW_NUMBER() OVER (
               PARTITION BY dc.source_draft_group_id, dc.source_id
               ORDER BY own_stats.nonzero_count DESC, dc.entry_count DESC
             ) AS rn
      FROM dfs_contests dc
      INNER JOIN (
        SELECT source_contest_id, source_id,
               COUNT(*) FILTER (WHERE ownership_pct > 0) AS nonzero_count
        FROM player_dfs_ownership
        GROUP BY source_contest_id, source_id
      ) own_stats ON own_stats.source_contest_id = dc.source_contest_id
                  AND own_stats.source_id = dc.source_id
      WHERE dc.ownership_imported = true
        AND dc.source_id IN (${platform_source_id.map(() => '?').join(',')})
        AND (${year_week_pairs.map(() => '(dc.year = ? AND dc.week = ?)').join(' OR ')})
    ) rc ON o.source_contest_id = rc.source_contest_id
        AND o.source_id = rc.source_id
        AND rc.rn = 1
    WHERE o.source_id IN (${platform_source_id.map(() => '?').join(',')})
    `,
    [
      ...platform_source_id,
      ...year_week_pairs.flatMap((p) => [p.year, p.week]),
      ...platform_source_id
    ]
  )

  query.with(with_table_name, with_query)
}

const create_player_dfs_ownership_field = (field) => ({
  column_name: field,
  table_name: 'player_dfs_ownership',
  select_as: () => 'dfs_ownership_pct',
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_dfs_ownership_with_statement,
  supported_splits: ['year', 'week'],
  with_where: () => 'player_dfs_ownership.ownership_pct',
  get_cache_info
})

export default {
  player_dfs_ownership_pct: create_player_dfs_ownership_field('ownership_pct')
}
