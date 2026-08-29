import db from '#db'
import { current_season } from '#constants'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { resolve_year_offset_range } from '#libs-server/data-views/param-utils.mjs'
import {
  invalid_param,
  sql_integer_param
} from '#libs-server/data-views/sanitize-sql-param.mjs'
import {
  create_date_based_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'
import { KEEPTRADECUT_AS_OF_WINDOW_DAYS } from '#libs-shared/data-views-constants.mjs'

// TODO career_year

// keeptradecut_valuations is a DAILY feed keyed (pid, is_superflex,
// observed_at) with one row per observation carrying up to three metrics.
// keeptradecut_value is universal; the two ranks are present only on
// full-scrape observations, so the daily importer path writes value-only rows.
//
// That asymmetry is why every lookup in this file is AS-OF rather than an
// equality match on a boundary date, and why each carries an IS NOT NULL on the
// metric it selects. Both properties are load-bearing:
//
//   - Equality on a boundary date drops the whole row whenever the scraper
//     missed that exact day. Measured 2026-07-31: 17 of the 124 NFL weeks in
//     the KTC era and 1 of the 7 opening days have no observation on the day
//     itself, so the pre-existing year-axis equality match was already
//     returning nothing for one season in seven.
//   - Without the metric predicate, "latest observation" resolves to the latest
//     VALUE-ONLY row for 731 of the 742 players who have ever carried a
//     position rank, so a rank column reads NULL for 98.5% of the population.
//
// Both failures are silent -- valid SQL, no error, just an absent or empty
// column -- which is why they survived so long.
const METRIC_COLUMNS = {
  value: 'keeptradecut_value',
  overall_rank: 'overall_rank',
  position_rank: 'position_rank'
}

// A bare recurring calendar day, stored as `MM-DD`. Under a year row axis it
// replaces the NFL opening day as the per-row as-of boundary, resolving to the
// same calendar day within each row's own year.
//
// Validation is three steps and all three are load-bearing. The shape regex
// pins two-digit halves, so `9-1` is rejected rather than silently accepted as
// September 1. sql_integer_param is the house boundary for a value spliced
// into SQL text -- see its header for why bindings are unavailable on this
// path. And the range check is NOT redundant with it: sql_integer_param
// carries no range, so `13-01` otherwise splits into two valid integers and
// reaches make_date(<year>, 13, 1), which raises `date field value out of
// range` at EXECUTION -- a Postgres error surfaced to the user in place of a
// clean invalid_param.
const AS_OF_MONTH_DAY_PATTERN = /^(\d{2})-(\d{2})$/

const parse_as_of_month_day = (value) => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === null || raw === undefined) {
    return null
  }

  const param_name = 'as_of_month_day'
  const match =
    typeof raw === 'string' ? raw.match(AS_OF_MONTH_DAY_PATTERN) : null
  if (!match) {
    invalid_param({ param_name })
  }

  const month = sql_integer_param({ value: match[1], param_name })
  const day = sql_integer_param({ value: match[2], param_name })
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    invalid_param({ param_name })
  }

  return { month, day }
}

const get_default_params = ({ params = {} } = {}) => {
  const date = params.date || null
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || current_season.year

  const year_offset_single = Array.isArray(params.year_offset)
    ? params.year_offset[0]
    : params.year_offset || 0
  const as_of_month_day = parse_as_of_month_day(params.as_of_month_day)
  return { date, year, year_offset_single, as_of_month_day }
}

const is_superflex_from_params = (params = {}) => Number(params.qb || 2) === 2

const get_cache_info_for_keeptradecut = create_date_based_cache_info({
  get_date_params: ({ params = {} } = {}) => get_default_params({ params }),
  calculate_ttl: ({ date, year, as_of_month_day }) => {
    // get_cache_info is invoked as get_cache_info({ params }) at both call
    // sites in get-data-view-results.mjs, so it never receives row_axes and
    // cannot tell whether a year axis is active. params.year does not scope a
    // year-split request either -- the axis does. So no long TTL can be
    // justified for any param-bearing request and this forces the short one
    // unconditionally, including for requests whose result cannot change (a
    // year axis over 2015-2020, or a week axis where the param is ignored
    // outright). That cost is accepted; narrowing it needs row_axes in the
    // cache-info contract.
    if (as_of_month_day) {
      return CACHE_TTL.SIX_HOURS
    }
    if (date) {
      return CACHE_TTL.THIRTY_DAYS
    }
    return year === current_season.year
      ? CACHE_TTL.SIX_HOURS
      : CACHE_TTL.THIRTY_DAYS
  }
})

