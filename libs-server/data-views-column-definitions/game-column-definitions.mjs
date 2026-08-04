import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import {
  format_nfl_week_identifier,
  parse_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'

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
    // Two cell families reach this attach and they resolve the cell's team
    // differently. A player-family cell has no team of its own, so it goes
    // through the player_year_teams CTE that maps the player to the team he
    // played for that year. A team-family cell IS a team, so it joins the game
    // CTE on its own identity column directly.
    //
    // This used to `return` when player_year_teams was absent, which left
    // main_select and main_group_by referencing an alias that was never joined
    // -- every team-row-grain view containing this column was a 42P01, in all
    // three row_axes shapes.
    const team_reference = query_context.player_year_teams_cte_name
      ? 'player_year_teams.team'
      : query_context.team_reference
    if (!team_reference) return

    const year_reference = query_context.player_year_teams_cte_name
      ? 'player_year_teams.year'
      : query_context.year_reference

    const { nfl_week: base_nfl_week } = get_params({ params })
    const offset_range = resolve_year_offset_range(params)
    const nfl_week = offset_expand_nfl_weeks(base_nfl_week, offset_range)
    const { players_query } = query_context
    const cte_name = table_alias

    const cte_query = db('nfl_games')
      .select(
        'season_year',
        'week',
        db.raw('away_nfl_team as nfl_team'),
        db.raw('home_nfl_team as game_opponent'),
        db.raw('false as game_is_home')
      )
      .whereIn('nfl_week_id', nfl_week)
      .union(function () {
        this.select(
          'season_year',
          'week',
          db.raw('home_nfl_team as nfl_team'),
          db.raw('away_nfl_team as game_opponent'),
          db.raw('true as game_is_home')
        )
          .from('nfl_games')
          .whereIn('nfl_week_id', nfl_week)
      })

    players_query.with(cte_name, cte_query)

    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.nfl_team`, '=', team_reference)
      // The bare `team` identity has no year column. That is not a gap: the
      // CTE is already filtered to the requested nfl_week list, so team alone
      // selects the right row.
      if (!year_reference) return
      if (offset_range) {
        // Correlate the offset-expanded game year to the player's base-year
        // team mapping THROUGH the offset (single `= ref+k`, range BETWEEN):
        // next-year opponent for the player's base-year team. Mirrors the
        // player_adp offset-correlation primitive.
        emit_year_match({
          builder: this,
          db,
          year_reference,
          source: { year_default: () => null },
          key_columns: { year: 'season_year' },
          params,
          ref: cte_name
        })
      } else {
        this.andOn(`${cte_name}.season_year`, '=', year_reference)
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
