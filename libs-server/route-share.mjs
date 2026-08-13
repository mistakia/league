import debug from 'debug'

import db from '#db'
import { fixTeam } from '#libs-shared'

const log = debug('route-share')

// numeric(5,2) on player_receiving_gamelogs.route_share
export const ROUTE_SHARE_MAX = 999.99

/**
 * Route share as a percentage of the team's dropbacks the player ran a route on.
 *
 * Returns null when either input is missing, and also when team_dropbacks is
 * below player_routes -- that ordering is impossible, so it means the dropback
 * data for the game is incomplete (`nfl_plays.is_qb_dropback` is populated by
 * scripts/import-plays-nflfastr.mjs) and a computed share would be nonsense
 * rather than merely imprecise.
 *
 * This is the single derivation. scripts/generate-player-gamelogs.mjs computes
 * the value inline as it builds a row; recompute_route_share below fills rows
 * whose routes landed after that run. Two spellings of the same formula is the
 * failure this module exists to prevent.
 */
export const calculate_route_share = ({ player_routes, team_dropbacks }) => {
  if (!player_routes || !team_dropbacks) {
    return null
  }

  if (team_dropbacks < player_routes) {
    return null
  }

  const route_share = (player_routes / team_dropbacks) * 100

  return route_share > ROUTE_SHARE_MAX ? ROUTE_SHARE_MAX : route_share
}

/**
 * Team dropbacks per (team, game), keyed exactly as the gamelog generator keys
 * them so both paths resolve the same team through fixTeam.
 */
const load_team_dropbacks = async ({ esbids }) => {
  const dropbacks_by_game = {}

  for (let i = 0; i < esbids.length; i += 500) {
    const chunk = esbids.slice(i, i + 500)
    const rows = await db('nfl_plays')
      .select('possession_nfl_team as tm', 'esbid')
      .count('* as dropbacks')
      .whereIn('esbid', chunk)
      .where({ is_qb_dropback: true })
      .whereNot({ play_type: 'NOPL' })
      .groupBy('possession_nfl_team', 'esbid')

    for (const row of rows) {
      dropbacks_by_game[`${fixTeam(row.tm)}_${row.esbid}`] = parseInt(
        row.dropbacks,
        10
      )
    }
  }

  return dropbacks_by_game
}

const apply_updates = async ({ updates }) => {
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500)
    const values = chunk
      .map(() => '(?::varchar, ?::integer, ?::smallint, ?::numeric)')
      .join(', ')
    const bindings = chunk.flatMap((update) => [
      update.pid,
      update.esbid,
      update.season_year,
      update.route_share
    ])

    await db.raw(
      `update player_receiving_gamelogs as rg
         set route_share = v.route_share
         from (values ${values}) as v (pid, esbid, season_year, route_share)
        where rg.pid = v.pid
          and rg.esbid = v.esbid
          and rg.season_year = v.season_year`,
      bindings
    )
  }
}

/**
 * Fill route_share for rows that carry routes but no share.
 *
 * The gamelog generator reads routes back out of player_receiving_gamelogs, so
 * a row's share can only be computed by a generation run that happens AFTER the
 * routes land. Routes are written by private/scripts/import-gamelogs-ngs.mjs,
 * which scripts/import-full-season.mjs runs after generate_player_gamelogs --
 * so on that pipeline every freshly imported route arrives too late for its own
 * share, and nothing ever revisits it. This pass is what closes that, and it is
 * idempotent: it only ever fills a null, so a re-run after a clean run writes
 * nothing.
 *
 * A row whose game has no dropback data, or whose dropbacks fall below the
 * player's routes, is left null and counted as skipped rather than written with
 * a value the inputs do not support.
 */
export const recompute_route_share = async ({
  year = null,
  esbids = null,
  dry_run = false
} = {}) => {
  const query = db('player_receiving_gamelogs as rg')
    .select(
      'rg.pid',
      'rg.esbid',
      'rg.season_year',
      'rg.routes',
      'g.nfl_team as nfl_team'
    )
    .join('player_gamelogs as g', function () {
      this.on('g.pid', '=', 'rg.pid')
        .andOn('g.esbid', '=', 'rg.esbid')
        .andOn('g.season_year', '=', 'rg.season_year')
    })
    .whereNotNull('rg.routes')
    .whereNull('rg.route_share')

  if (year) {
    query.where('rg.season_year', year)
  }

  if (esbids && esbids.length) {
    query.whereIn('rg.esbid', esbids)
  }

  const rows = await query

  const result = {
    candidates: rows.length,
    updated: 0,
    skipped_missing_dropbacks: 0,
    skipped_invalid_dropbacks: 0
  }

  if (!rows.length) {
    log('no rows with routes and a null route_share in scope')
    return result
  }

  const unique_esbids = [...new Set(rows.map((row) => row.esbid))]
  const dropbacks_by_game = await load_team_dropbacks({ esbids: unique_esbids })

  const updates = []
  for (const row of rows) {
    const team_dropbacks =
      dropbacks_by_game[`${fixTeam(row.nfl_team)}_${row.esbid}`] || null

    if (!team_dropbacks) {
      result.skipped_missing_dropbacks += 1
      continue
    }

    const route_share = calculate_route_share({
      player_routes: row.routes,
      team_dropbacks
    })

    if (route_share === null) {
      result.skipped_invalid_dropbacks += 1
      continue
    }

    updates.push({
      pid: row.pid,
      esbid: row.esbid,
      season_year: row.season_year,
      route_share
    })
  }

  result.updated = updates.length

  if (dry_run) {
    log(`dry run: would update ${updates.length} rows`)
    return result
  }

  await apply_updates({ updates })

  log(
    `recomputed route_share for ${result.updated} of ${result.candidates} candidate rows`
  )

  return result
}
