import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import {
  format_nfl_week_identifier,
  parse_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'
import { resolve_year_offset_range } from '#libs-server/data-views/param-utils.mjs'
import { emit_year_match } from '#libs-server/data-views/source-attach/rules/player-family-to-player-year.mjs'

// Expand a base nfl_week_id list by a year_offset range: for each base
// identifier, shift its year component by every offset in [min..max] (keeping
// seas_type + week), returning the sorted, deduped union. The game CTE must
// contain the offset-shifted weeks so the offset-correlated join can read them;
// without this it filtered to the base year and silently returned the base-year
// opponent.
const offset_expand_nfl_weeks = (nfl_week, offset_range) => {
  if (!offset_range) return nfl_week
  const [min_off, max_off] = offset_range
  const out = new Set()
  for (const id of nfl_week) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) {
      out.add(id)
      continue
    }
    for (let off = min_off; off <= max_off; off++) {
      out.add(
        format_nfl_week_identifier({
          year: parsed.year + off,
          seas_type: parsed.seas_type,
          week: parsed.week
        })
      )
    }
  }
  return [...out].sort()
}

const get_params = ({ params = {} }) => {
  if (params.nfl_week_id) {
    const nfl_week = Array.isArray(params.nfl_week_id)
      ? params.nfl_week_id
      : [params.nfl_week_id]
    return { nfl_week }
  }

  // Cartesian fallback for callers that pass year[]/week[] arrays without
  // nfl_week_id (the pre-migration form). When neither is present, fall back
  // to the resolver default.
  const years = params.year
    ? Array.isArray(params.year)
      ? params.year
      : [params.year]
    : null
  const weeks = params.week
    ? Array.isArray(params.week)
      ? params.week
      : [params.week]
    : null
  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type[0]
    : params.seas_type

  if (years && weeks) {
    const resolved_seas_type =
      seas_type ||
      parse_nfl_week_identifier({
        identifier: resolve_single_nfl_week_id({ params })
      })?.seas_type ||
      'REG'
    const nfl_week = []
    for (const y of years) {
      for (const w of weeks) {
        nfl_week.push(
          format_nfl_week_identifier({
            year: y,
            seas_type: resolved_seas_type,
            week: w
          })
        )
      }
    }
    return { nfl_week }
  }

  const nfl_week = [resolve_single_nfl_week_id({ params })]
  return { nfl_week }
}

const get_cache_info = create_season_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { nfl_week } = get_params({ params })
  const key = `game_${nfl_week.join('_')}`
  return get_table_hash(key)
}

const game_source = {
  // Source carries (nfl_team, game_opponent, year, week) per game; joins
  // through player-family-to-team-year (player_year_teams CTE) so the cell
  // row's historical team mapping selects the right opponent row.
  grain: 'team_year',
  attach: ({ query_context, params, table_alias, join_type }) => {
    // Team-subject queries reach this attach via team-cell-to-team-source,
    // which does NOT attach player_year_teams. The legacy join_on_team path
    // resolved either alias; under the bridge model we'd need separate
    // (team*, team_year) registration for this column. Until Step 6's
    // source-attach reachability check gates that, silently skip — the
    // column's intended audience is player-family cells.
    if (!query_context.player_year_teams_cte_name) return

    const { nfl_week: base_nfl_week } = get_params({ params })
    const offset_range = resolve_year_offset_range(params)
    const nfl_week = offset_expand_nfl_weeks(base_nfl_week, offset_range)
    const { players_query } = query_context
    const cte_name = table_alias

    const cte_query = db('nfl_games')
      .select(
        'year',
        'week',
        db.raw('v as nfl_team'),
        db.raw('h as game_opponent'),
        db.raw('true as game_is_home')
      )
      .whereIn('nfl_week_id', nfl_week)
      .union(function () {
        this.select(
          'year',
          'week',
          db.raw('h as nfl_team'),
          db.raw('v as game_opponent'),
          db.raw('false as game_is_home')
        )
          .from('nfl_games')
          .whereIn('nfl_week_id', nfl_week)
      })

    players_query.with(cte_name, cte_query)

    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.nfl_team`, '=', 'player_year_teams.team')
      if (offset_range) {
        // Correlate the offset-expanded game year to the player's base-year
        // team mapping THROUGH the offset (single `= ref+k`, range BETWEEN):
        // next-year opponent for the player's base-year team. Mirrors the
        // player_adp offset-correlation primitive.
        emit_year_match({
          builder: this,
          db,
          year_reference: 'player_year_teams.year',
          source: { year_default: () => null },
          key_columns: { year: 'year' },
          params,
          ref: cte_name
        })
      } else {
        this.andOn(`${cte_name}.year`, '=', 'player_year_teams.year')
      }
    })
  }
}

export default {
  game_opponent: {
    column_name: 'game_opponent',
    main_select: ({ table_name, column_index }) => [
      `${table_name}.game_opponent as game_opponent_${column_index}`,
      `${table_name}.game_is_home as game_is_home_${column_index}`
    ],
    main_group_by: ({ table_name }) => [
      `${table_name}.game_opponent`,
      `${table_name}.game_is_home`
    ],
    main_where: ({ table_name }) => `${table_name}.game_opponent`,
    table_alias: generate_table_alias,
    source: game_source,
    get_cache_info
  }
}
