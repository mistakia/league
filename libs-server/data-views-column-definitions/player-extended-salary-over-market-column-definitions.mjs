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

// Only a REGULAR tag gets a number. Every other tag is NULL, deliberately, and
// for two distinct reasons.
//
// Franchise and rookie: `market_salary` prices ONE season, and both tags are
// multi-year commitments, so a difference against them would be a
// plausible-looking wrong answer rather than a missing one -- the same failure
// shape as the extension ladder defect this column follows.
// `generate-tag-board.mjs:111-114` records the same reasoning for the figure.
//
// Restricted free agency: the auction settles the contract, so the stored
// salary describes a contract about to be replaced, and the offer that would
// settle it is blind under Constitution Article IX section 2 and never becomes
// visible. The manager homepage board carries salary and gap null for exactly
// these rows; emitting a number here would put this column in disagreement with
// all ten homepages on the players the restricted free agency period is about.
// Note the extension-ladder fix made this a live hazard rather than a
// theoretical one -- post-fix the join returns a real `salary_paid` for tag 4,
// so the difference computes unless nulled explicitly.
//
// A user who wants any of these rows reads the two operand columns side by side.
const extended_salary_over_market_sql = ({
  table_name,
  params,
  data_view_options
}) =>
  `CASE WHEN ${roster_tag_sql({ params, data_view_options })} = ${player_tag_types.REGULAR} THEN "${table_name}"."extended_salary" - ${market_salary_sql({ params, data_view_options })} END`

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
