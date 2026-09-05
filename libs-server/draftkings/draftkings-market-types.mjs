import debug from 'debug'

import {
  player_prop_types,
  team_game_market_types,
  awards_prop_types,
  futures_types,
  team_season_types,
  game_props_types,
  division_specials_types
} from '#libs-shared/bookmaker-constants.mjs'

import { ALTERNATE_MARKET_TYPE_IDS } from './draftkings-constants.mjs'

const log = debug('draft-kings:market-types')

// What fell through the mapper on this run, at the two granularities that are
// different actions to take.
//
// An unmapped SUBCATEGORY under an offer category we model means the category
// handler exists and does not recognise the product -- add a case, or rule the
// product out of scope by adding its id to known_unmapped_subcategory_ids. That
// is how SEASON_RECEPTIONS (18435) sat unclassified while DraftKings published
// 43 markets for it.
//
// An unmapped CATEGORY means an entire product family reaches no handler at all
// and every market under it returns null. Categories 526 (Halves) and 527
// (Quarters) stayed dark this way across 89,950 markets, because the collector
// used to be wired only to one handler's default arm and an unmodelled category
// never reaches a handler. DraftKings publishes a handful of new categories a
// year, so this arm needs no allowlist.
//
// The importer drains both and emits them as separate signals. `debug` output
// is not read in production and never was.
export const unmapped_subcategories_by_offer_category = new Map()
export const unmapped_offer_categories = new Set()

const unmapped_subcategory = (offerCategoryId, subcategoryId) => {
  log(
    `unknown offerCategoryId ${offerCategoryId} subcategoryId ${subcategoryId}`
  )

  if (!unmapped_subcategories_by_offer_category.has(offerCategoryId)) {
    unmapped_subcategories_by_offer_category.set(offerCategoryId, new Set())
  }
  unmapped_subcategories_by_offer_category
    .get(offerCategoryId)
    .add(subcategoryId)

  return null
}

export const get_market_type_offer_634 = (subcategoryId) => {
  switch (subcategoryId) {
    case 7512:
      return player_prop_types.SEASON_LEADER_PASSING_YARDS

    case 7524:
      return player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS

    case 7562:
      return player_prop_types.SEASON_LEADER_RUSHING_YARDS

    case 7608:
      return player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS

    case 7725:
      return player_prop_types.SEASON_LEADER_RECEIVING_YARDS

    case 8130:
      return player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS

    case 8161:
      return player_prop_types.SEASON_LEADER_SACKS

    case 13400:
      return player_prop_types.SEASON_LEADER_INTERCEPTIONS

    default:
      return unmapped_subcategory(634, subcategoryId)
  }
}

export const get_market_type_offer_1000 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9516:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 9517:
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 9522:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 9524:
      return player_prop_types.GAME_PASSING_YARDS

    case 9525:
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 9526:
      return player_prop_types.GAME_PASSING_LONGEST_COMPLETION

    case 9532:
      return player_prop_types.GAME_PASSING_RUSHING_YARDS

    case 11969:
      return player_prop_types.GAME_LEADER_PASSING_YARDS

    case 12093:
    case 14119:
    case 16569:
      return player_prop_types.GAME_ALT_PASSING_YARDS

    case 15937:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 16568:
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 16573:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS

    case 16819:
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 16888:
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 16889:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 16896:
      return player_prop_types.GAME_PASSING_RUSHING_YARDS

    case 18487:
    case 18490:
      return player_prop_types.GAME_PASSING_YARDS

    case 18493:
      return player_prop_types.GAME_FIRST_HALF_ALT_PASSING_YARDS

    case 18496:
    case 18500:
      return player_prop_types.GAME_LEADER_PASSING_YARDS

    case 18522:
      return player_prop_types.GAME_FIRST_QUARTER_PASSING_ATTEMPTS

    case 18523:
      return player_prop_types.GAME_PASSING_COMPLETIONS

    case 18526:
      return player_prop_types.GAME_FIRST_QUARTER_PASSING_INTERCEPTIONS

    // Total 1Q Pass Completions. Arrives here rather than under the Quarters
    // offer category, despite being a quarter-scoped product.
    case 19111:
      return player_prop_types.GAME_FIRST_QUARTER_PASSING_COMPLETIONS

    default:
      return unmapped_subcategory(1000, subcategoryId)
  }
}

