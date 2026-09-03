import debug from 'debug'

import {
  player_prop_types,
  player_season_prop_types,
  team_game_market_types,
  game_props_types,
  awards_prop_types,
  futures_types,
  team_season_types,
  division_specials_types
} from '#libs-shared/bookmaker-constants.mjs'

const log = debug('betmgm:market-types')

/**
 * BetMGM season player-prop templates.
 *
 * These six are the only game-path (`.results`) markets carrying `player1`, and
 * they are keyed by templateId because the display name embeds the player and so
 * is not a stable key. Verified against a live 2026-09-02 payload: 207 markets
 * across exactly these six ids, and zero player-carrying markets outside them.
 */
export const BETMGM_SEASON_PLAYER_PROP_TEMPLATE_IDS = {
  37615: player_season_prop_types.SEASON_PASSING_YARDS,
  37620: player_season_prop_types.SEASON_PASSING_TOUCHDOWNS,
  37623: player_season_prop_types.SEASON_RUSHING_YARDS,
  37628: player_season_prop_types.SEASON_RECEIVING_YARDS,
  37686: player_season_prop_types.SEASON_RUSHING_TOUCHDOWNS,
  37687: player_season_prop_types.SEASON_RECEIVING_TOUCHDOWNS
}

/**
 * Season leader templates.
 *
 * Kept separate from the season player props above because these are the
 * markets whose result-level `playerId` genuinely names a player -- the ones a
 * category gate alone would drop. Keyed by templateId rather than name: BetMGM
 * spells the same family both 'Regular Season Receiving Yards Leader' and
 * 'Regular season receiving TDs leader', so the name is not a stable key.
 */
export const BETMGM_SEASON_LEADER_TEMPLATE_IDS = {
  41301: player_prop_types.SEASON_LEADER_PASSING_YARDS,
  41302: player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS,
  41304: player_prop_types.SEASON_LEADER_RUSHING_YARDS,
  41303: player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS,
  41305: player_prop_types.SEASON_LEADER_RECEIVING_YARDS,
  41299: player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS,
  39001: player_prop_types.SEASON_LEADER_SACKS
}

/**
 * Vendor `MarketType` values that have no canonical equivalent.
 *
 * Named for what it HOLDS -- BetMGM's own vocabulary -- rather than as a
 * `*_MARKET_TYPES` constant, because every constant by that name in this tree
 * holds OUR canonical values. An implementer populating this with canonical
 * values would make the coverage census match nothing and go vacuously green.
 */
export const BETMGM_UNTYPED_SOURCE_MARKET_TYPES = new Set([
  // Total points bucketed into ranges ("0-20", "21-30"). No canonical band type.
  'HappeningBand',
  // "Highest scoring quarter" -- a which-period market with no canonical home.
  'MultiplePeriodsWithMostHappenings2Way',
  // Moneyline AND both-teams-to-score combined into one selection. A parlay
  // shape; typing it as either leg would misrepresent both.
  '2wayAndBTTSXOrMore'
])

// Leading "<Team>: " / "<Conference or Division>: " qualifier. The families below
// are keyed on the part AFTER it, because BetMGM emits one market per team.
const QUALIFIER_RE = /^(.+?):\s+(.+)$/

const strip_qualifier = (market_name) => {
  if (!market_name) return { qualifier: null, remainder: '' }

  const matches = QUALIFIER_RE.exec(market_name)
  if (!matches) return { qualifier: null, remainder: market_name }

  return { qualifier: matches[1].trim(), remainder: matches[2].trim() }
}

/**
 * Option-market (`.optionMarkets`) types, keyed on the qualifier-stripped name.
 *
 * `MarketType` plus `Period` is NOT a sufficient key: `2way` covers the
 * full-game, first-half and first-quarter moneylines alike, so the tuple only
 * separates them by accident of which periods happen to be published. The name
 * is the discriminator, and it is checked against `MarketType` below.
 */
const OPTION_MARKET_TYPES = {
  // Full-game lines. These three are the only option markets wired to a
  // settlement handler, so a mis-key here grades real money.
  Moneyline: team_game_market_types.GAME_MONEYLINE,
  Spread: team_game_market_types.GAME_SPREAD,
  Totals: team_game_market_types.GAME_TOTAL,

  // Period-scoped game lines. Canonical constants exist for these and are
  // absent from `market-type-mappings.mjs`, so they resolve to UNSUPPORTED and
  // settle against nothing -- which is the point. Typing them as GAME_MONEYLINE
  // or GAME_TOTAL would grade a half or a quarter against the full-game result.
  '1st half moneyline': team_game_market_types.GAME_FIRST_HALF_MONEYLINE,
  '1st half spread': team_game_market_types.GAME_FIRST_HALF_SPREAD,
  '1st half totals': team_game_market_types.GAME_FIRST_HALF_TOTAL,
  '1st quarter moneyline': team_game_market_types.GAME_FIRST_QUARTER_MONEYLINE,
  '1st quarter spread': team_game_market_types.GAME_FIRST_QUARTER_SPREAD,
  '1st quarter totals': team_game_market_types.GAME_FIRST_QUARTER_TOTAL,

  // Game props. None are settlement-wired; they exist for analytics coverage.
  'Winning margin (including OT)': game_props_types.GAME_WINNING_MARGIN,
  'Winning margin: 4-way (including OT)': game_props_types.GAME_WINNING_MARGIN,
  'Halftime/fulltime (excluding OT)': game_props_types.GAME_HALF_TIME_FULL_TIME,
  'Total points: Odd or even': game_props_types.GAME_TOTAL_POINTS_ODD_EVEN,
  'Game to go into overtime': game_props_types.GAME_OVERTIME
}