const generate_table_alias = ({ type, params = {}, row_axes = [] } = {}) => {
  const { date, year, year_offset_single, as_of_month_day } =
    get_default_params({ params })
  // row_axes participates in the alias because the same column at the same
  // params emits a different boundary per axis; without it a week-split and a
  // year-split request for one column would collide on one alias.
  const axes = [...row_axes].sort().join('-')
  // is_superflex participates for the same reason: it is a join PREDICATE (see
  // keeptradecut_join), so two requests for one metric differing only by qb
  // emit different SQL. Omitting it collapsed them onto one alias and rendered
  // the 1QB value under the superflex column -- silently, with no error.
  // Derived rather than read raw, so qb absent and qb=2 share an alias exactly
  // as they share a predicate.
  const is_superflex = is_superflex_from_params(params)
  // as_of_month_day is appended only when set, so a column that does not carry
  // it hashes exactly as it did before the param existed and no cached entry
  // or saved view moves. It has to participate at all for the same reason
  // is_superflex does: it changes the emitted boundary, so two columns
  // differing only by it would otherwise collapse onto one alias and render
  // each other's values.
  const as_of_month_day_key = as_of_month_day
    ? `_as_of_month_day_${as_of_month_day.month}-${as_of_month_day.day}`
    : ''
  const key = `keeptradecut_${type}_data_${date || ''}_year_${year || ''}_year_offset_${year_offset_single || ''}_axes_${axes}_superflex_${is_superflex}${as_of_month_day_key}`
  return get_table_hash(key)
}

// How far back a year-axis as-of lookup may reach from its boundary.
//
// The as-of rule exists so a scraper that missed the boundary day falls back to
// the previous reading instead of returning nothing. Unbounded, it also carries
// DELISTED players forward forever: KeepTradeCut drops retired players from its
// board, and their final rank was then served for every later season -- Tom
// Brady rendered QB23 for 2025, last actually ranked 2021-12-21.
//
// 30 days is ~10x the largest real gap in the feed (measured 2026-07-31 over
// 2,237 scrape days: median gap 1 day, max 3), so it absorbs any genuine
// scraper outage while dropping a player who has been off the board a month.
// Measured effect on production: position_rank pid counts return to exactly
// their pre-as-of values for every year 2020-2026, and the tail disappears.
//
// Year axis ONLY. The week axis needs the unbounded reach (17 of 124 NFL weeks
// carry no observation on the week's own start day) and the default branch is
// "latest outright" by definition.
const YEAR_AXIS_AS_OF_WINDOW = `${KEEPTRADECUT_AS_OF_WINDOW_DAYS} days`

// The year-axis boundary, clamped so it can never sit in the future.
//
// Unclamped, a season whose opening day has not arrived yet puts BOTH the
// boundary and the recency floor ahead of every observation the feed holds, so
// the as-of lookup matches nothing and the column renders empty for every
// player. That is not a coverage gap -- it is the floor and a future boundary
// composing into an empty window. Measured 2026-08-03: the 2026 window was
// [2026-08-10, 2026-09-09] against a latest observation of 2026-08-03, so a
// year-split KTC column was blank for all 2026 rows, and would have been from
// January through August 10 of every year.
//
// LEAST against now() makes the request "the board as of the opening day, or as
// of today if that day has not come", which is what a reader asking for the
// upcoming season's value means. It is a no-op for any boundary already in the
// past, so every historical year is byte-identical in behaviour. The floor is
// derived from the clamped boundary, not the raw one, so the 30-day
// delisted-player guard still applies relative to whichever end the window
// actually lands on.
//
// opening_day is a date, and date_trunc resolves to the timestamptz overload,
// so LEAST compares two timestamptz values and introduces no coercion of its
// own. The date -> timestamptz step is the session-timezone dependence the
// boundary already carried before this clamp existed (production resolves it at
// New York local midnight, the test container at UTC), so this changes nothing
// about it. The clamped branch is TZ-independent outright, since now() is now().
// year_offset lands INSIDE a quoted interval literal here, so an unsanitized
// value carrying a single quote closes the literal and injects arbitrary SQL.
// POST /api/data-views/search sits ahead of the blanket auth guard and its
// params schema declares only `output`, so this was a direct anonymous
// request-to-SQL path -- confirmed executable, not merely a syntax error.
// sql_integer_param returns a number, so a valid offset emits byte-identical
// text to what this splice produced before the guard existed.
const year_axis_opening_day_boundary = ({
  opening_day_sql,
  year_offset_single
}) => {
  const offset = sql_integer_param({
    value: year_offset_single,
    param_name: 'year_offset'
  })
  return `LEAST(date_trunc('day', ${opening_day_sql}) + interval '${offset} year', now())`
}

