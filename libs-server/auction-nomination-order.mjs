import db from '#db'
import { current_season } from '#constants'
import getLeague from './get-league.mjs'
import emit_signal from './emit-signal.mjs'
import debug from 'debug'

const log = debug('auction-nomination-order')

const SIGNAL_SOURCE = 'auction-nomination-order'

export const AUCTION_NOMINATION_ORDER_TIERS = {
  // league_format_player_season_projection_values for the league's format and
  // season. The intended source, and the same column the auction board already
  // sorts on.
  FORMAT_SEASON_VALUE: 'format_season_value',
  // The same value model at weekly grain, aggregated over the season's weeks.
  FORMAT_WEEKLY_VALUE: 'format_weekly_value',
  // Season-long projected points for the league's scoring format, ignoring
  // value-over-replacement.
  SCORING_FORMAT_POINTS: 'scoring_format_points',
  // A degenerate order that still terminates the auction.
  ALPHABETICAL: 'alphabetical'
}

/**
 * The players the auction can still place, unrostered in this league.
 *
 * Any roster row disqualifies, at any week, matching the nomination validator in
 * the socket: a player on somebody's roster is not a free agent whatever week
 * the row is filed under.
 */
const get_rostered_pids = async ({ lid, season_year }) => {
  const rows = await db('rosters_players')
    .distinct('pid')
    .where({ lid, season_year })
  return new Set(rows.map((row) => row.pid))
}

/**
 * The league-wide best-available order, with the fallback chain.
 *
 * ONE ORDER FOR THE WHOLE LEAGUE. There is no per-team nomination queue: in live
 * mode the nomination timer expires and the engine nominates the top of this
 * list for whichever team is on the clock.
 *
 * ITS ONLY CONSUMER IS LIVE-MODE AUTO-NOMINATION. The election-mode nomination
 * suggestion was dropped with the nomination-order component, because the board
 * already renders this ordering -- `get_auction_target_players` sorts descending
 * on the same `projected_points_added_positive` column tier one names.
 *
 * THE CHAIN DEGRADES RATHER THAN FAILING, and that is the whole reason it has
 * four tiers. A nomination timer that expires into nothing is what today's code
 * does, and it advances the auction not at all; an alphabetical order is
 * embarrassing and terminates. The tier in force is returned so the caller can
 * say which one it used -- a manager should never have to guess why the
 * suggested order looks wrong.
 *
 * @returns {Promise<{tier: string, players: Array<{pid: string, primary_position: string}>}>}
 */
export const get_auction_nomination_order = async ({
  lid,
  season_year = current_season.year,
  league: provided_league,
  limit = 50
}) => {
  const league = provided_league || (await getLeague({ lid }))
  const rostered = await get_rostered_pids({ lid, season_year })

  const to_result = (tier, rows) => ({
    tier,
    players: rows
      .filter((row) => !rostered.has(row.pid))
      .slice(0, limit)
      .map((row) => ({
        pid: row.pid,
        primary_position: row.primary_position
      }))
  })

  if (league.league_format_id) {
    const season_values = await db(
      'league_format_player_season_projection_values as v'
    )
      .join('player', 'player.pid', 'v.pid')
      .select('v.pid', 'player.primary_position')
      .where({
        'v.league_format_id': league.league_format_id,
        'v.season_year': season_year
      })
      .whereNotNull('v.projected_points_added_positive')
      .orderBy('v.projected_points_added_positive', 'desc')

    const result = to_result(
      AUCTION_NOMINATION_ORDER_TIERS.FORMAT_SEASON_VALUE,
      season_values
    )
    if (result.players.length) return result

    // Tier two carries only the NET column at weekly grain -- there is no
    // weekly positive variant, because a weekly points-added is one signed
    // number. Summing net over the season's weeks is the same value model at a
    // different grain, which is what this tier is for.
    const weekly_values = await db(
      'league_format_player_projection_values as v'
    )
      .join('player', 'player.pid', 'v.pid')
      .select('v.pid', 'player.primary_position')
      .sum({ total: 'v.projected_points_added_net' })
      .where({
        'v.league_format_id': league.league_format_id,
        'v.season_year': season_year
      })
      .groupBy('v.pid', 'player.primary_position')
      .orderBy('total', 'desc')

    const weekly_result = to_result(
      AUCTION_NOMINATION_ORDER_TIERS.FORMAT_WEEKLY_VALUE,
      weekly_values
    )
    if (weekly_result.players.length) return weekly_result
  }

  if (league.scoring_format_id) {
    const points = await db(
      'scoring_format_player_season_projection_points as p'
    )
      .join('player', 'player.pid', 'p.pid')
      .select('p.pid', 'player.primary_position')
      .where({
        'p.scoring_format_id': league.scoring_format_id,
        'p.season_year': season_year
      })
      .whereNotNull('p.projected_points_total')
      .orderBy('p.projected_points_total', 'desc')

    const points_result = to_result(
      AUCTION_NOMINATION_ORDER_TIERS.SCORING_FORMAT_POINTS,
      points
    )
    if (points_result.players.length) return points_result
  }

  // Reaching here means every projection source for this league-season is
  // empty, which is a data-pipeline failure rather than an auction one -- and it
  // is invisible from the auction's own behavior, since the auction keeps
  // running on a nonsense order. Report it with the league named.
  await emit_signal({
    source: SIGNAL_SOURCE,
    kind: 'pipeline_failure',
    severity: 'high',
    title: `league ${lid} auction nomination order fell through to alphabetical`,
    payload: {
      lid,
      season_year,
      league_format_id: league.league_format_id || null,
      scoring_format_id: league.scoring_format_id || null
    },
    dedup_key: `pipeline_failure:${SIGNAL_SOURCE}:${lid}`
  })
  log(`league ${lid} nomination order degraded to alphabetical`)

  const alphabetical = await db('player')
    .select('pid', 'primary_position')
    .orderBy('last_name', 'asc')
    .orderBy('first_name', 'asc')
    .limit(limit + rostered.size)

  return to_result(AUCTION_NOMINATION_ORDER_TIERS.ALPHABETICAL, alphabetical)
}

export default {
  AUCTION_NOMINATION_ORDER_TIERS,
  get_auction_nomination_order
}
