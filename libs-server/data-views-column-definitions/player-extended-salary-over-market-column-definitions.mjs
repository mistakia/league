import { current_season, player_tag_types } from '#constants'
import {
  get_single_value,
  get_league_format_id
} from '#libs-server/data-views/param-utils.mjs'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import {
  player_extended_salary_table_alias,
  player_extended_salary_join
} from './player-extended-salary-column-definitions.mjs'

const get_cache_info = create_static_cache_info({
  ttl: 1000 * 60 * 60 * 12
})

const get_scope = ({ params = {} } = {}) => ({
  year: get_single_value(params.year, current_season.year),
  lid: get_single_value(params.lid, 1),
  league_format_id: get_league_format_id(params)
})

// The market price a single season of this player is worth, read at week 0 --
// the season-long figure, the same table and period `generate-tag-board.mjs`
// reads (scripts/generate-tag-board.mjs:115-118).
//
// Emitted as a correlated scalar subquery rather than by attaching the
// `player_week_projected_market_salary` source. A column belongs to exactly one
// join group, and this one belongs to the extended-salary group so the ladder
// stays shared; attaching the market source from here would emit a SECOND join
// on the same alias whenever a view also carries the market column itself,
// which Postgres rejects outright ("table name specified more than once").
// The subquery is a single lookup on the table's UNIQUE
// (pid, league_format_id, week, year) index and cannot fan out a row.
const market_salary_sql = ({ params, data_view_options }) => {
  const { year, league_format_id } = get_scope({ params })
  return `(SELECT market_salary FROM league_format_player_projection_values WHERE pid = ${data_view_options.pid_reference} AND league_format_id = '${league_format_id}' AND year = ${year} AND week = '0')`
}

// Read through a correlated subquery for the same reason: `rosters_players` is
// its own join group, so referencing `rosters_players.tag` directly would emit
// a dangling reference in any view that carries no roster column.
const roster_tag_sql = ({ params, data_view_options }) => {
  const { year, lid } = get_scope({ params })
  return `(SELECT tag FROM rosters_players WHERE pid = ${data_view_options.pid_reference} AND lid = ${lid} AND year = ${year} AND week = 0)`
}

// REGULAR and RESTRICTED_FREE_AGENCY tags get a number. FRANCHISE and ROOKIE
// are NULL, deliberately.
//
// Franchise and rookie: `market_salary` prices ONE season, and both tags are
// multi-year commitments, so a difference against them would be a
// plausible-looking wrong answer rather than a missing one -- the same failure
// shape as the extension ladder defect this column follows.
// `generate-tag-board.mjs:111-114` records the same reasoning for the figure.
// `build-tag-board.mjs` drops both from `market_pool` outright, so leaving them
// NULL here is what keeps the two surfaces in agreement.
//
// Restricted free agency emitted NULL until 2026-07-31, on the reasoning that
// the auction settles the contract and the settling offer is blind under
// Constitution Article IX section 2. That withheld PUBLIC state in order to
// protect PRIVATE state: the stored salary is the contract the owner carries
// today and is what a nomination is priced against, while the thing actually
// blind is the settling BID, which never enters this column or the board.
// `build-tag-board.mjs` stopped nulling `post_deadline_salary`/`market_gap` for
// tag 4 in league 411c94bb8, and all ten manager homepages now render those
// figures with `check-manager-homepages.mjs` enforcing it -- so the null here
// had inverted into the very disagreement it was written to prevent, printing
// blank for ten rostered players the homepages give a number for.
//
// A user who wants a franchise or rookie row reads the two operand columns side
// by side.
const extended_salary_over_market_sql = ({
  table_name,
  params,
  data_view_options
}) =>
  `CASE WHEN ${roster_tag_sql({ params, data_view_options })} IN (${player_tag_types.REGULAR}, ${player_tag_types.RESTRICTED_FREE_AGENCY}) THEN "${table_name}"."extended_salary" - ${market_salary_sql({ params, data_view_options })} END`

export default {
  player_league_extended_salary_over_market: {
    table_name: 'player_extended_salary',
    // The SAME alias function and the SAME join as player_league_extended_salary.
    // get_grouped_clauses_by_table keys groups on the alias, so this column lands
    // in that column's group and the ladder subquery is registered exactly once
    // whether or not the operand is also displayed.
    table_alias: player_extended_salary_table_alias,
    join: player_extended_salary_join,
    select_as: () => 'player_league_extended_salary_over_market',
    source: { grain: 'player' },
    // The `_${column_index}` alias is what makes sorting resolve --
    // add_sort_clauses looks up `${select_as()}_${column_index}` by position in
    // the SELECT list and silently orders by pid when it cannot find it.
    main_select: ({ table_name, params, column_index, data_view_options }) => [
      `${extended_salary_over_market_sql({ table_name, params, data_view_options })} AS player_league_extended_salary_over_market_${column_index}`
    ],
    // The expression reads the joined alias's non-aggregated `extended_salary`,
    // so Postgres requires the whole expression in the GROUP BY. The
    // extended-salary join is 1:1 per player, so this never splits a row.
    // Without it a filter or sort on this column fails at execution with
    // "must appear in the GROUP BY clause"; the plain display case does not.
    main_group_by: ({ table_name, params, data_view_options }) => [
      extended_salary_over_market_sql({ table_name, params, data_view_options })
    ],
    main_where: ({ table_name, params, data_view_options }) =>
      extended_salary_over_market_sql({
        table_name,
        params,
        data_view_options
      }),
    get_cache_info
  }
}