// The same boundary anchored on a chosen calendar day within the row's own
// year rather than on that year's opening day. Selected by the
// `as_of_month_day` param; everything downstream of it -- the recency floor,
// the single as-of lookup -- is unchanged.
//
// The inner LEAST is the February 29 clamp. make_date RAISES rather than
// returning null on a day the month does not have (`select make_date(2023,2,29)`
// is `date field value out of range`), and that aborts the whole statement, so
// the clamp is load-bearing rather than defensive: it resolves to the month's
// last day whenever the requested day overruns it. `+ interval '1 month' -
// interval '1 day'` crosses the year correctly for December.
//
// year_offset folds into make_date's YEAR argument rather than being added as
// an interval afterwards, and that ordering is what makes the clamp resolve in
// the TARGET year: anchor 02-29 on row year 2023 with offset +1 yields
// 2024-02-29, because 2024 is a leap year. Clamping first and adding
// interval '1 year' yields 2024-02-28 -- verified -- which contradicts this
// feature's own semantic of the same calendar day within each row's year.
//
// There is deliberately NO outer LEAST(..., now()) here, and that is the one
// place this boundary diverges from the opening-day one.
//
// The future clamp exists because opening day is a boundary the SYSTEM picks:
// nobody asked for it, so a season whose opening day has not arrived yet would
// blank the column for every player, and falling back to "or as of today" is
// what a reader meant. `as_of_month_day` is the opposite -- the reader named
// the day. Clamping it substitutes a different day than the one requested,
// silently, and makes the column non-deterministic (its value drifts daily
// until the day arrives) while the chip still reads as a fixed date.
//
// Concretely, on 2026-08-16 a view carrying 09-10 and 12-31 on year 2026
// rendered BYTE-IDENTICAL values in both columns across all 500 rows, because
// both clamped to now(). Unclamped the two disagree as they should: 09-10
// resolves for 509 of 889 players (the latest observation, 2026-08-15, falls
// inside its 30-day window) and 12-31 is empty for all of them, which is the
// truthful answer to a question about a window that holds no observations.
// Blank here is the same blank any other empty window produces, not a new
// failure mode.
//
// make_date yields a `date`, which resolves against a timestamptz in the
// SESSION timezone exactly as date_trunc('day', opening_day) does, so this
// preserves that dependence rather than fixing it.
const year_axis_month_day_boundary = ({
  year_sql,
  year_offset_single,
  as_of_month_day
}) => {
  const { month, day } = as_of_month_day
  // The offset lands in raw arithmetic position here rather than inside an
  // interval literal, so it is sanitized at this splice site.
  const offset = sql_integer_param({
    value: year_offset_single,
    param_name: 'year_offset'
  })
  const first_of_month = `make_date((${year_sql}) + ${offset}, ${month}, 1)`
  return (
    `LEAST(${first_of_month} + (${day} - 1) * interval '1 day', ` +
    `${first_of_month} + interval '1 month' - interval '1 day')::timestamptz`
  )
}

// The single as-of lookup every axis uses: the most recent observation at or
// before `boundary_sql` that actually carries `metric_column`. A null boundary
// means "no upper bound" -- the latest observation outright. A null
// `lower_bound_sql` means "no recency floor" -- reach back arbitrarily far.
const as_of_observed_at = ({
  metric_column,
  params,
  data_view_options,
  boundary_sql = null,
  lower_bound_sql = null
}) =>
  function () {
    this.select(db.raw('MAX(observed_at)'))
      .from('keeptradecut_valuations')
      .where('pid', db.raw(data_view_options.pid_reference))
      .where('is_superflex', db.raw('?', [is_superflex_from_params(params)]))
      .whereNotNull(metric_column)

    if (boundary_sql) {
      this.where('observed_at', '<=', db.raw(boundary_sql))
    }

    if (lower_bound_sql) {
      this.where('observed_at', '>', db.raw(lower_bound_sql))
    }
  }

