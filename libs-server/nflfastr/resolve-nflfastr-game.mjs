import debug from 'debug'

import db from '#db'
import { fixTeam } from '#libs-shared'

const log = debug('resolve-nflfastr-game')

/**
 * fixTeam throws on abbreviations it does not know, and nfl_games carries some
 * it does not -- the historical relocation codes (PHO/RAI now resolve through
 * fix-team.mjs, but other legacy spellings can still be live in the table). A
 * resolver that throws on a legacy row would take down the whole import for a
 * franchise that relocated decades ago, so normalization degrades to the raw
 * uppercase abbreviation instead.
 */
export const safe_fix_team = (team) => {
  if (!team) return null
  try {
    return fixTeam(team)
  } catch (error) {
    log(`fixTeam rejected ${team}, using raw abbreviation`)
    return String(team).toUpperCase()
  }
}

/**
 * Matchup identity for a game, deliberately excluding week.
 *
 * (season_year, season_type, home, away) is unique across every 1999+ REG/POST
 * game in nfl_games -- verified, zero duplicate groups. Week is excluded because
 * nflfastR numbers postseason weeks continuously (18, 19, 20, 21) while
 * nfl_games numbers them within the postseason (1, 2, 3, 4); keying on week
 * makes every postseason game in the corpus look like a mismatch.
 */
export const build_matchup_key = ({
  season_year,
  season_type,
  home_team,
  away_team
}) =>
  [
    Number(season_year),
    season_type === 'REG' ? 'REG' : 'POST',
    safe_fix_team(home_team),
    safe_fix_team(away_team)
  ].join('|')

const feed_matchup_key = (item) =>
  build_matchup_key({
    season_year: item.season,
    season_type: item.season_type,
    home_team: item.home_team,
    away_team: item.away_team
  })

const game_matchup_key = (game) =>
  build_matchup_key({
    season_year: game.season_year,
    season_type: game.season_type,
    home_team: game.home_nfl_team,
    away_team: game.away_nfl_team
  })

/**
 * Resolve nflfastR play rows to our esbid.
 *
 * The naive resolution -- trust nflfastR's `old_game_id` as our `esbid` -- is
 * wrong in two distinct ways, and the second is worse than the first:
 *
 *   1. The id resolves to nothing, and the game silently takes no enrichment.
 *   2. The id resolves to a real esbid that is a DIFFERENT game, and that
 *      game's plays take another game's epa, is_qb_dropback and play_description_nflfastr.
 *
 * Both fired on 2021 REG week 15, the COVID-rescheduling week, where nine games
 * carry an old_game_id that disagrees with our esbid and six of those nine
 * collide with a real esbid elsewhere in the same week. Shape (2) is not
 * detectable from a match rate at all, because the plays do match -- they match
 * the wrong game.
 *
 * So the matchup is authoritative and old_game_id is only a fast path that has
 * to agree with it. When they disagree the matchup wins and the disagreement is
 * logged. When the matchup cannot pick exactly one game the resolver refuses
 * rather than guessing.
 */
export const build_nflfastr_game_resolver = async ({ year }) => {
  const games = await db('nfl_games')
    .where({ season_year: year })
    .whereIn('season_type', ['REG', 'POST'])
    .select(
      'esbid',
      'season_year',
      'week',
      'season_type',
      'home_nfl_team',
      'away_nfl_team'
    )

  const by_esbid = new Map()
  const by_matchup = new Map()

  for (const game of games) {
    by_esbid.set(String(game.esbid), game)
    const key = game_matchup_key(game)
    if (!by_matchup.has(key)) by_matchup.set(key, [])
    by_matchup.get(key).push(game)
  }

  const stats = {
    direct: 0,
    matchup_corrected: 0,
    direct_within_ambiguous: 0,
    refused_ambiguous: 0,
    refused_no_matchup: 0
  }
  const corrections = []
  const refusals = []

  // resolve() is called once per PLAY, and every play of a game resolves
  // identically. Memoizing on game_id is what keeps stats, corrections and
  // refusals counted per GAME -- without it a single corrected game reports
  // ~180 corrections, and games_refused (which feeds the import's per-game
  // oracle) would over-report by three orders of magnitude.
  const resolved_by_game = new Map()

  /**
   * @returns {{ esbid: number|null, method: string, feed_game_id: string }}
   */
  const resolve_game = (item) => {
    const feed_game_id = item.game_id
    const feed_old_game_id = item.old_game_id ? Number(item.old_game_id) : null
    const direct = feed_old_game_id
      ? by_esbid.get(String(feed_old_game_id))
      : null
    const key = feed_matchup_key(item)
    const candidates = by_matchup.get(key) || []

    if (candidates.length === 1) {
      const game = candidates[0]
      if (direct && direct.esbid === game.esbid) {
        stats.direct += 1
        return { esbid: game.esbid, method: 'direct', feed_game_id }
      }

      stats.matchup_corrected += 1
      corrections.push({
        feed_game_id,
        feed_old_game_id,
        resolved_esbid: game.esbid,
        collided_with_esbid: direct ? direct.esbid : null
      })
      return { esbid: game.esbid, method: 'matchup_corrected', feed_game_id }
    }

    // More than one game shares the matchup. This does not happen anywhere in
    // the current corpus, but if it ever does, old_game_id is a legitimate
    // tiebreak so long as it names one of the candidates.
    if (candidates.length > 1) {
      if (direct && candidates.some((game) => game.esbid === direct.esbid)) {
        stats.direct_within_ambiguous += 1
        return {
          esbid: direct.esbid,
          method: 'direct_within_ambiguous',
          feed_game_id
        }
      }

      stats.refused_ambiguous += 1
      refusals.push({
        feed_game_id,
        feed_old_game_id,
        reason: `matchup ${key} matched ${candidates.length} games and old_game_id names none of them`
      })
      return { esbid: null, method: 'refused_ambiguous', feed_game_id }
    }

    // No game in nfl_games has this matchup. A direct hit here is necessarily a
    // different game -- trusting it is exactly the cross-match that corrupts.
    stats.refused_no_matchup += 1
    refusals.push({
      feed_game_id,
      feed_old_game_id,
      reason: direct
        ? `matchup ${key} is absent from nfl_games and old_game_id names a different game (esbid ${direct.esbid})`
        : `matchup ${key} is absent from nfl_games`
    })
    return { esbid: null, method: 'refused_no_matchup', feed_game_id }
  }

  const resolve = (item) => {
    const cached = resolved_by_game.get(item.game_id)
    if (cached) return cached

    const resolution = resolve_game(item)
    resolved_by_game.set(item.game_id, resolution)
    return resolution
  }

  return {
    resolve,
    stats,
    corrections,
    refusals,
    game_count: games.length
  }
}
