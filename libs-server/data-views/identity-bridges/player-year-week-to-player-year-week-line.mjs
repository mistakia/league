import db from '#db'
import { physical_year_projection } from '#libs-server/data-views/physical-season-columns.mjs'

export const from = 'player_year_week'
export const to = 'player_year_week_line'
export const mode = 'default'

const CTE_NAME = 'player_years_weeks_lines'

// One row per alternate line a book actually posted for the player's game.
//
// THE ROWS ARE THE SELECTIONS, and that is what separates this bridge from its
// two siblings. player_years_weeks cross-joins a fixed universe: every player
// against every week, whether or not anything happened. A ladder has no such
// universe to cross-join against -- the rungs differ per book (FanDuel posts a
// fixed 25-yard grid of 10 rungs, DraftKings centres a finer ladder on each
// player) and differ per player-game within one book. Synthesising a rung
// domain and left-joining it would produce a mostly-null table many times the
// size of the answer, so the market rows themselves are the domain.
//
// INNER JOIN, DELIBERATELY. A player with no ladder for that week has no rungs
// and therefore no rows, which is the axis definition rather than a gap: the
// question "what did the book post" has no answer for a player the book did not
// post. This is the one place a line-axis view differs in POPULATION from the
// same view without the axis, and it is why the axis is opt-in.
//
// WHY selection_metric_line IS NOT NULL. It is the axis key. A NULL rung is not
// a position on the ladder, and admitting it would make the key non-total --
// two selections at NULL would collapse onto one row with nothing to separate
// them, the same collapse this whole axis exists to undo.
//
// The rung set comes from line-axis-sources.mjs rather than from anything read
// off the emitted SQL, because the domain has to exist before any column's CTE
// is built -- those CTEs get correlated against it.
export const add_cte = ({ query_context }) => {
  const { players_query, line_axis_sources = [] } = query_context
  if (query_context.registered_ctes.has(CTE_NAME)) return

  if (!line_axis_sources.length) {
    throw new Error(
      'line row axis is active but no betting column named an explicit market_type: nothing defines the rungs'
    )
  }

  const year_range = query_context.year_range || []
  const week_range = query_context.week_range || []

  // nfl_games is joined UNALIASED so the year projection can be derived:
  // physical_year_projection maps a registered TABLE name to its physical
  // column, and an alias is not in that map, so aliasing it here would make the
  // projection unresolvable. It now refuses rather than emitting `<alias>.year`
  // -- a column that does not exist -- but the join must stay unaliased either
  // way.
  const cte_query = db('prop_markets_index as m')
    .distinct(
      'pms.selection_pid as pid',
      physical_year_projection('nfl_games'),
      'nfl_games.week as week',
      'pms.selection_metric_line as selection_metric_line'
    )
    .innerJoin('nfl_games', function () {
      this.on('nfl_games.esbid', '=', 'm.esbid').andOn(
        'nfl_games.season_year',
        '=',
        'm.season_year'
      )
    })
    .innerJoin('prop_market_selections_index as pms', function () {
      this.on('pms.source_id', '=', 'm.source_id')
        .andOn('pms.source_market_id', '=', 'm.source_market_id')
        .andOn('pms.time_type', '=', 'm.time_type')
    })
    .whereNotNull('pms.selection_metric_line')

  // Both sides carry the year so the partitioned scans prune; see the Year
  // Pushdown Contract in this directory's ABOUT.
  if (year_range.length) {
    cte_query.whereIn('nfl_games.season_year', year_range)
    cte_query.whereIn('m.season_year', year_range)
  }
  if (week_range.length) {
    cte_query.whereIn('nfl_games.week', week_range)
  }

  // One OR arm per distinct market selector. Two arms are two different books
  // on the same market type -- the line-shopping case -- and their rungs union
  // into one domain so a row carries both books' prices for the same bet.
  cte_query.where(function () {
    for (const source of line_axis_sources) {
      this.orWhere(function () {
        this.whereIn('m.market_type', source.market_type)
        if (source.source_id.length) {
          this.whereIn('m.source_id', source.source_id)
        }
        if (source.time_type.length) {
          this.whereIn('m.time_type', source.time_type)
        }
        if (source.selection_type.length) {
          this.whereIn('pms.selection_type', source.selection_type)
        }
      })
    }
  })

  // Plain `with`, not `withMaterialized`, for the reason both sibling bridges
  // record: the fence is an optimizer barrier that makes the planner estimate
  // one row against thousands and pick a nested loop.
  players_query.with(CTE_NAME, cte_query)
  query_context.registered_ctes.add(CTE_NAME)
}

// Correlated on pid, year AND week -- unlike the week bridge, which drops the
// year correlation for a measured planner reason. That reason does not transfer
// here: player_years_weeks_lines is built from market rows rather than from
// player_years, so its (year, week) pair is NOT implied by the pid the way
// player_years_weeks' is. Dropping either correlation would match a player's
// week-3 rungs onto his week-9 row.
export const join_cte = ({ query_context }) => {
  const { players_query, pid_reference, year_reference, week_reference } =
    query_context
  players_query.innerJoin(CTE_NAME, function () {
    this.on(`${CTE_NAME}.pid`, '=', pid_reference)
      .andOn(`${CTE_NAME}.year`, '=', year_reference)
      .andOn(`${CTE_NAME}.week`, '=', week_reference)
  })
}

export default { from, to, mode, add_cte, join_cte }