// The 894 players carrying ANY KeepTradeCut observation, against 28,129 in
// `player`. Registered once per query and shared by every KTC column, because it
// is the same relation regardless of metric, superflex flag or boundary -- three
// columns each computing it separately cost 64,134 buffers, of which two thirds
// were pure duplication.
//
// A loose index scan rather than `select distinct pid`: Postgres 16 has no index
// skip scan, so the plain DISTINCT falls back to a full parallel seq scan of all
// 2.38M rows (21,378 buffers). Walking the primary key one pid at a time reads
// 3,636. The recursion is the standard emulation -- take the lowest pid, then
// repeatedly take the lowest pid strictly greater than the last -- and it
// terminates when the lookahead subquery returns NULL, which is why the outer
// select filters those out.
const keeptradecut_valued_pids_cte = () =>
  db.raw(
    'with recursive ktc_pid_scan as (' +
      '(select pid from keeptradecut_valuations order by pid limit 1) ' +
      'union all ' +
      'select (select ktc_next.pid from keeptradecut_valuations ktc_next ' +
      'where ktc_next.pid > ktc_pid_scan.pid order by ktc_next.pid limit 1) ' +
      'from ktc_pid_scan where ktc_pid_scan.pid is not null' +
      ') select pid from ktc_pid_scan where pid is not null'
  )

const register_keeptradecut_valued_pids_cte = ({
  query,
  data_view_options
}) => {
  const cte_name = get_table_hash('ktc_valued_pids')
  if (!data_view_options.keeptradecut_valued_pids_cte) {
    query.with(cte_name, keeptradecut_valued_pids_cte())
    data_view_options.keeptradecut_valued_pids_cte = cte_name
  }
  return data_view_options.keeptradecut_valued_pids_cte
}

