import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'

export const NFL_GAME_COMPETITION_ID = 12282733

export const tabs = [
  'quarter-props',
  'passing-props',
  'receiving-props',
  'rushing-props',
  'defensive-props',
  'td-scorer-props'
]

export const leader_market_names = {
  'Most Passing Yards of Game': player_prop_types.GAME_LEADER_PASSING_YARDS,
  'Most Receiving Yards of Game': player_prop_types.GAME_LEADER_RECEIVING_YARDS,
  'Most Rushing Yards of Game': player_prop_types.GAME_LEADER_RUSHING_YARDS,

  'Most Passing Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_PASSING_YARDS,
  'Most Receiving Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_RECEIVING_YARDS,
  'Most Rushing Yards - Sunday Only':
    player_prop_types.SUNDAY_LEADER_RUSHING_YARDS
}
