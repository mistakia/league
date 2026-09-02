import debug from 'debug'

import { fixTeam } from '#libs-shared'
import { team_grain_market_types } from '#libs-shared/bookmaker-constants.mjs'

const log = debug('caesars:team-attribution')

// WHY THIS EXISTS.
//
// Caesars publishes a TEAM-grain statistic as one market per team in the same
// game, from one template, and the selections are a bare over/under. The only
// thing that says whose line it is, is a team prefix on the market name:
//
//   MIN Total Team Passing Yards   over 207.5 / under 207.5
//   NYG Total Team Passing Yards   over 194.5 / under 194.5
//
// Leave selection_pid null on those and the two markets become one key for
// anything joining on (esbid, market_type, selection_name) -- the data-view
// betting columns and the hit-rate calculation both do. Two different lines
// land in one cell and the observed_at dedup picks arbitrarily. Nothing errors,
// because these types settle as UNSUPPORTED, so the failure surfaces as a
// plausible wrong number.
//
// Team-in-the-pid is the established shape here: the importer already sets
// selection_pid to a team abbreviation for GAME_SPREAD and GAME_MONEYLINE, and
// DST pids are the bare team abbreviation.
//
// WHY THE GAME'S OWN TEAMS ARE REQUIRED rather than optional. Reading a prefix
// and trusting whatever fixTeam returns is a parse that cannot report failure:
// a market name whose shape drifts would yield a confident wrong team. Matching
// against the two teams the game actually holds makes a drifted name return
// null instead, which the caller can count.
//
// Caesars writes the prefix in two forms across eras -- the 2-3 letter
// abbreviation ('SEA Total Points') and the full name ('Seattle Seahawks Total
// Points') -- so the prefix is a variable number of words. Every partial city
// prefix fixTeam might see on the way ('LOS', 'LOS ANGELES', 'NEW YORK',
// 'KANSAS CITY') throws rather than resolving, so no shorter prefix can
// shadow a longer one; the longest-first walk is for determinism, not safety.
const MAX_TEAM_NAME_WORDS = 3

/**
 * Whether a market type is TEAM grain -- one team per market, so the team must
 * be carried in selection_pid.
 *
 * @param {string} market_type
 * @returns {boolean}
 */
export const is_team_grain_market_type = (market_type) =>
  team_grain_market_types.has(market_type)

/**
 * Resolve the team a Caesars TEAM-grain market belongs to, from the team prefix
 * on its market name, constrained to the two teams the game holds.
 *
 * @param {object} params
 * @param {string} params.market_name - the Caesars market name, e.g. 'MIN Total Team Passing Yards'
 * @param {string[]} params.game_nfl_teams - the game's two teams, canonical abbreviations
 * @returns {string|null} the canonical team abbreviation, or null if no prefix resolved to one of them
 */
export const get_caesars_market_team = ({ market_name, game_nfl_teams }) => {
  if (!market_name || !game_nfl_teams?.length) {
    return null
  }

  const words = market_name.trim().split(/\s+/)

  for (
    let word_count = Math.min(MAX_TEAM_NAME_WORDS, words.length);
    word_count > 0;
    word_count--
  ) {
    let nfl_team
    try {
      nfl_team = fixTeam(words.slice(0, word_count).join(' '))
    } catch (err) {
      continue
    }

    if (game_nfl_teams.includes(nfl_team)) {
      return nfl_team
    }
  }

  log(`no team prefix in "${market_name}" matched ${game_nfl_teams.join('/')}`)
  return null
}
