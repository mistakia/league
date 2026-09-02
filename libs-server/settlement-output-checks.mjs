// @ts-check
/*
  SQL for the two registered checks that read prop-market settlement OUTPUT.

  This lives beside the registry rather than inside it for one reason: the
  calibration figures in those checks must be measured by running the SHIPPED
  query, and production is reachable from a workstation only through
  `ssh league psql`. Exporting the SQL as a string lets a probe pipe the exact
  bytes the check will run, instead of a paraphrase that drifts from it.

  Everything here derives the market scope from `market_type_mappings`. Scoping
  by arm NAME is how the null-pid defect was under-counted twice in one day --
  first as three `longest-x` arms, then as 354 rows, when it is 37 types and was
  1,320 rows, with the quarter- and half-scoped arms the larger half. A
  name-scoped audit of a handler-level defect finds only the fraction that
  shares a naming convention with the first symptom.
*/

import { stat_countable_play_types } from '#libs-shared/constants/play-type-constants.mjs'
import { market_type_mappings } from '#libs-server/prop-market-settlement/market-type-mappings.mjs'

// market_type_mappings is a union of a dozen entry shapes, so a property only
// SOME arms carry is invisible to the type checker on the union. Reading a
// mapping through one accessor keeps that cast in a single place rather than
// scattering it down every expression below.
const mapping_for = (/** @type {string} */ market_type) =>
  /** @type {Record<string, any>} */ (
    /** @type {Record<string, any>} */ (market_type_mappings)[market_type]
  )

// The market types both checks are about: every mapping whose handler reads
// nfl_plays AND which names a player column, so the market is about one
// player. 37 of them today. Team markets (team_aggregate) are deliberately
// out: their selection_pid holds a TEAM abbreviation, so a null-pid assertion
// and a per-player recomputation both mean something different there.
export const nfl_plays_player_market_types = () =>
  Object.keys(market_type_mappings).filter((market_type) => {
    const mapping = mapping_for(market_type)
    return (
      mapping.handler === 'NFL_PLAYS' &&
      mapping.player_column &&
      !mapping.team_aggregate
    )
  })

// The three role columns those mappings aggregate by. Derived rather than
// listed: a mapping introducing a fourth role column would otherwise be scoped
// into the checks by the type list above and then silently graded against no
// truth CTE at all, which reads as agreement.
export const nfl_plays_player_columns = () => [
  ...new Set(
    nfl_plays_player_market_types().map(
      (market_type) => mapping_for(market_type).player_column
    )
  )
]

const quote = (/** @type {string} */ value) => `'${value.replace(/'/g, "''")}'`

export const market_type_in_list = () =>
  nfl_plays_player_market_types().map(quote).join(', ')

const play_type_in_list = () => stat_countable_play_types.map(quote).join(', ')

// The period predicate, matching _apply_period_filters in the settlement
// worker: a quarter filter is one quarter, half 1 is quarters 1-2 and half 2 is
// quarters 3-4, and a mapping with neither takes the whole game.
const period_predicate = (/** @type {Record<string, any>} */ mapping) => {
  if (mapping.quarter_filter) {
    return `quarter = ${Number(mapping.quarter_filter)}`
  }
  if (mapping.half_filter === 1) {
    return 'quarter in (1, 2)'
  }
  if (mapping.half_filter === 2) {
    return 'quarter in (3, 4)'
  }
  return 'true'
}

// One market type's metric, as an aggregate over the plays already filtered to
// its player. This reproduces _calculate_plays_metric:
//
//   count_receptions / count_attempts  count plays whose single flag column is
//                                      true
//   MAX                                the longest single play, 0 when none
//   default                            the sum, 0 when none
//
// Settlement drops plays null in every metric column BEFORE aggregating; sum(),
// max() and a `= true` filter each ignore nulls, so the drop is implicit here
// rather than absent.
const metric_aggregate = (/** @type {Record<string, any>} */ mapping) => {
  const columns = mapping.metric_columns || []

  // Every one of the 37 carries exactly one metric column today. A second one
  // would need summing per play before aggregating, which none of the shapes
  // below express -- so refuse rather than grade the first column and report a
  // confident wrong answer.
  if (columns.length !== 1) {
    throw new Error(
      `settlement-output checks cannot express a ${columns.length}-column metric (${columns.join(', ')}); teach metric_aggregate the shape before scoping it in`
    )
  }

  const [column] = columns
  const period = period_predicate(mapping)

  if (
    mapping.special_logic === 'count_receptions' ||
    mapping.special_logic === 'count_attempts'
  ) {
    return `count(*) filter (where ${period} and ${column} = true)`
  }
  if (mapping.aggregation_type === 'MAX') {
    return `max(${column}) filter (where ${period})`
  }
  return `sum(${column}) filter (where ${period})`
}

// The graded population, shared by every arm of both checks so the denominator
// cannot drift from the rows actually scanned. `selection_result is not null`
// IS what graded means: a market that fails to settle writes neither the result
// nor the metric, so a settled row is exactly one carrying a result.
export const graded_selection_from = `
  from prop_markets_index m
  join prop_market_selections_index s
    on s.source_id = m.source_id
   and s.source_market_id = m.source_market_id
   and s.time_type = m.time_type
`

export const graded_selection_where = `
  m.market_type in (${market_type_in_list()})
  and s.selection_result is not null
`