export const get_market_type_offer_1001 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9512:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 9513:
      return player_prop_types.GAME_RECEIVING_TOUCHDOWNS

    case 9514:
      return player_prop_types.GAME_RUSHING_YARDS

    case 9518:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    case 9519:
      return player_prop_types.GAME_RECEPTIONS

    case 9520:
      return player_prop_types.GAME_RUSHING_TOUCHDOWNS

    case 9523:
      return player_prop_types.GAME_RUSHING_RECEIVING_YARDS

    case 9527:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 9533:
      return player_prop_types.GAME_LONGEST_RUSH

    case 12094:
    case 14118:
    case 16571:
      return player_prop_types.GAME_ALT_RUSHING_YARDS

    case 12095:
      return player_prop_types.GAME_ALT_RECEIVING_YARDS

    case 12096:
    case 16572:
      return player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS

    case 14126:
      return player_prop_types.GAME_LEADER_RUSHING_YARDS

    case 14880:
      return player_prop_types.GAME_LONGEST_RUSH

    // Rush Yards - 1Q O/U (15008) and Rush + Rec Yards - 1Q (18525), both found
    // by the 2026-09-04 sweep for unmapped subcategories whose type already
    // existed. 702 and 974 markets since 2025-08-01.
    case 18488:
    case 15008:
      return player_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS

    case 18525:
      return player_prop_types.GAME_FIRST_QUARTER_RUSHING_RECEIVING_YARDS

    case 18491:
      return player_prop_types.GAME_RUSHING_YARDS

    case 16575:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS

    case 18494:
      return player_prop_types.GAME_FIRST_HALF_ALT_RUSHING_YARDS

    case 16820:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    // Total 1Q Rush Attempts. DraftKings re-keyed this product without
    // retiring 18524; both arrive under this category and mean the same thing.
    case 18524:
    case 19117:
      return player_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS

    default:
      return unmapped_subcategory(1001, subcategoryId)
  }
}

export const get_market_type_offer_1002 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9521:
      return player_prop_types.GAME_TACKLES_ASSISTS

    default:
      return unmapped_subcategory(1002, subcategoryId)
  }
}

export const get_market_type_offer_1003 = ({ subcategoryId, marketTypeId }) => {
  switch (subcategoryId) {
    case 11819:
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 12438:
      // subcategoryId 12438 is used for Anytime TD, First TD, and 2+ TDs
      // Differentiate based on marketTypeId
      if (marketTypeId === 11020) {
        return player_prop_types.GAME_TWO_PLUS_TOUCHDOWNS
      } else if (marketTypeId === 11019) {
        return player_prop_types.ANYTIME_TOUCHDOWN
      } else if (marketTypeId === 11018) {
        return player_prop_types.GAME_FIRST_TOUCHDOWN_SCORER
      }
      // Fallback to ANYTIME_TOUCHDOWN if marketTypeId is not recognized
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 11820:
      return player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER

    default:
      return unmapped_subcategory(1003, subcategoryId)
  }
}

export const get_market_type_offer_1163 = (subcategoryId) => {
  switch (subcategoryId) {
    case 11555:
      return player_prop_types.SUNDAY_LEADER_PASSING_YARDS

    case 11556:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 11557:
      return player_prop_types.SUNDAY_LEADER_RUSHING_YARDS

    default:
      return unmapped_subcategory(1163, subcategoryId)
  }
}

export const get_market_type_offer_1342 = (subcategoryId) => {
  switch (subcategoryId) {
    case 14113:
    case 14117:
    case 16570:
      return player_prop_types.GAME_ALT_RECEIVING_YARDS

    case 14114:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 14115:
      return player_prop_types.GAME_RECEPTIONS

    case 14116:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 14124:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 16233:
      return player_prop_types.GAME_ALT_LONGEST_RECEPTION

    case 16821:
      return player_prop_types.GAME_ALT_RECEPTIONS

    case 18489:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS

    case 18492:
      return player_prop_types.GAME_RECEIVING_YARDS

    case 18495:
      return player_prop_types.GAME_FIRST_HALF_ALT_RECEIVING_YARDS

    case 16574:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS

    // DraftKings publishes the longest-reception product under three
    // subcategories at once -- 14881, plus an "O/U" and a bare form added
    // later. All three are the same metric.
    case 14881:
    case 15948:
    case 16924:
      return player_prop_types.GAME_LONGEST_RECEPTION

    // Rec Yards - 1Q O/U. Found by the 2026-09-04 sweep for unmapped
    // subcategories whose type already existed: 1,764 markets since 2025-08-01,
    // ingested with a null market_type against a type declared all along.
    case 15006:
      return player_prop_types.GAME_FIRST_QUARTER_RECEIVING_YARDS

    case 18498:
    case 18502:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18520:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18527:
      return player_prop_types.GAME_FIRST_QUARTER_RECEPTIONS

    default:
      return unmapped_subcategory(1342, subcategoryId)
  }
}

