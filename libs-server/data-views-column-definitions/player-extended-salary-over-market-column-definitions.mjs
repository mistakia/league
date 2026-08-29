import { current_season, player_tag_types } from '#constants'
import {
  get_single_value,
  get_league_format_id
} from '#libs-server/data-views/param-utils.mjs'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  sql_integer_param,
  sql_slug_param
} from '#libs-server/data-views/sanitize-sql-param.mjs'
import {
  player_extended_salary_table_alias,
  player_extended_salary_join
} from './player-extended-salary-column-definitions.mjs'

const get_cache_info = create_static_cache_info({
  ttl: 1000 * 60 * 60 * 12
})

// Every field here is spliced into SQL text by market_salary_sql and
// roster_tag_sql below, so each is validated at the point it is resolved.
const get_scope = ({ params = {} } = {}) => ({
  year: sql_integer_param({
    value: get_single_value(params.year, current_season.year),
    param_name: 'year'
  }),
  lid: sql_integer_param({
    value: get_single_value(params.lid, 1),
    param_name: 'lid'
  }),
  league_format_id: sql_slug_param({
    value: get_league_format_id(params),
    param_name: 'league_format_id'
  })
})

// The market price a single season of this player is worth, read from the
// season period table -- the same table and column `generate-tag-board.mjs`
// reads for its auction supply view.
//
// `market_salary_positive` rather than `market_salary_net`: the two are shares
// of different POOLS, and the positive one is the share of the drawn season
// board -- the quantity that has always answered "what is a season of this
// player worth", and the one restricted free agency, franchise schedules and
// rookie schedules price off. The net variant prices a format with no viable
// bench and would understate every contract compared against it.
//
// Both operands are read from a pre-aggregated relation joined onto the player
// row, NOT by attaching the underlying source. A column belongs to exactly one
// join group, and this one belongs to the extended-salary group so the ladder
// stays shared; attaching the market source from here would emit a SECOND join
// on the same alias whenever a view also carries the market column itself,
// which Postgres rejects outright ("table name specified more than once"), and
// `rosters_players` is its own join group so referencing `rosters_players.tag`
// directly would emit a dangling reference in any view that carries no roster
// column.
//
// A private relation of this column's own is what satisfies both constraints
// without a per-row probe. Each operand was a correlated scalar subquery until
// 2026-08-29 and so cost one index probe per outer row, on probes that were
// already index-only and cheap individually -- same defect the career-year
// projection carried, and the cost was loop count rather than the index.
//
// The scope is pinned into each alias so the relation moves when the season,
// league or format does, rather than a stale relation surviving under a name
// that no longer describes it.
//
// Exported so a spec can name the relation under test rather than matching a
// fragment of anyone's SQL. Every other join in these queries also carries a
// get_table_hash alias, so a pattern like /left join "t[0-9a-f]{32}"/ passes
// whether or not either of these is joined at all.
export const market_salary_cte_name = ({ league_format_id, year }) =>
  get_table_hash(`salary_over_market/market_salary/${league_format_id}/${year}`)

export const roster_tag_cte_name = ({ lid, year }) =>
  get_table_hash(`salary_over_market/roster_tag/${lid}/${year}`)

// Registered on first reference from the read expressions below rather than
// from a `register_ctes` hook, so the relation exists exactly when something
// emits a reference to it. All three clause builders -- main_select,
// main_group_by and main_where -- read the same expression here, so all three
// want the relation and registering on reference serves them uniformly. That
// is what makes a select-vs-where discriminator unnecessary for this column.
//
// Idempotent, and keyed by NAME rather than by a flag: main_select and
// main_group_by both emit the expression, and two of these columns scoped to
// different years or leagues carry different relations that must each register
// once. Re-registering a name would emit a duplicate WITH alias (42712).
const ensure_cte = ({ data_view_options, cte_name, cte_select }) => {
  const { db, players_query } = data_view_options.query_context

  if (!data_view_options.salary_over_market_ctes) {
    data_view_options.salary_over_market_ctes = new Set()
  }
  if (data_view_options.salary_over_market_ctes.has(cte_name)) {
    return cte_name
  }

  players_query.with(cte_name, db.raw(cte_select))
  // LEFT, not inner, and this is the load-bearing half. The correlated form
  // returned NULL for a player it matched no row for, and on production that is
  // the large majority of players for both relations; an inner join would drop
  // every one of them from the view rather than rendering a blank cell.
  players_query.leftJoin(cte_name, function () {
    this.on(`${cte_name}.pid`, '=', data_view_options.pid_reference)
  })
  data_view_options.salary_over_market_ctes.add(cte_name)
  return cte_name
}

// No COALESCE, unlike the career-year projection this follows. That one
// replaced an AGGREGATE subquery, which returned `count(0) + 1 = 1` over the
// empty set where the grouped relation has no row at all. Both of these are
// plain scalar lookups: the correlated form returns NULL when it matches no
// row, and the LEFT JOIN yields NULL for the same player, so the two forms
// already agree on the missing case and adding a default would invent a value
// neither form ever returned.
//
// One row per pid without de-duplication: the table's PRIMARY KEY is
// (pid, league_format_id, season_year) and the relation pins the latter two, so
// the grain is already the join grain and a GROUP BY would be noise.
const market_salary_sql = ({ params, data_view_options }) => {
  const { year, league_format_id } = get_scope({ params })
  const cte_name = ensure_cte({
    data_view_options,
    cte_name: market_salary_cte_name({ league_format_id, year }),
    cte_select: `select pid, market_salary_positive from league_format_player_season_projection_values where league_format_id = '${league_format_id}' and season_year = ${year}`
  })
  return `${cte_name}.market_salary_positive`
}

// DISTINCT ON, and it is load-bearing rather than defensive. `rosters_players`
// is UNIQUE on (pid, week, season_year, tid) and NOT on lid, so one player can
// hold rows for two tids inside one league -- which has happened: pid
// ZAMI-WHIT-015750 carries two week-0 rows in league 1 for 2022. The correlated
// form raised 21000 ("more than one row returned by a subquery used as an
// expression") on that scope, while an undeduplicated relation would silently
// DUPLICATE the outer player row instead, which is the worse failure. Ordering
// by tid makes the survivor deterministic rather than plan-dependent.
const roster_tag_sql = ({ params, data_view_options }) => {
  const { year, lid } = get_scope({ params })
  const cte_name = ensure_cte({
    data_view_options,
    cte_name: roster_tag_cte_name({ lid, year }),
    cte_select: `select distinct on (pid) pid, tag from rosters_players where lid = ${lid} and season_year = ${year} and week = 0 order by pid, tid`
  })
  return `${cte_name}.tag`
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
// figures with `check-manager-homepages.mjs` enforcing it (that gate lives in
// user-base at `cli/league/check-manager-homepages.mjs`, NOT in this repo -- a
// search scoped to this checkout reports it missing) -- so the null here
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
