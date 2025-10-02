import dayjs from 'dayjs'
import debug from 'debug'

import { fixTeam } from '#libs-shared'
import { format_selection_type } from './fanduel-formatters.mjs'

const log = debug('fanduel:wagers')

export const get_market_details_from_wager = (wager_leg) => {
  if (!wager_leg.eventMarketDescription) {
    console.log(wager_leg)
    throw new Error('missing eventMarketDescription')
  }

  const get_metric_name = (stat_type) => {
    // example `1st Half Bills Total Points`
    if (stat_type.match(/1st Half .* Total Points/)) {
      return 'FIRST_HALF_TEAM_TOTAL_POINTS'
    }

    switch (stat_type) {
      case 'Passing TDs':
      case 'Alt Passing TDs':
        return 'PASSING_TOUCHDOWNS'

      case 'Passing Yds':
      case 'Alt Passing Yds':
        return 'PASSING_YARDS'

      case 'Rushing Yds':
      case 'Alt Rushing Yds':
        return 'RUSHING_YARDS'

      case 'Receiving Yds':
      case 'Alt Receiving Yds':
        return 'RECEIVING_YARDS'

      case 'Rushing + Receiving Yds':
      case 'Alt Rushing + Receiving Yds':
        return 'RUSHING_RECEIVING_YARDS'

      case 'Total Receptions':
      case 'Alt Receptions':
        return 'RECEPTIONS'

      case 'Total Match Points':
      case 'Alternate Total Points':
        return 'TOTAL_POINTS'

      case 'Alternate Spread':
      case 'Spread':
        return 'SPREAD'

      case 'First Half Spread':
        return 'FIRST_HALF_SPREAD'

      case 'Any Time Touchdown Scorer':
        return 'ANYTIME_TOUCHDOWN'

      case 'Moneyline':
        return 'MONEYLINE'

      default:
        log(wager_leg)
        throw new Error(`Invalid stat type: ${stat_type}`)
    }
  }

  const check_over_under = (over_or_under) => {
    switch (over_or_under) {
      case 'OVER':
        return 'OVER'

      case 'UNDER':
        return 'UNDER'

      default:
        throw new Error(`Invalid over or under: ${over_or_under}`)
    }
  }

  const get_selection_name = ({ metric_name, over_or_under }) => {
    switch (metric_name) {
      case 'MONEYLINE':
      case 'SPREAD': {
        if (wager_leg.selectionName.includes('(')) {
          const team_name = wager_leg.selectionName.split('(')[0].trim()
          return fixTeam(team_name)
        } else {
          return fixTeam(wager_leg.selectionName)
        }
      }

      case 'FIRST_HALF_SPREAD': {
        return fixTeam(wager_leg.selectionName)
      }

      case 'PASSING_TOUCHDOWNS':
      case 'PASSING_YARDS':
      case 'RUSHING_YARDS':
      case 'RECEIVING_YARDS':
      case 'RUSHING_RECEIVING_YARDS':
      case 'RECEPTIONS':
      case 'TOTAL_POINTS':
      case 'FIRST_HALF_TEAM_TOTAL_POINTS':
      case 'ANYTIME_TOUCHDOWN':
        return check_over_under(over_or_under)

      default:
        throw new Error(`Invalid metric name: ${metric_name}`)
    }
  }

  let player_name = null
  let nfl_team = null
  let market_desc_detail = null
  let metric_line = null

  if (wager_leg.eventMarketDescription.includes(' - ')) {
    player_name = wager_leg.eventMarketDescription.split(' - ')[0]

    market_desc_detail = wager_leg.eventMarketDescription.split(' - ')[1].trim()
  } else {
    market_desc_detail = wager_leg.eventMarketDescription
  }

  const metric_name = get_metric_name(market_desc_detail)
  const selection_name = get_selection_name({
    metric_name,
    over_or_under: wager_leg.overOrUnder
  })

  if (metric_name === 'ANYTIME_TOUCHDOWN') {
    player_name = wager_leg.selectionName
  }

  if (wager_leg.parsedHandicap) {
    metric_line = Number(wager_leg.parsedHandicap)
  } else if (metric_name === 'TOTAL_POINTS' || metric_name === 'SPREAD') {
    // example 'Over (37.5)', Buffalo Bills (-3.5)
    metric_line = Number(wager_leg.selectionName.match(/\((.*?)\)/)[1])
  }

  if (metric_name === 'FIRST_HALF_TEAM_TOTAL_POINTS') {
    const matched_regex = wager_leg.eventMarketDescription.match(
      /1st Half (.*?) Total Points/
    )
    nfl_team = fixTeam(matched_regex[1])
  }

  let market_type = null

  if (player_name) {
    market_type = 'PLAYER_GAME_PROPS'
  } else if (nfl_team) {
    market_type = 'TEAM_GAME_PROPS'
  } else {
    market_type = 'GAME_PROPS'
  }

  return {
    market_type,
    player_name,
    nfl_team,
    metric_name,
    metric_line,
    selection_name,
    selection_type: format_selection_type({
      market_type: wager_leg.marketType,
      selection_name: wager_leg.selectionName
    }),
    event_description: wager_leg.eventDescription,
    start_time: dayjs(wager_leg.startTime)
  }
}