// Offer category 1759 is DraftKings' season-long player-totals category, the
// only source of the season player props the dynasty valuation consumes. An
// unmapped subcategory here is silently dropped to a null market_type, so the
// selections keep landing but nothing can query them by type -- which is how
// SEASON_RECEPTIONS (18435) sat unclassified while DraftKings published 43
// markets for it. The importer emits one signal per run naming whatever lands
// here. Deliberately scoped to this one category: most other categories carry
// exotic markets that are unmapped on purpose, so a global collector would be
// pure noise.
export const unmapped_season_player_prop_subcategories = new Set()

export const get_market_type_offer_1759 = (subcategoryId) => {
  switch (subcategoryId) {
    case 17147:
      return player_prop_types.SEASON_PASSING_YARDS

    case 17148:
      return player_prop_types.SEASON_PASSING_TOUCHDOWNS

    case 17223:
      return player_prop_types.SEASON_RUSHING_YARDS

    case 17224:
      return player_prop_types.SEASON_RUSHING_TOUCHDOWNS

    case 17314:
      return player_prop_types.SEASON_RECEIVING_YARDS

    case 17315:
      return player_prop_types.SEASON_RECEIVING_TOUCHDOWNS

    // DraftKings re-keys the receptions subcategory each season: 18435 carried
    // it through 2025 (last observed 2025-09-05) and 20168 replaced it for
    // 2026. They never overlap, so both map to the same type.
    case 18435:
    case 20168:
      return player_prop_types.SEASON_RECEPTIONS

    case 17316:
      return player_prop_types.SEASON_DEFENSE_SACKS

    default:
      return unmapped_subcategory(1759, subcategoryId)
  }
}

export const get_market_type_offer_1595 = (subcategoryId) => {
  switch (subcategoryId) {
    case 15379:
      return player_prop_types.SEASON_LEADER_PASSING_YARDS

    case 18156:
      return player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS

    case 15380:
      return player_prop_types.SEASON_LEADER_RUSHING_YARDS

    case 15670:
      return player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS

    case 15381:
      return player_prop_types.SEASON_LEADER_RECEIVING_YARDS

    case 15651:
      return player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS

    case 15885:
      return player_prop_types.SEASON_LEADER_RECEPTIONS

    case 15661:
      return player_prop_types.SEASON_LEADER_SACKS

    case 15820:
      return player_prop_types.SEASON_LEADER_INTERCEPTIONS

    // DraftKings publishes season-leader props per position group: 15816 is
    // the QB-scoped most-rushing-yards leader and 20232 the RB/TE most-
    // receiving-yards leader. Same metric as the league-wide cases above with
    // a narrower field; first signalled 2026-09-05 (signal 128447).
    case 15816:
      return player_prop_types.SEASON_LEADER_RUSHING_YARDS

    case 20232:
      return player_prop_types.SEASON_LEADER_RECEIVING_YARDS

    default:
      return unmapped_subcategory(1595, subcategoryId)
  }
}

export const get_market_type_offer_787 = (subcategoryId) => {
  switch (subcategoryId) {
    case 13339:
      return awards_prop_types.SEASON_MVP

    case 13340:
      return awards_prop_types.OFFENSIVE_PLAYER_OF_THE_YEAR

    case 13341:
      return awards_prop_types.DEFENSIVE_PLAYER_OF_THE_YEAR

    case 13342:
      return awards_prop_types.OFFENSIVE_ROOKIE_OF_THE_YEAR

    case 13343:
      return awards_prop_types.DEFENSIVE_ROOKIE_OF_THE_YEAR

    case 13344:
      return awards_prop_types.COACH_OF_THE_YEAR

    case 13345:
      return awards_prop_types.COMEBACK_PLAYER_OF_THE_YEAR

    case 18166:
      return awards_prop_types.PROTECTOR_OF_THE_YEAR

    case 15907:
      return awards_prop_types.MVP_AND_SUPER_BOWL_WINNER

    default:
      return unmapped_subcategory(787, subcategoryId)
  }
}

export const get_market_type_offer_529 = (subcategoryId) => {
  switch (subcategoryId) {
    case 10500:
      return futures_types.SUPER_BOWL_WINNER

    case 4651:
      return futures_types.CONFERENCE_WINNER

    case 5629:
      return futures_types.DIVISION_WINNER

    case 9159:
      return futures_types.STAGE_OF_ELIMINATION

    case 10249:
      return futures_types.EXACT_RESULT

    case 7302:
      return futures_types.NAME_THE_FINALISTS

    case 10107:
      return futures_types.NUMBER_1_SEED

    case 15901:
      return futures_types.WINNING_CONFERENCE

    case 6447:
      return futures_types.CHAMPION_SPECIALS

    default:
      return unmapped_subcategory(529, subcategoryId)
  }
}

