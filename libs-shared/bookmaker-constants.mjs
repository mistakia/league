export const player_prop_types = {
  SEASON_PASSING_YARDS: 'SEASON_PASSING_YARDS',
  SEASON_PASSING_TOUCHDOWNS: 'SEASON_PASSING_TOUCHDOWNS',
  SEASON_PASSING_COMPLETIONS: 'SEASON_PASSING_COMPLETIONS',
  SEASON_RUSHING_YARDS: 'SEASON_RUSHING_YARDS',
  SEASON_RECEIVING_YARDS: 'SEASON_RECEIVING_YARDS',

  SEASON_LEADER_PASSING_TOUCHDOWNS: 'SEASON_LEADER_PASSING_TOUCHDOWNS',
  SEASON_LEADER_RUSHING_TOUCHDOWNS: 'SEASON_LEADER_RUSHING_TOUCHDOWNS',
  SEASON_LEADER_RECEIVING_TOUCHDOWNS: 'SEASON_LEADER_RECEIVING_TOUCHDOWNS',
  SEASON_LEADER_SACKS: 'SEASON_LEADER_SACKS',
  SEASON_LEADER_INTERCEPTIONS: 'SEASON_LEADER_INTERCEPTIONS',
  SEASON_LEADER_PASSING_YARDS: 'SEASON_LEADER_PASSING_YARDS',
  SEASON_LEADER_RUSHING_YARDS: 'SEASON_LEADER_RUSHING_YARDS',
  SEASON_LEADER_RECEIVING_YARDS: 'SEASON_LEADER_RECEIVING_YARDS',

  GAME_PASSING_YARDS: 'GAME_PASSING_YARDS',
  GAME_RECEIVING_YARDS: 'GAME_RECEIVING_YARDS',
  GAME_RUSHING_YARDS: 'GAME_RUSHING_YARDS',
  GAME_PASSING_COMPLETIONS: 'GAME_PASSING_COMPLETIONS',
  GAME_PASSING_TOUCHDOWNS: 'GAME_PASSING_TOUCHDOWNS',
  GAME_RECEPTIONS: 'GAME_RECEPTIONS',
  GAME_PASSING_INTERCEPTIONS: 'GAME_PASSING_INTERCEPTIONS',
  GAME_RUSHING_ATTEMPTS: 'GAME_RUSHING_ATTEMPTS',
  GAME_RUSHING_RECEIVING_YARDS: 'GAME_RUSHING_RECEIVING_YARDS',
  GAME_RECEIVING_TOUCHDOWNS: 'GAME_RECEIVING_TOUCHDOWNS',
  GAME_RUSHING_TOUCHDOWNS: 'GAME_RUSHING_TOUCHDOWNS',
  GAME_PASSING_ATTEMPTS: 'GAME_PASSING_ATTEMPTS',
  GAME_PASSING_LONGEST_COMPLETION: 'GAME_PASSING_LONGEST_COMPLETION',
  GAME_LONGEST_RECEPTION: 'GAME_LONGEST_RECEPTION',
  GAME_RUSHING_RECEIVING_TOUCHDOWNS: 'GAME_RUSHING_RECEIVING_TOUCHDOWNS',
  GAME_LONGEST_RUSH: 'GAME_LONGEST_RUSH',
  GAME_TACKLES_ASSISTS: 'GAME_TACKLES_ASSISTS',
  GAME_PASSING_RUSHING_YARDS: 'GAME_PASSING_RUSHING_YARDS',

  GAME_ALT_PASSING_TOUCHDOWNS: 'GAME_ALT_PASSING_TOUCHDOWNS',
  GAME_ALT_PASSING_COMPLETIONS: 'GAME_ALT_PASSING_COMPLETIONS',
  GAME_ALT_PASSING_YARDS: 'GAME_ALT_PASSING_YARDS',

  GAME_ALT_RUSHING_YARDS: 'GAME_ALT_RUSHING_YARDS',
  GAME_ALT_RUSHING_ATTEMPTS: 'GAME_ALT_RUSHING_ATTEMPTS',

  GAME_ALT_RECEIVING_YARDS: 'GAME_ALT_RECEIVING_YARDS',
  GAME_ALT_RECEPTIONS: 'GAME_ALT_RECEPTIONS',

  GAME_ALT_RUSHING_RECEIVING_YARDS: 'GAME_ALT_RUSHING_RECEIVING_YARDS',

  GAME_LEADER_PASSING_YARDS: 'GAME_LEADER_PASSING_YARDS',
  GAME_LEADER_RUSHING_YARDS: 'GAME_LEADER_RUSHING_YARDS',
  GAME_LEADER_RECEIVING_YARDS: 'GAME_LEADER_RECEIVING_YARDS',

  SUNDAY_LEADER_PASSING_YARDS: 'SUNDAY_LEADER_PASSING_YARDS',
  SUNDAY_LEADER_RUSHING_YARDS: 'SUNDAY_LEADER_RUSHING_YARDS',
  SUNDAY_LEADER_RECEIVING_YARDS: 'SUNDAY_LEADER_RECEIVING_YARDS'
}

