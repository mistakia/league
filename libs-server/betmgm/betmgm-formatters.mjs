import debug from 'debug'

import { fixTeam } from '#libs-shared'

const log = debug('betmgm:formatters')

/**
 * Read one of BetMGM's market-level `parameters` entries.
 *
 * The array carries a mix of `MarketType`, `Period`, `Happening` and the line
 * carriers, keyed by `key` rather than positionally.
 */
export const get_market_parameter = (betmgm_market, key) =>
  betmgm_market?.parameters?.find((param) => param.key === key)?.value ?? null

/**
 * Parse a BetMGM decimal parameter.
 *
 * The payload mixes precisions for the same value -- both `-2.5` and `-2.5000`
 * appear -- so this must go through a float parse. An equality comparison
 * against a number, or a string compare between the two spellings, breaks.
 */
export const parse_decimal_parameter = (raw_value) => {
  if (raw_value === null || raw_value === undefined || raw_value === '') {
    return null
  }

  const parsed = Number.parseFloat(raw_value)
  return Number.isFinite(parsed) ? parsed : null
}

// A trailing signed line on a team selection: 'Los Angeles Rams -3.5',
// 'Kansas City Chiefs (-3)', 'San Francisco 49ers +3.5'. Anchored to the END so
// the '49' inside 'San Francisco 49ers' is never mistaken for a line -- the
// exact failure the pre-change importer shipped, which fabricated a line of 49
// on every 49ers moneyline selection.
const TRAILING_LINE_RE = /\s*\(?\s*[+-]\d+(?:\.\d+)?\s*\)?\s*$/

/**
 * Strip a trailing signed line from a team selection name.
 *
 * Serves `selection_pid` and `selection_name` only. The LINE itself always comes
 * from the market parameters, never from a display name -- so this may fail soft:
 * an unmatched name passes through unchanged and `safe_fix_team` returns null
 * rather than throwing.
 */
export const strip_trailing_line = (selection_name) => {
  if (!selection_name) return selection_name
  return selection_name.replace(TRAILING_LINE_RE, '').trim()
}

/**
 * Over/under direction for a selection, or null for a team selection.
 *
 * Copied rather than imported, as DraftKings and FanDuel each do: the five
 * implementations in this tree carry three incompatible signatures, and the
 * pinnacle copy drags in `#db`, `cache` and `proxy-manager`, which this module
 * must not depend on.
 */
export const format_selection_type = (selection_name) => {
  if (!selection_name) return null

  const normalized = String(selection_name).toLowerCase()
  if (normalized.startsWith('over') || normalized.includes(' over ')) {
    return 'OVER'
  }
  if (normalized.startsWith('under') || normalized.includes(' under ')) {
    return 'UNDER'
  }

  return null
}

/**
 * An option BetMGM publishes with no price.
 *
 * These carry `odds: 1` and no `americanOdds` at all -- a listed runner with no
 * market made. They must be skipped rather than emitted: `validate_selection`
 * downstream rejects both sides for want of a price, so writing them inflates
 * `selection_count` against an empty selection array.
 */
export const is_placeholder_option = (option) =>
  option?.price?.odds === 1 &&
  (option.price.americanOdds === null ||
    option.price.americanOdds === undefined)

/**
 * Resolve the team abbreviation a team-shaped option refers to.
 *
 * Reads the option NAME rather than `parameters.fixtureParticipant`, which is an
 * opaque numeric id whose team mapping lives on the fixture rather than on the
 * option. The name carries the full team name, and resolving it against
 * `nfl_game` gives a non-positional home/away discriminator.
 */
export const get_option_team = (option) =>
  get_team_from_selection_name(option?.name?.value)

/**
 * Resolve a team abbreviation from a selection display name.
 *
 * Deliberately NOT `safe_fix_team` from the DraftKings helpers, though that is
 * the book-neutral-looking wrapper for this job. Its validator rejects anything
 * matching `/^[A-Z][a-z]+\s+[A-Z][a-z]+$/` -- a guard against resolving PLAYER
 * names as teams, which is right for DraftKings, whose team selections read
 * 'DEN Broncos'. BetMGM spells them 'Denver Broncos', so that guard rejects
 * every single-word-city team: measured 2026-09-02, 19 of 32 teams including
 * Washington, Philadelphia, Chicago and Cincinnati, while multi-word cities like
 * Tampa Bay and Kansas City passed. It cost `selection_pid` on 21 of 32
 * moneyline selections and the line on 15 of 16 spread markets, silently.
 *
 * `fixTeam` alone is the precise instrument here: verified against this payload's
 * vocabulary, it THROWS on every player name and every US state ('Super Bowl:
 * Winning state' lists those) while resolving every real team spelling BetMGM
 * uses, including the bare nickname 'Bills' and 'San Francisco 49ers'. The
 * try/catch keeps that throw from escaping, and the empty-input guard keeps
 * `fixTeam(null)` -- which returns 'INA', a silently wrong abbreviation -- off
 * this path entirely.
 */
export const get_team_from_selection_name = (selection_name) => {
  const stripped = strip_trailing_line(selection_name)
  if (!stripped || typeof stripped !== 'string') return null

  try {
    return fixTeam(stripped)
  } catch (err) {
    return null
  }
}

/**
 * Per-selection line for an option market.
 *
 * Two line carriers, and they behave differently:
 *
 *  - `DecimalValue` (totals) is ONE line shared by the over and the under.
 *  - `DecimalHandicap` (spreads) is the HOME side's line. The away side takes
 *    its negation. Verified across every handicap market in the 2026-08-23 and
 *    2026-09-02 payloads: all pairs sum to zero, and the parameter is positive
 *    exactly on the away-favorite games -- so neither array order nor a
 *    favorite-side assumption reproduces it.
 *
 * Home/away is decided by matching the option's team against `nfl_game`, never
 * by array index. Index order held in every sample so far, but the samples carry
 * no alternate spreads, live markets, three-way handicaps or neutral-site games.
 * Returns null when the side cannot be identified, so a wrong-side line -- the
 * one unrecoverable error in this importer, since it settles confidently and
 * incorrectly -- is never fabricated.
 */
export const get_option_selection_line = ({
  betmgm_market,
  option,
  nfl_game
}) => {
  const decimal_value = parse_decimal_parameter(
    get_market_parameter(betmgm_market, 'DecimalValue')
  )
  if (decimal_value !== null) return decimal_value

  const decimal_handicap = parse_decimal_parameter(
    get_market_parameter(betmgm_market, 'DecimalHandicap')
  )
  if (decimal_handicap === null) return null

  if (!nfl_game) {
    log(
      `handicap market ${betmgm_market.id} has no nfl_game; cannot assign a side`
    )
    return null
  }

  const team = get_option_team(option)
  if (!team) {
    log(
      `handicap market ${betmgm_market.id} option '${option?.name?.value}' resolved no team`
    )
    return null
  }

  if (team === nfl_game.home_nfl_team) return decimal_handicap
  if (team === nfl_game.away_nfl_team) return -decimal_handicap

  log(
    `handicap market ${betmgm_market.id} option team ${team} matches neither side of ${nfl_game.esbid}`
  )
  return null
}