export const get_market_type_offer_1286 = (subcategoryId) => {
  switch (subcategoryId) {
    case 17455:
      return team_season_types.TEAM_REGULAR_SEASON_WINS

    case 13356:
      return team_season_types.TEAM_EXACT_REGULAR_SEASON_WINS

    case 13365:
      return team_season_types.TEAM_MOST_REGULAR_SEASON_WINS

    case 13367:
      return team_season_types.TEAM_FEWEST_REGULAR_SEASON_WINS

    case 13364:
      return team_season_types.TEAM_LONGEST_WINNING_STREAK

    case 13360:
      return team_season_types.TEAM_PERFECT_SEASON

    case 13368:
      return team_season_types.TEAM_WINLESS_SEASON

    default:
      return unmapped_subcategory(1286, subcategoryId)
  }
}

export const get_market_type_offer_1076 = (subcategoryId) => {
  switch (subcategoryId) {
    case 15399:
      return team_season_types.TEAM_TO_MAKE_PLAYOFFS

    case 15398:
      return team_season_types.TEAM_TO_MISS_PLAYOFFS

    default:
      return unmapped_subcategory(1076, subcategoryId)
  }
}

export const get_market_type_offer_528 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4659:
      return game_props_types.GAME_TOTAL_POINTS_ODD_EVEN

    case 5873:
      return game_props_types.GAME_WINNING_MARGIN

    case 9313:
      return game_props_types.GAME_FIRST_SCORING_PLAY_TYPE

    case 9315:
      return game_props_types.GAME_FIRST_TO_SCORE

    case 9316:
      return game_props_types.GAME_SAFETY_SCORED

    case 9319:
      return game_props_types.GAME_BOTH_TEAMS_TO_SCORE

    case 9325:
      return game_props_types.GAME_LAST_TO_SCORE

    case 9567:
      return game_props_types.GAME_RACE_TO_POINTS

    case 9590:
      return game_props_types.GAME_TWO_POINT_CONVERSION

    case 13459:
      return game_props_types.GAME_OVERTIME

    default:
      return unmapped_subcategory(528, subcategoryId)
  }
}

export const get_market_type_offer_820 = (subcategoryId) => {
  switch (subcategoryId) {
    case 7624:
      return division_specials_types.DIVISION_WINS

    case 13041:
      return division_specials_types.DIVISION_FINISHING_POSITION

    case 13206:
      return division_specials_types.DIVISION_LEADER_PASSING_YARDS

    case 13297:
      return division_specials_types.DIVISION_LEADER_RUSHING_YARDS

    default:
      return unmapped_subcategory(820, subcategoryId)
  }
}

const get_market_type_offer_492 = ({ subcategoryId, betOfferTypeId }) => {
  if (subcategoryId === 4518 && betOfferTypeId) {
    switch (betOfferTypeId) {
      case 1:
        return team_game_market_types.GAME_SPREAD

      case 2:
        return team_game_market_types.GAME_MONEYLINE

      case 6:
        return team_game_market_types.GAME_TOTAL

      case 13195:
        return team_game_market_types.GAME_ALT_SPREAD

      case 13196:
        return team_game_market_types.GAME_ALT_TOTAL

      default:
        log(`unknown offerCategoryId 492 betOfferTypeId ${betOfferTypeId}`)
        return unmapped_subcategory(492, subcategoryId)
    }
  }

  if (subcategoryId === 8411) {
    return team_game_market_types.GAME_MONEYLINE
  }

  if (subcategoryId === 9712) {
    return game_props_types.GAME_HALF_TIME_FULL_TIME
  }

  if (subcategoryId === 10398) {
    return game_props_types.GAME_HALF_TIME_FULL_TIME
  }

  if (subcategoryId === 13195 && betOfferTypeId === 1) {
    return team_game_market_types.GAME_ALT_SPREAD
  }

  if (subcategoryId === 13196 && betOfferTypeId === 6) {
    return team_game_market_types.GAME_ALT_TOTAL
  }

  return unmapped_subcategory(492, subcategoryId)
}