// The YEAR-axis as-of lookup, resolved ONCE per (pid, year) instead of once per
// outer row.
//
// As a correlated subquery this was O(outer rows), and the outer side of a
// player-year view is `player CROSS JOIN base_years` -- 28,129 players x 7 years
// = 196,903 rows, probed once per KTC column. A three-column view therefore ran
// 590,709 probes to answer a 500-row page, and only 894 players carry ANY KTC
// observation, so ~97% of those probes matched nothing.
//
// This drives off the 894 valued players instead: one lateral probe per
// (valued pid, year) -- 6,258 for a seven-year view -- each an Index Scan
// Backward on the primary key (pid, is_superflex, observed_at) that stops at the
// first row inside the window. The outer join is unchanged.
//
// It replaced a DISTINCT ON over the window, which scanned 112,115 rows and
// sorted them down to 3,347, at one heap fetch per candidate row.
//
// A covering index DOES remove those heap fetches. The claim that it could not
// -- made here and in this file's history twice -- was an artifact of an empty
// visibility map, not a property of the shape, and it was measured while
// `relallvisible` sat at 32 pages of 21,378. Once the table is vacuumed to
// all-visible, an `(is_superflex, observed_at, pid) INCLUDE (the three metrics)`
// index turns the DISTINCT ON into a pure index-only scan: 899 buffers with zero
// heap fetches, against this lateral's 25,102. Anyone re-deriving "a covering
// index would not help" from buffer counts alone will get the opposite answer.
//
// The lateral is kept regardless, on two grounds the buffer count does not show.
//
//   - Warm, the DISTINCT ON is 2.8x SLOWER despite reading 28x fewer buffers
//     (161ms against 58ms). Its cost is CPU -- sorting 106,036 index entries
//     down to 3,373 -- and every buffer it touches is already a shared_buffers
//     hit, so the buffer count is not measuring the thing that dominates.
//   - Such an index would erode its own advantage. The importer writes
//     `onConflict(pid, is_superflex, observed_at).merge([...])` over exactly the
//     three metric columns the index must INCLUDE, so every re-scrape update
//     would break HOT on a table currently running 95.5% HOT across 11.1M
//     updates -- bloating the index and pulling down the all-visible fraction
//     the index-only scan depends on.
//
// Both measured on production 2026-08-29, after the vacuum, with the index built
// and then dropped. Revisit only with a COLD measurement: 25,102 scattered reads
// against 899 contiguous ones is the regime where the covering index would win,
// and cold is the case this rewrite exists for.
//
// Measured on production 2026-08-29, full three-column query: 429,408 buffers ->
// 188,422. Output is identical -- verified across all twelve combinations of
// three metrics, both superflex values and both boundary types, zero symmetric
// difference in each.
//
// The year source is `opening_days` INNER JOINed to `base_years` rather than
// `opening_days` alone. Under DISTINCT ON the unfiltered 57 rows were free (the
// window predicate pruned them and constraining it measured no faster), but a
// lateral does work per year, so the unfiltered form would run 50,958 probes
// instead of 6,258. The inner join also preserves the old semantics exactly: a
// requested year absent from opening_days contributed nothing before and
// contributes nothing now.
const keeptradecut_year_axis_as_of_cte = ({
  metric_column,
  is_superflex,
  year_offset_single,
  as_of_month_day,
  valued_pids_cte
}) => {
  const boundary_sql = as_of_month_day
    ? year_axis_month_day_boundary({
        year_sql: 'ktc_od.year',
        year_offset_single,
        as_of_month_day
      })
    : year_axis_opening_day_boundary({
        opening_day_sql: 'ktc_od.opening_day',
        year_offset_single
      })

  return db.raw(
    `select ktc_p.pid, ktc_od.year, ktc_latest.${metric_column} ` +
      `from ${valued_pids_cte} ktc_p ` +
      'cross join (select ktc_od_src.year, ktc_od_src.opening_day ' +
      'from opening_days ktc_od_src ' +
      'inner join base_years on base_years.year = ktc_od_src.year) ktc_od ' +
      'cross join lateral (' +
      `select ktc_src.${metric_column} from keeptradecut_valuations ktc_src ` +
      'where ktc_src.pid = ktc_p.pid ' +
      `and ktc_src.is_superflex = ${is_superflex ? 'true' : 'false'} ` +
      `and ktc_src.${metric_column} is not null ` +
      `and ktc_src.observed_at <= ${boundary_sql} ` +
      `and ktc_src.observed_at > (${boundary_sql} - interval '${YEAR_AXIS_AS_OF_WINDOW}') ` +
      'order by ktc_src.observed_at desc limit 1' +
      ') ktc_latest'
  )
}

// One CTE per DISTINCT as-of rule, not per column: two columns sharing a metric,
// superflex flag, offset and boundary resolve the same rows, and re-registering
// the same name would emit a duplicate WITH alias (42712).
const register_keeptradecut_year_axis_cte = ({
  metric_column,
  query,
  params,
  data_view_options,
  year_offset_single,
  as_of_month_day
}) => {
  const is_superflex = is_superflex_from_params(params)
  // as_of_month_day is a PARSED OBJECT ({ month, day }), so it has to be spelled
  // out rather than interpolated: every distinct value stringifies to
  // "[object Object]", which collapses two columns anchored on different
  // calendar days onto one CTE and renders one day's observation under both
  // headers. Caught by the two-days-diverge result-equivalence oracle.
  const as_of_key = as_of_month_day
    ? `${as_of_month_day.month}-${as_of_month_day.day}`
    : 'opening_day'
  const cte_name = get_table_hash(
    `ktc_as_of/${metric_column}/${is_superflex}/${year_offset_single}/${as_of_key}`
  )

  if (!data_view_options.keeptradecut_as_of_ctes) {
    data_view_options.keeptradecut_as_of_ctes = new Set()
  }
  if (!data_view_options.keeptradecut_as_of_ctes.has(cte_name)) {
    // Registered before the as-of CTE that references it: a WITH item may only
    // reference items declared ahead of it, and knex emits them in call order.
    const valued_pids_cte = register_keeptradecut_valued_pids_cte({
      query,
      data_view_options
    })
    query.with(
      cte_name,
      keeptradecut_year_axis_as_of_cte({
        metric_column,
        is_superflex,
        year_offset_single,
        as_of_month_day,
        valued_pids_cte
      })
    )
    data_view_options.keeptradecut_as_of_ctes.add(cte_name)
  }

  return cte_name
}