export const player_prop_type_desc = {
  [player_prop_types.SEASON_PASSING_YARDS]: 'Pass Yards (seas)',
  [player_prop_types.SEASON_PASSING_TOUCHDOWNS]: 'Pass TDs (seas)',
  [player_prop_types.SEASON_PASSING_COMPLETIONS]: 'Pass Comps (seas)',
  [player_prop_types.SEASON_RUSHING_YARDS]: 'Rush Yards (seas)',
  [player_prop_types.SEASON_RECEIVING_YARDS]: 'Recv Yards (seas)',

  [player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS]: 'Pass TDs (seas)',
  [player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS]: 'Rush TDs (seas)',
  [player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS]: 'Recv TDs (seas)',
  [player_prop_types.SEASON_LEADER_SACKS]: 'Sacks (seas)',
  [player_prop_types.SEASON_LEADER_INTERCEPTIONS]: 'Ints (seas)',
  [player_prop_types.SEASON_LEADER_PASSING_YARDS]: 'Pass Yards Leader (seas)',
  [player_prop_types.SEASON_LEADER_RUSHING_YARDS]: 'Rush Yards Leader (seas)',
  [player_prop_types.SEASON_LEADER_RECEIVING_YARDS]: 'Recv Yards Leader (seas)',

  [player_prop_types.GAME_PASSING_YARDS]: 'Pass Yards',
  [player_prop_types.GAME_RECEIVING_YARDS]: 'Recv Yards',
  [player_prop_types.GAME_RUSHING_YARDS]: 'Rush Yards',
  [player_prop_types.GAME_PASSING_COMPLETIONS]: 'Pass Comps',
  [player_prop_types.GAME_PASSING_TOUCHDOWNS]: 'Pass TDs',
  [player_prop_types.GAME_RECEPTIONS]: 'Recs',
  [player_prop_types.GAME_PASSING_INTERCEPTIONS]: 'Ints',
  [player_prop_types.GAME_RUSHING_ATTEMPTS]: 'Rush Atts',
  [player_prop_types.GAME_RUSHING_RECEIVING_YARDS]: 'Rush + Recv Yards',
  [player_prop_types.GAME_RECEIVING_TOUCHDOWNS]: 'Recv TDs',
  [player_prop_types.GAME_RUSHING_TOUCHDOWNS]: 'Rush TDs',
  [player_prop_types.GAME_PASSING_ATTEMPTS]: 'Pass Atts',
  [player_prop_types.GAME_PASSING_LONGEST_COMPLETION]: 'Longest Comp',
  [player_prop_types.GAME_LONGEST_RECEPTION]: 'Longest Rec',
  [player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS]: 'Anytime TDs',
  [player_prop_types.GAME_LONGEST_RUSH]: 'Longest Rush',
  [player_prop_types.GAME_TACKLES_ASSISTS]: 'Tackles + Assists',
  [player_prop_types.GAME_PASSING_RUSHING_YARDS]: 'Pass + Rush Yards',

  [player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS]: 'Alt Pass TDs',
  [player_prop_types.GAME_ALT_PASSING_COMPLETIONS]: 'Alt Pass Comps',
  [player_prop_types.GAME_ALT_PASSING_YARDS]: 'Alt Pass Yards',

  [player_prop_types.GAME_ALT_RUSHING_YARDS]: 'Alt Rush Yards',
  [player_prop_types.GAME_ALT_RUSHING_ATTEMPTS]: 'Alt Rush Atts',

  [player_prop_types.GAME_ALT_RECEIVING_YARDS]: 'Alt Recv Yards',
  [player_prop_types.GAME_ALT_RECEPTIONS]: 'Alt Recs',

  [player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS]: 'Alt Rush + Recv Yards',

  [player_prop_types.GAME_LEADER_PASSING_YARDS]: 'Pass Yards Leader (game)',
  [player_prop_types.GAME_LEADER_RUSHING_YARDS]: 'Rush Yards Leader (game)',
  [player_prop_types.GAME_LEADER_RECEIVING_YARDS]: 'Recv Yards Leader (game)',

  [player_prop_types.SUNDAY_LEADER_PASSING_YARDS]: 'Pass Yards Leader (sunday)',
  [player_prop_types.SUNDAY_LEADER_RUSHING_YARDS]: 'Rush Yards Leader (sunday)',
  [player_prop_types.SUNDAY_LEADER_RECEIVING_YARDS]:
    'Recv Yards Leader (sunday)'
}
