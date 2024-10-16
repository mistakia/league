export const job_types = {
  CLAIMS_WAIVERS_ACTIVE: 1,
  CLAIMS_WAIVERS_PRACTICE: 2,
  CLAIMS_WAIVERS_POACH: 3,

  CLAIMS_POACH: 4,

  PLAYERS_MFL: 5,
  IMPORT_PLAYERS_SLEEPER: 6,
  PLAYERS_MFL_INJURIES: 7,

  PROJECTIONS_PFF: 8,
  PROJECTIONS_FFTODAY: 9,
  PROJECTIONS_CBS: 10,
  PROJECTIONS_ESPN: 11,
  PROJECTIONS_FANTASYSHARKS: 12,
  PROJECTIONS_NFL: 13,

  NOTIFICATIONS_DRAFT: 14,
  NOTIFICATIONS_POACH_8HR: 15,
  NOTIFICATIONS_POACH_1HR: 16,

  GENERATE_ROSTERS: 17,
  GENERATE_DRAFT_PICKS: 18,

  PLAYERS_ARMCHAIR: 19,

  IMPORT_NFL_GAMES_NGS: 20,
  IMPORT_NFL_GAMES_NFL: 23,

  NFL_PLAYS_NGS: 21,
  NFL_PLAYS_NFL: 22,

  NFL_PLAYERS: 24,
  NFL_PLAYER_IDS: 25,

  PROJECTIONS_FBG: 26,
  PROJECTIONS_FFN: 27,
  PRACTICE_REPORT: 28,

  PROJECTIONS_NUMBERFIRE: 29,

  PROCESS_PLAY_STATS: 30,
  DATA_ARMCHAIR: 31,
  DATA_FOOTBALL_OUTSIDERS: 32,

  DRAFTKINGS_ODDS: 33,
  BETONLINE_ODDS: 34,
  PROJECTIONS_4FOR4: 35,
  FANTASYPROS_DYNASTY: 36,
  FANTASYPROS_WEEKLY: 37,
  FANTASYPROS_DRAFT: 38,

  CALCULATE_FRANCHISE_TAGS: 39,

  PROCESS_MATCHUPS: 40,
  DRAW_DIVISIONS: 41,
  GENERATE_SCHEDULE: 42,
  PROCESS_EXTENSIONS: 43,

  PROCESS_TRANSITION_BIDS: 44,
  RESET_PLAYER_TAGS: 45,
  RESET_PROTECTED_DESIGNATION: 46,
  SET_DRAFT_PICK_NUMBER: 47,

  PROCESS_PROJECTIONS: 48,
  PLAYERS_KEEPTRADECUT: 49,
  UPDATE_FORMATTED_NAMES: 50,
  IMPORT_KEEPTRADECUT: 51,

  IMPORT_PLAYS_NFLFASTR: 52,
  PROCESS_PLAYOFFS: 53,

  CAESARS_ODDS: 54,
  FANDUEL_ODDS: 55,
  BETMGM_ODDS: 56,
  PRIZEPICKS_PROJECTIONS: 57,
  GAMBET_ODDS: 58,
  BETRIVERS_ODDS: 59,

  GENERATE_NEW_SEASONS: 60,

  IMPORT_GAMES_NFLVERSE: 61,
  IMPORT_PLAYS_FTN_CHARTING: 62,
  IMPORT_PLAYER_CONTRACTS_NFLVERSE: 63,

  FINALIZE_WEEK: 64,
  IMPORT_PFF_GRADES: 65,
  IMPORT_SLEEPER_ADP_AND_PROJECTIONS: 66,
  IMPORT_DRAFTKINGS_DFS_SALARIES: 67,
  IMPORT_FANDUEL_DFS_SALARIES: 68,
  IMPORT_ESPN_ADP: 69,
  IMPORT_CBS_ADP: 70,
  IMPORT_RTS_ADP: 71,
  IMPORT_NFL_ADP: 72,
  IMPORT_MFL_ADP: 73,
  IMPORT_YAHOO_ADP: 74,
  IMPORT_PINNACLE_ODDS: 75,

  IMPORT_PLAYERS_NGS_HIGHLIGHT: 76,
  IMPORT_PLAYS_NGS_V2: 77,
  PROCESS_MARKET_HIT_RATES: 78,
  IMPORT_ESPN_LINE_WIN_RATES: 79,
  IMPORT_PLAYS_PLAYERPROFILER: 80,
  IMPORT_DVOA_SHEETS: 81,
  IMPORT_NFL_GAMELOGS: 82,
  IMPORT_ESPN_RECEIVING_TRACKING_METRICS: 83
}