// The WEEK-axis as-of lookup, resolved ONCE per (pid, year, week) instead of
// once per outer row -- the same move the year axis above already made, for the
// same reason and with a larger effect.
//
// As a correlated subquery this was O(outer rows), and the outer side of a
// player-year-week view is every player in the filtered population times every
// week in scope. A seven-year wide-receiver week split is 458,250 such rows, and
// it paid TWICE per row: once for the `MAX(observed_at)` SubPlan and again for
// the outer index scan that re-fetched the row at that instant. It produced
// 28,076 rows out of those 458,250 probes, because only 894 players carry any
// KeepTradeCut observation at all.
//
// This drives off the valued players crossed with exactly the (year, week) pairs
// in play, one lateral probe each, stopping at the first row at or before the
// week's boundary. The outer re-fetch disappears: the lateral returns the metric
// itself rather than an instant to look the metric up by.
//
// Measured on production 2026-08-29, seven-year WR week split: 1,510,276 buffers
// -> 158,110 and 2,243ms -> 423ms, zero symmetric difference over 28,076 rows.
// The win holds at every population size rather than trading narrow views for
// wide ones -- QB 575,264 -> 63,029, TE and K verified identical too -- because
// the CTE is inlined and the pid join prunes it rather than it being computed
// whole and then filtered.
//
// The (year, week) source is `player_years_weeks`, NOT `base_years`. The year
// axis could use base_years because a year request names its years, but a week
// request can also name its WEEKS, and base_years would widen a single-week view
// back out to every week of that year. player_years_weeks already carries both
// filters, so scoping to its distinct pairs is exactly the requested grain.
//
// No recency floor and no year_offset here, both deliberately: the floor was the
// year axis's alone, and week-axis year_offset was an unimplemented TODO on the
// correlated form. This preserves each of those as it found them.
const keeptradecut_week_axis_as_of_cte = ({
  metric_column,
  is_superflex,
  valued_pids_cte
}) =>
  db.raw(
    `select ktc_p.pid, ktc_w.year, ktc_w.week, ktc_latest.${metric_column} ` +
      `from ${valued_pids_cte} ktc_p ` +
      'cross join (select distinct ktc_pyw.year, ktc_pyw.week, ' +
      'ktc_ts.week_timestamp ' +
      'from player_years_weeks ktc_pyw ' +
      'inner join nfl_year_week_timestamp ktc_ts ' +
      'on ktc_ts.year = ktc_pyw.year and ktc_ts.week = ktc_pyw.week) ktc_w ' +
      'cross join lateral (' +
      `select ktc_src.${metric_column} from keeptradecut_valuations ktc_src ` +
      'where ktc_src.pid = ktc_p.pid ' +
      `and ktc_src.is_superflex = ${is_superflex ? 'true' : 'false'} ` +
      `and ktc_src.${metric_column} is not null ` +
      'and ktc_src.observed_at <= to_timestamp(ktc_w.week_timestamp) ' +
      'order by ktc_src.observed_at desc limit 1' +
      ') ktc_latest'
  )

// One CTE per (metric, superflex) pair, for the same reason the year axis
// registers one per distinct as-of rule: two columns resolving the same rows
// would otherwise emit a duplicate WITH alias (42712).
const register_keeptradecut_week_axis_cte = ({
  metric_column,
  query,
  params,
  data_view_options
}) => {
  const is_superflex = is_superflex_from_params(params)
  const cte_name = get_table_hash(
    `ktc_week_as_of/${metric_column}/${is_superflex}`
  )

  if (!data_view_options.keeptradecut_as_of_ctes) {
    data_view_options.keeptradecut_as_of_ctes = new Set()
  }
  if (!data_view_options.keeptradecut_as_of_ctes.has(cte_name)) {
    // Registered before the as-of CTE that references it, as above: a WITH item
    // may only reference items declared ahead of it.
    const valued_pids_cte = register_keeptradecut_valued_pids_cte({
      query,
      data_view_options
    })
    query.with(
      cte_name,
      keeptradecut_week_axis_as_of_cte({
        metric_column,
        is_superflex,
        valued_pids_cte
      })
    )
    data_view_options.keeptradecut_as_of_ctes.add(cte_name)
  }

  return cte_name
}