const graded_selection_scan = `
  ${graded_selection_from}
  where ${graded_selection_where}
`

/**
 * Check A -- per-source scanned and violating counts for graded player props
 * carrying no player.
 *
 * @returns {string}
 */
export const null_pid_counts_sql = () => `
  select
    m.source_id::text as source_id,
    count(*) as scanned,
    count(*) filter (where s.selection_pid is null) as null_pid
  ${graded_selection_scan}
  group by 1
`

/**
 * Check A -- the violating rows themselves, at selection grain.
 *
 * @returns {string}
 */
export const null_pid_rows_sql = () => `
  select
    m.source_id::text as source_id,
    m.source_market_id::text as source_market_id,
    s.source_selection_id::text as source_selection_id,
    s.time_type::text as time_type
  ${graded_selection_scan}
    and s.selection_pid is null
`

// Check B's gradeable predicate, as SQL. A graded row is gradeable only when
// there is something to recompute AGAINST: a player, a stored metric, a game on
// its own market row, and plays loaded for that game. Each of those absences is
// a real population rather than a hypothetical -- graded rows whose market row
// carries a null esbid number in the hundreds -- and grading them would compare
// a stored value against a recomputation of nothing, which returns 0 and reads
// as a disagreement on every single row.
const CHECK_B_GRADEABLE = `
  s.selection_pid is not null
  and s.metric_result_value is not null
  and m.esbid is not null
  and exists (select 1 from nfl_plays p where p.esbid = m.esbid)
`

// One aggregate CTE per role column rather than one per market type. The 37
// types collapse to 22 distinct arm shapes, but the shapes differ only in which
// column and which period they read -- so a single pass per role column
// carrying one filtered aggregate per shape reads the play corpus three times
// instead of twenty-two.
const truth_ctes = (/** @type {string} */ seed) =>
  nfl_plays_player_columns()
    .map((player_column) => {
      const aggregates = nfl_plays_player_market_types()
        .filter(
          (market_type) =>
            mapping_for(market_type).player_column === player_column
        )
        .map(
          (market_type) =>
            `${metric_aggregate(mapping_for(market_type))} as ${metric_alias(market_type)}`
        )

      return `
        truth_${player_column} as (
          select
            p.esbid,
            p.${player_column} as pid,
            ${aggregates.join(',\n            ')}
          from nfl_plays p
          where p.${player_column} is not null
            and p.play_type in (${play_type_in_list()})
            and p.esbid in (select esbid from ${seed})
          group by 1, 2
        )`
    })
    .join(',\n')

// Postgres caps an identifier at 63 bytes and truncates silently past it, which
// would collapse two long market types onto one column and grade both against
// whichever the aggregate list wrote last. Index the alias instead of naming it
// after the type.
const metric_alias = (/** @type {string} */ market_type) =>
  `m_${nfl_plays_player_market_types().indexOf(market_type)}`

// The expected metric for a row, dispatched on its own market type. Every one
// of the 37 appears, so the CASE has no fallback arm -- a type reaching here
// without a branch means the type list and the aggregate list disagree, and
// `else null` would report that as agreement.
const expected_metric_case = () => `
  case m.market_type
    ${nfl_plays_player_market_types()
      .map((market_type) => {
        const { player_column } = mapping_for(market_type)
        return `when ${quote(market_type)} then coalesce(t_${player_column}.${metric_alias(market_type)}, 0)`
      })
      .join('\n    ')}
  end
`

const truth_joins = () =>
  nfl_plays_player_columns()
    .map(
      (player_column) => `
      left join truth_${player_column} t_${player_column}
        on t_${player_column}.esbid = m.esbid
       and t_${player_column}.pid = s.selection_pid`
    )
    .join('')

/**
 * Check B -- per-source scanned, gradeable and disagreeing counts.
 *
 * @returns {string}
 */
export const metric_recompute_counts_sql = () => `
  with seed as (
    select distinct m.esbid
    ${graded_selection_scan}
      and ${CHECK_B_GRADEABLE}
  ),
  ${truth_ctes('seed')}
  select
    m.source_id::text as source_id,
    count(*) filter (where ${CHECK_B_GRADEABLE}) as gradeable,
    count(*) filter (where not (${CHECK_B_GRADEABLE})) as ungradeable,
    count(*) filter (
      where ${CHECK_B_GRADEABLE}
        and s.metric_result_value <> (${expected_metric_case()})
    ) as disagrees
  ${graded_selection_from}
  ${truth_joins()}
  where ${graded_selection_where}
  group by 1
`

/**
 * Check B -- the disagreeing rows themselves, at selection grain.
 *
 * @returns {string}
 */
export const metric_recompute_rows_sql = () => `
  with seed as (
    select distinct m.esbid
    ${graded_selection_scan}
      and ${CHECK_B_GRADEABLE}
  ),
  ${truth_ctes('seed')}
  select
    m.source_id::text as source_id,
    m.source_market_id::text as source_market_id,
    s.source_selection_id::text as source_selection_id,
    s.time_type::text as time_type,
    m.market_type::text as market_type,
    m.esbid,
    s.selection_pid,
    s.metric_result_value as stored_metric,
    (${expected_metric_case()}) as expected_metric
  ${graded_selection_from}
  ${truth_joins()}
  where ${graded_selection_where}
    and ${CHECK_B_GRADEABLE}
    and s.metric_result_value <> (${expected_metric_case()})
`