// Team-scoped option markets, keyed on the remainder after the team qualifier.
const TEAM_OPTION_MARKET_TYPES = {
  'Total points': team_game_market_types.GAME_TEAM_TOTAL,
  'Total TDs O/U': team_game_market_types.GAME_TEAM_TOUCHDOWNS
}

// Prefix-matched option families. BetMGM varies the threshold inside the name
// ("Race to 7 Points", "Both teams to score 21+ points"), so the numeric part is
// market content rather than a key.
const OPTION_MARKET_PREFIXES = [
  ['Race to ', game_props_types.GAME_RACE_TO_POINTS],
  ['Both teams to score ', game_props_types.GAME_BOTH_TEAMS_TO_SCORE]
]

/**
 * Game-path (`.results`) futures, awards and team-season families, keyed on the
 * qualifier-stripped name.
 */
const GAME_PATH_MARKET_TYPES = {
  'Regular season wins': team_season_types.TEAM_REGULAR_SEASON_WINS,
  'Stage of elimination': futures_types.STAGE_OF_ELIMINATION,
  'Exact outcome': futures_types.EXACT_RESULT,
  'Name the finalists': futures_types.NAME_THE_FINALISTS,
  'Winning conference': futures_types.WINNING_CONFERENCE,
  'Winning division': futures_types.WINNING_DIVISION,
  'Winning state': futures_types.WINNING_STATE,
  'New champion': futures_types.FIRST_TIME_WINNER,
  'Straight forecast': division_specials_types.DIVISION_STRAIGHT_FORECAST,
  'Dual forecast': division_specials_types.DIVISION_DUAL_FORECAST,
  '2nd Place': division_specials_types.DIVISION_FINISHING_POSITION,
  '3rd Place': division_specials_types.DIVISION_FINISHING_POSITION,
  '4th Place': division_specials_types.DIVISION_FINISHING_POSITION
}

// Whole-name matches on the game path -- no team or division qualifier.
const GAME_PATH_EXACT_MARKET_TYPES = {
  'Super Bowl winner': futures_types.SUPER_BOWL_WINNER,
  'AP MVP winner': awards_prop_types.SEASON_MVP,
  'AP Coach of the Year': awards_prop_types.COACH_OF_THE_YEAR,
  'AP Offensive Player of the Year':
    awards_prop_types.OFFENSIVE_PLAYER_OF_THE_YEAR,
  'AP Defensive Player of the Year':
    awards_prop_types.DEFENSIVE_PLAYER_OF_THE_YEAR,
  'AP Offensive Rookie of the Year':
    awards_prop_types.OFFENSIVE_ROOKIE_OF_THE_YEAR,
  'AP Defensive Rookie of the Year':
    awards_prop_types.DEFENSIVE_ROOKIE_OF_THE_YEAR,
  'AP Comeback Player of the Year':
    awards_prop_types.COMEBACK_PLAYER_OF_THE_YEAR,
  'AP Protector of the Year': awards_prop_types.PROTECTOR_OF_THE_YEAR,
  'To go 17-0 in the regular season': team_season_types.TEAM_PERFECT_SEASON
}

// Suffix-matched game-path families. "<Conference> Conference winner",
// "<Division> Division winner" and "<Team> to make the playoffs" all put the
// varying part FIRST, so a qualifier strip cannot reach them.
const GAME_PATH_SUFFIXES = [
  [' Conference winner', futures_types.CONFERENCE_WINNER],
  [' Division winner', futures_types.DIVISION_WINNER],
  [' No. 1 seed', futures_types.NUMBER_1_SEED],
  [' to make the playoffs', team_season_types.TEAM_TO_MAKE_PLAYOFFS],
  [' - 2nd Place', division_specials_types.DIVISION_FINISHING_POSITION],
  [' - 3rd Place', division_specials_types.DIVISION_FINISHING_POSITION],
  [' - 4th Place', division_specials_types.DIVISION_FINISHING_POSITION]
]

// Parlay containers. BetMGM publishes these as ordinary markets whose selections
// are multi-leg combinations; no canonical type represents them and typing them
// as any single leg would be wrong.
const GAME_PATH_UNTYPED_NAMES = new Set([
  'NFL to make the playoffs parlay',
  'Division winners parlay',
  'Parlays'
])