const keeptradecut_join = ({
  metric_column,
  query,
  table_name,
  join_type = 'LEFT',
  row_axes = [],
  params = {},
  data_view_options = {}
}) => {
  // using an inner join for week splits because its much faster, not sure why
  const join_func = get_join_func(
    row_axes.includes('week') ? 'INNER' : join_type
  )
  const { year_offset_single, as_of_month_day } = get_default_params({ params })

  // The week axis takes precedence over the year axis below, so the pre-aggregated
  // path covers exactly the year-axis-only case. opening_days is no longer joined
  // into the OUTER query from here at all -- the boundary it supplied now lives
  // inside the CTE, and the age column registers its own join when it needs one.
  if (row_axes.includes('year') && !row_axes.includes('week')) {
    const cte_name = register_keeptradecut_year_axis_cte({
      metric_column,
      query,
      params,
      data_view_options,
      year_offset_single,
      as_of_month_day
    })

    query[join_func](`${cte_name} as ${table_name}`, function () {
      this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)

      // Same year predicate the opening_days form carried, moved onto the
      // pre-aggregated row's own year.
      if (data_view_options.year_reference) {
        this.andOn(
          db.raw(`${table_name}.year`),
          '=',
          db.raw(`(${data_view_options.year_reference})`)
        )
      } else if (params.year) {
        // Bare value position, straight from request params on the
        // unauthenticated /data-views/search path, so each entry is coerced to
        // an integer rather than spliced as given.
        const year_array = (
          Array.isArray(params.year) ? params.year : [params.year]
        ).map((value) => sql_integer_param({ value, param_name: 'year' }))
        if (year_array.length > 0) {
          this.andOn(db.raw(`${table_name}.year IN (${year_array.join(', ')})`))
        }
      }
    })
    return
  }

  // The week axis takes precedence over the year axis above, and a year+week
  // request resolves its boundary on this arm, so the pre-aggregated week CTE
  // covers both. `nfl_year_week_timestamp` is no longer joined into the OUTER
  // query from here at all -- the boundary it supplied now lives inside the CTE.
  // That flag is read and written nowhere but this file, so nothing downstream
  // depended on the join it announced.
  if (row_axes.includes('week')) {
    const cte_name = register_keeptradecut_week_axis_cte({
      metric_column,
      query,
      params,
      data_view_options
    })

    query[join_func](`${cte_name} as ${table_name}`, function () {
      this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
      // The same (year, week) key the outer nfl_year_week_timestamp join
      // carried, moved onto the pre-aggregated row's own year and week.
      this.andOn(
        db.raw(`${table_name}.year`),
        '=',
        db.raw(data_view_options.year_reference || 'player_years_weeks.year')
      )
      this.andOn(
        db.raw(`${table_name}.week`),
        '=',
        db.raw(data_view_options.week_reference || 'player_years_weeks.week')
      )
    })
    return
  }

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
    this.andOn(
      `${table_name}.is_superflex`,
      '=',
      db.raw('?', [is_superflex_from_params(params)])
    )

    // No recency floor on this arm. It was the year axis's alone
    // (YEAR_AXIS_AS_OF_WINDOW, guarding a delisted player's last rank from being
    // carried forward) and it moved into the pre-aggregated CTE with that arm.
    let boundary_sql = null

    if (params.date) {
      // The old form carried `AT TIME ZONE 'UTC'` here. It was a verified no-op
      // on both DST sides against the epoch column, and translating it onto a
      // timestamptz would introduce a four-hour shift where none exists, so it
      // is deleted rather than carried forward.
      // params.date is a binding; year_offset_single is spliced into the same
      // quoted interval literal as the year-axis boundary above and needs the
      // same guard for the same reason.
      const offset = sql_integer_param({
        value: year_offset_single,
        param_name: 'year_offset'
      })
      boundary_sql = db
        .raw(`(to_timestamp(?, 'YYYY-MM-DD') + interval '${offset} year')`, [
          params.date
        ])
        .toString()
    }

    this.andOn(
      `${table_name}.observed_at`,
      '=',
      as_of_observed_at({
        metric_column,
        params,
        data_view_options,
        boundary_sql
      })
    )
  }

  query[join_func]('keeptradecut_valuations as ' + table_name, join_conditions)
}

