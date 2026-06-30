// Participation-status signal for player week-grain data views.
//
// Composes two reused builders into one hidden per-(pid, year, week) signal so
// the renderer can tell "active but recorded zero" (→ 0) from "on bye" (→ BYE)
// from "did not play" (→ blank). No stat value is rewritten; only the display
// classification is derived from this signal.
//
// Reuse (not new parallel CTEs):
//   - player_participation_weeks  -- the player_gamelogs ⋈ nfl_games REG join
//     with the active filter RELAXED (player-team-bridge-cte.mjs). Carries the
//     raw bool_or(active). Sibling active/started/snaps task consumes this CTE
//     directly via the `columns` extension point -- no enum decoding.
//   - team_weeks_played           -- DISTINCT (team, year, week) the team played
//     (rate-type-per-game.mjs), shared with the per-game denominator's h/v union.
//   - player_years_teams          -- the player's season team set, for bye
//     classification (player-team-bridge-cte.mjs).
//
// Bye classification (v1, conservative): a no-gamelog week is 'bye' only when
// NONE of the player's season teams played that week. The team-played check is a
// correlated NOT EXISTS against team_weeks_played rather than a top-level LEFT
// JOIN: a season-traded player's teams[] can match multiple team_weeks_played
// rows in a single week, and a LEFT JOIN would fan the output row -- doubling the
// real stat aggregates for that player-week. NOT EXISTS is scalar, so the row
// grain stays 1:1. Trade-boundary / season-long-inactive precision is deferred to
// precise-bye-detection-inactive-traded-players.

import db from '#db'
import { PARTICIPATION_STATUS } from '#libs-shared/data-views/participation-cell.mjs'
import {
  player_participation_weeks_cte_sql,
  player_years_teams_cte_sql,
  PLAYER_PARTICIPATION_WEEKS_CTE,
  PLAYER_YEARS_TEAMS_CTE
} from '#libs-server/data-views/player-team-bridge-cte.mjs'
import {
  register_team_weeks_played_cte,
  TEAM_WEEKS_PLAYED_CTE
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'

// Register the three CTEs the participation signal reads. Idempotent via
// query_context.registered_ctes, so calling this alongside the team-bridge
// column path (which may already have registered player_years_teams) is safe.
export const register_participation_status_ctes = ({
  players_query,
  query_context,
  year_range
}) => {
  if (!query_context.registered_ctes) query_context.registered_ctes = new Set()

  if (!query_context.registered_ctes.has(PLAYER_PARTICIPATION_WEEKS_CTE)) {
    players_query.with(
      PLAYER_PARTICIPATION_WEEKS_CTE,
      db.raw(player_participation_weeks_cte_sql({ year_range }))
    )
    query_context.registered_ctes.add(PLAYER_PARTICIPATION_WEEKS_CTE)
  }

  if (!query_context.registered_ctes.has(PLAYER_YEARS_TEAMS_CTE)) {
    players_query.with(
      PLAYER_YEARS_TEAMS_CTE,
      db.raw(player_years_teams_cte_sql({ year_range }))
    )
    query_context.registered_ctes.add(PLAYER_YEARS_TEAMS_CTE)
  }

  register_team_weeks_played_cte({ players_query, query_context })
}

// The in-scope year reference for a player week-grain query. The identity's
// year_column (player_years.year) points at a lower-grain CTE that is NOT joined
// into the week-grain outer query -- only the week source (player_years_weeks)
// is, and it carries an equal `year` column. Derive the year reference from the
// week reference's table so the participation joins reference columns that are
// actually in scope.
export const participation_year_reference = ({ week_reference }) =>
  `${week_reference.split('.')[0]}.year`

// LEFT JOIN the two 1:1 CTEs onto the output row at (pid, year, week) /
// (pid, year). team_weeks_played is read via NOT EXISTS in the select CASE, not
// joined here (see the row-fan note above). Reference-driven (the caller passes
// in-scope references) and idempotent via a join guard set.
export const join_participation_status_ctes = ({
  players_query,
  query_context,
  pid_reference,
  year_reference,
  week_reference
}) => {
  if (!query_context.joined_participation_ctes) {
    query_context.joined_participation_ctes = new Set()
  }

  if (
    !query_context.joined_participation_ctes.has(PLAYER_PARTICIPATION_WEEKS_CTE)
  ) {
    players_query.leftJoin(PLAYER_PARTICIPATION_WEEKS_CTE, function () {
      this.on(`${PLAYER_PARTICIPATION_WEEKS_CTE}.pid`, pid_reference)
      this.andOn(`${PLAYER_PARTICIPATION_WEEKS_CTE}.year`, '=', year_reference)
      this.andOn(`${PLAYER_PARTICIPATION_WEEKS_CTE}.week`, '=', week_reference)
    })
    query_context.joined_participation_ctes.add(PLAYER_PARTICIPATION_WEEKS_CTE)
  }

  if (!query_context.joined_participation_ctes.has(PLAYER_YEARS_TEAMS_CTE)) {
    players_query.leftJoin(PLAYER_YEARS_TEAMS_CTE, function () {
      this.on(`${PLAYER_YEARS_TEAMS_CTE}.pid`, pid_reference)
      this.andOn(`${PLAYER_YEARS_TEAMS_CTE}.year`, '=', year_reference)
    })
    query_context.joined_participation_ctes.add(PLAYER_YEARS_TEAMS_CTE)
  }
}

// The hidden participation_status expression. Three arms only (review driver 1):
//   active → 'active' (gamelog row, active true)   → renderer shows 0
//   bye    → 'bye'    (no gamelog row, no team played that week) → shows BYE
//   else   → NULL     (inactive/dnp/not-rostered)  → renderer shows blank
// Returned without an alias; the caller adds `AS participation_status` and
// repeats this expression verbatim in GROUP BY (Postgres cannot group by alias).
// pid_reference is accepted for signature stability with the join helpers; the
// CASE correlates through the already-joined player_years_teams instead.
export const participation_status_select = ({
  pid_reference,
  year_reference,
  week_reference
}) =>
  `CASE
     WHEN ${PLAYER_PARTICIPATION_WEEKS_CTE}.active THEN '${PARTICIPATION_STATUS.ACTIVE}'
     WHEN ${PLAYER_PARTICIPATION_WEEKS_CTE}.pid IS NULL
          AND ${PLAYER_YEARS_TEAMS_CTE}.teams IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ${TEAM_WEEKS_PLAYED_CTE}
            WHERE ${TEAM_WEEKS_PLAYED_CTE}.year = ${year_reference}
              AND ${TEAM_WEEKS_PLAYED_CTE}.week = ${week_reference}
              AND ${TEAM_WEEKS_PLAYED_CTE}.team = ANY(${PLAYER_YEARS_TEAMS_CTE}.teams)
          )
       THEN '${PARTICIPATION_STATUS.BYE}'
     ELSE NULL
   END`
