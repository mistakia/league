export const external_data_sources = {
  FANTASY_SHARKS: 1,
  CBS: 2,
  ESPN: 3,
  NFL: 4,
  FFTODAY: 5,
  PFF: 6,
  FBG_DAVID_DODDS: 7,
  FBG_BOB_HENRY: 8,
  FBG_JASON_WOOD: 9,
  FBG_MAURILE_TREMBLAY: 10,
  FBG_SIGMUND_BLOOM: 11,
  FANTASY_FOOTBALL_NERD: 12,
  NUMBERFIRE: 13,
  DRAFT_KINGS_VA: 14,
  BETONLINE: 15,
  '4FOR4': 16,
  FANTASYPROS: 17,

  AVERAGE: 18,

  FBG_CONSENSUS: 19,
  CAESARS_VA: 20,
  FANDUEL_NJ: 21,
  BETMGM_US: 22,
  PRIZEPICKS: 23,
  GAMBET_DC: 24,
  BETRIVERS_MD: 25,
  FANTASYLIFE_DWAIN_MCFARLAND: 26,
  FANTASYLIFE: 27,
  SLEEPER: 28
}

export const external_data_source_keys = {}
for (const key in external_data_sources) {
  const value = external_data_sources[key]
  external_data_source_keys[value] = key
}

export const external_data_source_display_names = {
  1: 'Fantasy Sharks',
  2: 'CBS',
  3: 'ESPN',
  4: 'NFL',
  5: 'FFToday',
  6: 'PFF',
  7: 'David Dodds (FBG)',
  8: 'Bob Henry (FBG)',
  9: 'Jason Wood (FBG)',
  10: 'Maurile Tremblay (FBG)',
  11: 'Sigmund Bloom (FBG)',
  12: 'Fantasy Football Nerd',
  13: 'Numberfire',
  14: 'Draft Kings (VA)',
  15: 'BetOnline',
  16: '4For4',
  17: 'FantasyPros',

  18: 'Average',
  19: 'Footballguys',
  20: 'Caesars (VA)',
  21: 'Fanduel (NJ)',
  22: 'BetMGM (US)',
  23: 'PrizePicks',
  24: 'Gambet (DC)',
  25: 'BetRivers (MD)',
  26: 'Fantasy Life (Dwain McFarland)',
  27: 'Fantasy Life',
  28: 'Sleeper'
}

export const keeptradecut_metric_types = {
  VALUE: 1,
  POSITION_RANK: 2,
  OVERALL_RANK: 3
}

export const default_points_added = -999

export const team_id_regex = /^([A-Z]{1,3})$/gi
export const player_id_regex =
  /^([A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2})$/gi