// keeptradecut_valuations is date-grained (no year column), so the generic
// year-based correlated-aggregate path in select-string -- which filters
// `inner_table.year BETWEEN ...` -- cannot reduce a range year_offset; it
// emitted `(SELECT SUM(<unjoined alias>.v) ...)` against a relation the
// range-offset join-skip never materialized (invalid SQL), and the single-value
// join silently collapsed the range to year_offset[0].
//
// This bespoke main_select_string_year_offset_range (consumed by select-string's
// has_year_offset_range branch) instead AVERAGES the as-of snapshots at the
// offset-shifted opening days, mirroring the single-offset year-split semantics
// generalised across the range. KTC value/ranks are point-in-time, not
// additive, so AVG (not SUM) is the correct reduction -- consistent with
// player_adp.
//
// Each offset resolves through the same as-of rule as the join: the latest
// observation at or before that opening day carrying the metric. An offset with
// no such observation contributes NULL, which AVG skips, rather than dragging
// the average toward zero.
const keeptradecut_year_offset_range_select =
  (metric_column) =>
  ({ params = {}, data_view_options = {} }) => {
    const offset_range = resolve_year_offset_range(params)
    const [min_off, max_off] = offset_range
    const pid_reference = data_view_options.pid_reference
    const is_superflex = is_superflex_from_params(params)
    // `anchor` is interpolated raw into the SQL in bare value position, so it
    // must always be a real number. Two reasons, and the second is why the
    // params branch is coerced rather than trusted: with no year_reference and
    // no year param, Number(undefined) is NaN and the emitted `od_o.year = NaN`
    // parses as a reference to a column named "nan" -- a 42703 on any
    // year_offset range request that omits year; and `params.year` arrives
    // unvalidated from the unauthenticated /data-views/search path, where a
    // string closes this subquery and comments out the rest.
    const { year, as_of_month_day } = get_default_params({ params })
    const anchor = data_view_options.year_reference
      ? `(${data_view_options.year_reference})`
      : sql_integer_param({ value: year, param_name: 'year' })

    const per_offset_selects = []
    for (let off = min_off; off <= max_off; off++) {
      // Same clamp and same recency floor as the year-axis join -- this IS the
      // year axis, reduced across a range of offsets. An unbounded reach would
      // reintroduce the delisted-player tail one offset at a time, and an
      // unclamped boundary would empty every offset landing past today.
      const boundary = as_of_month_day
        ? year_axis_month_day_boundary({
            year_sql: 'od_o.year',
            year_offset_single: off,
            as_of_month_day
          })
        : year_axis_opening_day_boundary({
            opening_day_sql: 'od_o.opening_day',
            year_offset_single: off
          })
      per_offset_selects.push(
        `(SELECT ktc_o.${metric_column} FROM keeptradecut_valuations ktc_o ` +
          `WHERE ktc_o.pid = ${pid_reference} AND ktc_o.is_superflex = ${is_superflex} ` +
          `AND ktc_o.${metric_column} IS NOT NULL ` +
          `AND ktc_o.observed_at <= ${boundary} ` +
          `AND ktc_o.observed_at > (${boundary} - interval '${YEAR_AXIS_AS_OF_WINDOW}') ` +
          `ORDER BY ktc_o.observed_at DESC LIMIT 1)`
      )
    }

    return (
      `(SELECT AVG(offset_value) FROM opening_days od_o ` +
      `CROSS JOIN LATERAL (VALUES ${per_offset_selects
        .map((s) => `(${s})`)
        .join(', ')}) AS offsets(offset_value) ` +
      `WHERE od_o.year = ${anchor})`
    )
  }

const create_keeptradecut_definition = (type) => {
  const metric_column = METRIC_COLUMNS[type]

  return {
    table_alias: (opts) => generate_table_alias({ type, ...opts }),
    select_as: () => `player_keeptradecut_${type}`,
    column_name: metric_column,
    main_where: ({ table_name }) => `${table_name}.${metric_column}`,
    join: ({ ...args }) => keeptradecut_join({ metric_column, ...args }),
    main_select_string_year_offset_range:
      keeptradecut_year_offset_range_select(metric_column),
    week_select: () => `nfl_year_week_timestamp.week`,
    source: { grain: 'player_year', supports_row_axes: ['year', 'week'] },
    get_cache_info: get_cache_info_for_keeptradecut
  }
}

export default {
  player_keeptradecut_value: create_keeptradecut_definition('value'),
  player_keeptradecut_overall_rank:
    create_keeptradecut_definition('overall_rank'),
  player_keeptradecut_position_rank:
    create_keeptradecut_definition('position_rank')
}
