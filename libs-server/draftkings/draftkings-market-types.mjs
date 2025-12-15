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
      log(`unknown offercategoryId 634 subcategoryId ${subcategoryId}`)
      return null
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

    default:
      log(`unknown offercategoryId 1000 subcategoryId ${subcategoryId}`)
      return null
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

    case 18488:
      return player_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS

    case 18491:
      return player_prop_types.GAME_RUSHING_YARDS

    case 16575:
      return player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS

    case 18494:
      return player_prop_types.GAME_FIRST_HALF_ALT_RUSHING_YARDS

    case 16820:
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    case 18524:
      return player_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS

    default:
      log(`unknown offercategoryId 1001 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1002 = (subcategoryId) => {
  switch (subcategoryId) {
    case 9521:
      return player_prop_types.GAME_TACKLES_ASSISTS

    default:
      log(`unknown offercategoryId 1002 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1003 = ({ subcategoryId, marketTypeId }) => {
  switch (subcategoryId) {
    case 11819:
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 12438:
      // subcategoryId 12438 is used for both Anytime TD and 2+ TDs
      // Differentiate based on marketTypeId
      if (marketTypeId === 11020) {
        return player_prop_types.GAME_TWO_PLUS_TOUCHDOWNS
      } else if (marketTypeId === 11019) {
        return player_prop_types.ANYTIME_TOUCHDOWN
      }
      // Fallback to ANYTIME_TOUCHDOWN if marketTypeId is not provided
      return player_prop_types.ANYTIME_TOUCHDOWN

    case 11820:
      return player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER

    default:
      log(`unknown offercategoryId 1003 subcategoryId ${subcategoryId}`)
      return null
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
      log(`unknown offercategoryId 1163 subcategoryId ${subcategoryId}`)
      return null
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

    case 14881:
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 18498:
    case 18502:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18520:
      return player_prop_types.GAME_LEADER_RECEIVING_YARDS

    case 18527:
      return player_prop_types.GAME_FIRST_QUARTER_RECEPTIONS

    default:
      log(`unknown offercategoryId 1342 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1759 = (subcategoryId) => {
  switch (subcategoryId) {
    case 17147:
      return player_prop_types.SEASON_PASSING_YARDS

    case 17148:
      return player_prop_types.SEASON_PASSING_TOUCHDOWNS

    case 17223:
      return player_prop_types.SEASON_RUSHING_YARDS

    case 17314:
      return player_prop_types.SEASON_RECEIVING_YARDS

    case 17315:
      return player_prop_types.SEASON_RECEIVING_TOUCHDOWNS

    default:
      log(`unknown offercategoryId 1759 subcategoryId ${subcategoryId}`)
      return null
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

    default:
      log(`unknown offercategoryId 1595 subcategoryId ${subcategoryId}`)
      return null
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
      log(`unknown offercategoryId 787 subcategoryId ${subcategoryId}`)
      return null
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
      log(`unknown offercategoryId 529 subcategoryId ${subcategoryId}`)
      return null
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
      log(`unknown offercategoryId 1286 subcategoryId ${subcategoryId}`)
      return null
  }
}

export const get_market_type_offer_1076 = (subcategoryId) => {
  switch (subcategoryId) {
    case 15399:
      return team_season_types.TEAM_TO_MAKE_PLAYOFFS

    case 15398:
      return team_season_types.TEAM_TO_MISS_PLAYOFFS

    default:
      log(`unknown offercategoryId 1076 subcategoryId ${subcategoryId}`)
      return null
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
      log(`unknown subcategory for offer category 528: ${subcategoryId}`)
      return null
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
      log(`unknown subcategory for offer category 820: ${subcategoryId}`)
      return null
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
        log(`unknown betOfferTypeId ${betOfferTypeId}`)
        return null
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

  return null
}

const get_market_type_offer_530 = (subcategoryId) => {
  switch (subcategoryId) {
    case 4653:
      return team_game_market_types.GAME_ALT_TEAM_TOTAL

    default:
      log(`unknown offercategoryId 530 subcategoryId ${subcategoryId}`)
      return null
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
      return null
  }
}
