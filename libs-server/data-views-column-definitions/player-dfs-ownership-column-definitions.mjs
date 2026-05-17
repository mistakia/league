import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { parse_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

const get_params = ({ params = {} }) => {
  const nfl_week_id = resolve_single_nfl_week_id({ params })
  const nfl_week = [nfl_week_id]

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

const player_dfs_ownership_source = {
  // Grain 'player': the CTE collapses each player to one row via the
  // nfl_week_id + draft-group ranking filter, so pid-only equality is the
  // correct join predicate regardless of the cell's split shape.
  grain: 'player',
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { nfl_week, platform_source_id } = get_params({ params })
    const { players_query, pid_reference } = query_context
    const cte_name = table_alias

    // Parse nfl_week identifiers back to year/week pairs for filtering
    const year_week_pairs = nfl_week.map((nwi) => {
      const parsed = parse_nfl_week_identifier({ identifier: nwi })
      return { year: parsed.year, week: parsed.week }
    })

    // Ranked CTE selects ownership from the contest with the most complete
    // ownership data per draft group (by non-zero ownership count), using
    // entry_count as tiebreaker. Some FL-sourced contests have partial
    // ownership despite being the largest by entries.
    const cte_query = db.raw(
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

    players_query.with(cte_name, cte_query)
    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.pid`, '=', pid_reference)
    })
  }
}

const create_player_dfs_ownership_field = (field) => ({
  column_name: field,
  select_as: () => 'dfs_ownership_pct',
  table_alias: generate_table_alias,
  source: player_dfs_ownership_source,
  get_cache_info
})

export default {
  player_dfs_ownership_pct: create_player_dfs_ownership_field('ownership_pct')
}