// Offer categories 526 (Halves) and 527 (Quarters) had NO handler until
// 2026-09-04. Absent from the dispatcher's switch, every market under them fell
// to its default arm and returned null -- 89,950 markets across 2023-2025, the
// largest live gap among shapes the taxonomy already models.
//
// The sixteen subcategories below are the complete set arriving under the two
// categories since 2025-08-01, read back from source_market_name, which embeds
// the vendor's own categoryId beside the subcategoryId. Three of them already
// had types; the other thirteen are period-scoped crosses of axes the taxonomy
// already carries.
//
// Two further first-quarter player subcategories were once thought to belong
// here. They do not: 19111 arrives under category 1000 and 19117 under 1001,
// both of which have handlers, so their cases live there.
export const get_market_type_offer_526 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4631:
      return team_game_market_types.GAME_FIRST_HALF_MONEYLINE

    case 4641:
      return team_game_market_types.GAME_SECOND_HALF_MONEYLINE

    case 13582:
      return team_game_market_types.GAME_FIRST_HALF_ALT_SPREAD

    case 13583:
      return team_game_market_types.GAME_SECOND_HALF_ALT_SPREAD

    case 13584:
      return team_game_market_types.GAME_FIRST_HALF_ALT_TOTAL

    case 13585:
      return team_game_market_types.GAME_SECOND_HALF_ALT_TOTAL

    default:
      return unmapped_subcategory(526, subcategoryId)
  }
}

export const get_market_type_offer_527 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4632:
      return team_game_market_types.GAME_FIRST_QUARTER_MONEYLINE

    case 4642:
      return team_game_market_types.GAME_SECOND_QUARTER_MONEYLINE

    case 4643:
      return team_game_market_types.GAME_THIRD_QUARTER_MONEYLINE

    case 4644:
      return team_game_market_types.GAME_FOURTH_QUARTER_MONEYLINE

    case 13525:
      return team_game_market_types.GAME_FIRST_QUARTER_ALT_SPREAD

    case 13526:
      return team_game_market_types.GAME_FIRST_QUARTER_ALT_TOTAL

    case 16078:
      return team_game_market_types.GAME_SECOND_QUARTER_ALT_SPREAD

    case 15707:
      return team_game_market_types.GAME_SECOND_QUARTER_ALT_TOTAL

    case 16079:
      return team_game_market_types.GAME_THIRD_QUARTER_ALT_SPREAD

    case 15708:
      return team_game_market_types.GAME_THIRD_QUARTER_ALT_TOTAL

    default:
      return unmapped_subcategory(527, subcategoryId)
  }
}

const get_market_type_offer_530 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4653:
      return team_game_market_types.GAME_ALT_TEAM_TOTAL

    default:
      return unmapped_subcategory(530, subcategoryId)
  }
}

export const get_market_type = ({
  offerCategoryId,
  subcategoryId,
  betOfferTypeId,
  marketTypeId
}) => {
  offerCategoryId = Number(offerCategoryId) || null
  subcategoryId = Number(subcategoryId) || null
  betOfferTypeId = Number(betOfferTypeId) || null
  marketTypeId = Number(marketTypeId) || null

  // Check for alternate marketTypeIds first - these override subcategory classification
  const alternate_type = ALTERNATE_MARKET_TYPE_IDS[marketTypeId]
  if (alternate_type) {
    return player_prop_types[alternate_type]
  }

  switch (offerCategoryId) {
    case 492:
      return get_market_type_offer_492({ subcategoryId, betOfferTypeId })

    case 526:
      return get_market_type_offer_526(subcategoryId)

    case 527:
      return get_market_type_offer_527(subcategoryId)

    case 529:
      return get_market_type_offer_529(subcategoryId)

    case 530:
      return get_market_type_offer_530(subcategoryId)

    case 634:
      return get_market_type_offer_634(subcategoryId)

    case 787:
      return get_market_type_offer_787(subcategoryId)

    case 1000:
      return get_market_type_offer_1000(subcategoryId)

    case 1001:
      return get_market_type_offer_1001(subcategoryId)

    case 1002:
      return get_market_type_offer_1002(subcategoryId)

    case 1003:
      return get_market_type_offer_1003({ subcategoryId, marketTypeId })

    case 1076:
      return get_market_type_offer_1076(subcategoryId)

    case 1163:
      return get_market_type_offer_1163(subcategoryId)

    case 1286:
      return get_market_type_offer_1286(subcategoryId)

    case 1342:
      return get_market_type_offer_1342(subcategoryId)

    case 1595:
      return get_market_type_offer_1595(subcategoryId)

    case 1759:
      return get_market_type_offer_1759(subcategoryId)

    case 528:
      return get_market_type_offer_528(subcategoryId)

    case 820:
      return get_market_type_offer_820(subcategoryId)

    default:
      log(`unknown offerCategoryId ${offerCategoryId}`)
      unmapped_offer_categories.add(offerCategoryId)
      return null
  }
}