export const job_title_by_id = {
  1: 'Active Roster Free Agency Waivers',
  2: 'Practice Squad Free Agency Waivers',
  3: 'Poaching Waivers',
  4: 'Poaching Claims',
  5: 'Player Status (MFL)',
  6: 'Import Players (Sleeper)',
  7: 'Player Status (MFL Injuries)',
  8: 'Projections (PFF)',
  9: 'Projections (FFToday)',
  10: 'Projections (CBS)',
  11: 'Projections (ESPN)',
  12: 'Projections (FantasySharks)',
  13: 'Projections (NFL)',
  14: 'Notifications (Draft)',
  15: 'Notifications (Poach) 8HR',
  16: 'Notifications (Poach) 1HR',
  17: 'Generate Rosters',
  18: 'Generate Draft Picks',
  19: 'Import Players (Armchair)',
  20: 'Import NFL Games (NGS)',
  21: 'Import NFL Plays (NGS)',
  22: 'Import NFL Plays (NFL)',
  23: 'Import NFL Games (NFL)',
  24: 'NFL Players (NFL)',
  25: 'NFL Player Ids (NFL)',
  26: 'Projections (FBG)',
  27: 'Projections (FFN)',
  28: 'Practice Report',
  29: 'Projections (Numberfire)',
  30: 'Process Play Stats',
  31: 'Armchair (Data)',
  32: 'Import Football Outsiders (Data)',
  33: 'DraftKings Odds',
  34: 'BetOnline Odds',
  35: 'Projections (4for4)',
  36: 'FantasyPros Dynasty',
  37: 'FantasyPros Weekly',
  38: 'FantasyPros Draft',
  39: 'Calculate Franchise Tags',
  40: 'Process Matchups',
  41: 'Draw Divisions',
  42: 'Generate Schedule',
  43: 'Process Extensions',
  44: 'Process Transition Bids',
  45: 'Reset Player Tags',
  46: 'Reset Player Protected Designation',
  47: 'Set Draft Pick Order',
  48: 'Process Projections',
  49: 'Import Keeptradecut Players',
  50: 'Update Formatted Names',
  51: 'Import Keeptradecut',
  52: 'Import Plays nflfastR',
  53: 'Process Playoffs',
  54: 'Caesars Player Prop Odds',
  55: 'Fanduel Player Prop Odds',
  56: 'BetMGM Player Prop Odds',
  57: 'PrizePicks Projections',
  58: 'Gambet Odds',
  59: 'Betrivers Odds',
  60: 'Generate New Seasons',
  61: 'Import NFL Games (NFLverse)',
  62: 'Import Charted Plays (NFLverse/FTN)',
  63: 'Import Player Contracts (NFLverse/OTC)',
  64: 'Finalize Week',
  65: 'Import PFF Grades',
  66: 'Import Sleeper ADP and Projections',
  67: 'Import DraftKings DFS Salaries',
  68: 'Import Fanduel DFS Salaries',
  69: 'Import ESPN ADP',
  70: 'Import CBS ADP',
  71: 'Import RTS ADP',
  72: 'Import NFL ADP',
  73: 'Import MFL ADP',
  74: 'Import Yahoo ADP',
  75: 'Import Pinnacle Odds',
  76: 'Import Players (NGS Highlight)',
  77: 'Import Plays (NGS V2)',
  78: 'Process Market Hit Rates',
  79: 'Import ESPN Line Win Rates',
  80: 'Import Plays (PlayerProfiler)',
  81: 'Import DVOA Sheets',
  82: 'Import NFL Game Logs',
  83: 'Import ESPN Receiving Tracking Metrics'
}
