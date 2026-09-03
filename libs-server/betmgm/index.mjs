/**
 * BetMGM odds import utilities.
 *
 * Market-type resolution and per-selection derivation for the BetMGM prop
 * market importer, in the same two-module shape DraftKings and FanDuel use. The
 * importer itself stays in `private/`, because the vendor transport does; every
 * pure function it needs lives here.
 */

export {
  BETMGM_SEASON_PLAYER_PROP_TEMPLATE_IDS,
  BETMGM_SEASON_LEADER_TEMPLATE_IDS,
  BETMGM_UNTYPED_SOURCE_MARKET_TYPES,
  BETMGM_SEASON_LEADER_FALLBACK_POSITIONS,
  PLAYER_AWARD_MARKET_TYPES,
  MARKET_TYPES_WITHOUT_TEAM_SELECTIONS,
  get_market_type,
  resolve_market_type
} from './betmgm-market-types.mjs'

export {
  get_market_parameter,
  parse_decimal_parameter,
  strip_trailing_line,
  format_selection_type,
  is_placeholder_option,
  get_option_team,
  get_team_from_selection_name,
  get_option_selection_line
} from './betmgm-formatters.mjs'