/**
 * Game-path markets reviewed against the canonical vocabulary and found to have
 * no equivalent -- league-wide season records, the draft order, and one-off
 * novelties. Listed rather than left to fall through so that the unknown bucket
 * stays a genuine change detector: anything NOT here is a descriptor nobody has
 * looked at yet.
 */
const GAME_PATH_KNOWN_UNTYPED_TEMPLATE_IDS = new Set([
  31444, // 1st overall pick
  35193, // To go 17-0 in the regular season (superseded by the exact map)
  37666, // Regular season: Longest TD from scrimmage
  37672, // Regular season: Highest total passing yards
  37675, // Regular season: Longest rush
  37683, // Regular season: Highest total rushing yards
  37685, // Regular season: Longest made field goal
  41223, // Any regular season game to end in a tie
  41927 // To win 1+ playoff games
])

/**
 * Option markets reviewed and found to have no canonical equivalent, keyed on
 * the qualifier-stripped name. Period-scoped variants of families whose only
 * canonical constant is full-game live here: typing a first-half winning margin
 * as GAME_WINNING_MARGIN would misstate its grain.
 */
const OPTION_KNOWN_UNTYPED_NAMES = new Set([
  'Total TDs O/U',
  '1st half TDs',
  '1st half winning margin',
  '1st quarter winning margin',
  '1st half points',
  '1st quarter points'
])

/**
 * Resolve a canonical `market_type`, reporting whether the descriptor is one we
 * have seen before.
 *
 * `source_market_type` names BetMGM's own `MarketType` parameter, kept distinct
 * from our `market_type` column and reading correctly beside `source_market_name`.
 * Its presence is what selects the option path; the game path passes a
 * `template_id` instead.
 *
 * `is_known` is false ONLY for a descriptor that is neither mapped nor on a
 * reviewed known-untyped list. That is the change detector: a market we
 * deliberately leave untyped and a market BetMGM has just renamed both produce a
 * null `market_type`, and only the second should draw attention.
 */
export const resolve_market_type = ({
  template_id = null,
  source_market_type = null,
  market_name = null
} = {}) => {
  const { qualifier, remainder } = strip_qualifier(market_name)

  if (source_market_type) {
    if (BETMGM_UNTYPED_SOURCE_MARKET_TYPES.has(source_market_type)) {
      return { market_type: null, is_known: true }
    }

    // Team-scoped markets carry a team qualifier; the same remainder without one
    // is the game-grain market and must not collide with it.
    if (qualifier && TEAM_OPTION_MARKET_TYPES[remainder]) {
      return {
        market_type: TEAM_OPTION_MARKET_TYPES[remainder],
        is_known: true
      }
    }

    if (OPTION_MARKET_TYPES[market_name]) {
      return { market_type: OPTION_MARKET_TYPES[market_name], is_known: true }
    }

    for (const [prefix, market_type] of OPTION_MARKET_PREFIXES) {
      if (market_name && market_name.startsWith(prefix)) {
        return { market_type, is_known: true }
      }
    }

    if (OPTION_KNOWN_UNTYPED_NAMES.has(remainder)) {
      return { market_type: null, is_known: true }
    }

    log(
      `unknown option market: MarketType=${source_market_type} name=${market_name}`
    )
    return { market_type: null, is_known: false }
  }

  if (template_id && BETMGM_SEASON_PLAYER_PROP_TEMPLATE_IDS[template_id]) {
    return {
      market_type: BETMGM_SEASON_PLAYER_PROP_TEMPLATE_IDS[template_id],
      is_known: true
    }
  }

  if (template_id && BETMGM_SEASON_LEADER_TEMPLATE_IDS[template_id]) {
    return {
      market_type: BETMGM_SEASON_LEADER_TEMPLATE_IDS[template_id],
      is_known: true
    }
  }

  if (GAME_PATH_EXACT_MARKET_TYPES[market_name]) {
    return {
      market_type: GAME_PATH_EXACT_MARKET_TYPES[market_name],
      is_known: true
    }
  }

  if (qualifier && GAME_PATH_MARKET_TYPES[remainder]) {
    return { market_type: GAME_PATH_MARKET_TYPES[remainder], is_known: true }
  }

  for (const [suffix, market_type] of GAME_PATH_SUFFIXES) {
    if (market_name && market_name.endsWith(suffix)) {
      return { market_type, is_known: true }
    }
  }

  // Parlay containers appear under several spellings ('... - Parlays',
  // '<Family>: Parlays', '... parlay'), all of them multi-leg.
  if (
    GAME_PATH_UNTYPED_NAMES.has(market_name) ||
    GAME_PATH_UNTYPED_NAMES.has(remainder) ||
    /parlays?$/i.test(market_name || '') ||
    GAME_PATH_KNOWN_UNTYPED_TEMPLATE_IDS.has(Number(template_id))
  ) {
    return { market_type: null, is_known: true }
  }

  log(`unknown game market: templateId=${template_id} name=${market_name}`)
  return { market_type: null, is_known: false }
}

/**
 * Canonical `market_type` alone, for callers that do not need the
 * known-descriptor signal.
 */
export const get_market_type = (params) =>
  resolve_market_type(params).market_type
