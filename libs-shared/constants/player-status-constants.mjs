export const player_nfl_status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXEMPT: 'EXEMPT',
  RESERVE_FUTURE: 'RESERVE_FUTURE',
  CUT: 'CUT',
  PRACTICE_SQUAD: 'PRACTICE_SQUAD',
  PRACTICE_SQUAD_INJURED_RESERVE: 'PRACTICE_SQUAD_INJURED_RESERVE',
  NOT_WITH_TEAM: 'NOT_WITH_TEAM',
  PHYSICALLY_UNABLE_TO_PERFORM: 'PHYSICALLY_UNABLE_TO_PERFORM',
  INJURED_RESERVE: 'INJURED_RESERVE',
  INJURED_RESERVE_DESIGNATED_TO_RETURN: 'INJURED_RESERVE_DESIGNATED_TO_RETURN',
  INJURED_RESERVE_COVID: 'INJURED_RESERVE_COVID',
  NON_FOOTBALL_RELATED_INJURED_RESERVE: 'NON_FOOTBALL_RELATED_INJURED_RESERVE',
  RETIRED: 'RETIRED',
  RESTRICTED_FREE_AGENT: 'RESTRICTED_FREE_AGENT',
  SUSPENDED: 'SUSPENDED',
  UNDRAFTED_FREE_AGENT: 'UNDRAFTED_FREE_AGENT',
  UNSIGNED_FREE_AGENT: 'UNSIGNED_FREE_AGENT',
  DID_NOT_REPORT: 'DID_NOT_REPORT',
  COMMISSIONER_EXEMPT_LIST: 'COMMISSIONER_EXEMPT_LIST',
  WAIVED: 'WAIVED',
  EXCLUSIVE_RIGHTS_FREE_AGENT: 'EXCLUSIVE_RIGHTS_FREE_AGENT'
}

export const player_nfl_injury_status = {
  DOUBTFUL: 'DOUBTFUL',
  QUESTIONABLE: 'QUESTIONABLE',
  OUT: 'OUT',
  PROBABLE: 'PROBABLE'
}

export const nfl_player_status_abbreviations = {
  [player_nfl_status.ACTIVE]: 'ACT',
  [player_nfl_status.INACTIVE]: 'INA',
  [player_nfl_status.EXEMPT]: 'EX',
  [player_nfl_status.RESERVE_FUTURE]: 'RF',
  [player_nfl_status.CUT]: 'CUT',
  [player_nfl_status.PRACTICE_SQUAD]: 'NFL-PS',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]: 'NFL-PS',
  [player_nfl_status.NOT_WITH_TEAM]: 'INA',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]: 'PUP',
  [player_nfl_status.INJURED_RESERVE]: 'IR',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]: 'IR-R',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'IR-COV',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]: 'IR-NFI',
  [player_nfl_status.RETIRED]: 'RET',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'RF',
  [player_nfl_status.SUSPENDED]: 'SUSP',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'UDFA',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'UFA',
  [player_nfl_status.DID_NOT_REPORT]: 'DNR',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'EX',
  [player_nfl_status.WAIVED]: 'WAV',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]: 'ERFA',

  [player_nfl_injury_status.DOUBTFUL]: 'D',
  [player_nfl_injury_status.QUESTIONABLE]: 'Q',
  [player_nfl_injury_status.OUT]: 'O',
  [player_nfl_injury_status.PROBABLE]: 'P'
}

export const nfl_player_status_display_names = {
  [player_nfl_status.ACTIVE]: 'Active',
  [player_nfl_status.INACTIVE]: 'Inactive',
  [player_nfl_status.EXEMPT]: 'Exempt',
  [player_nfl_status.RESERVE_FUTURE]: 'Reserve Future',
  [player_nfl_status.CUT]: 'Cut',
  [player_nfl_status.PRACTICE_SQUAD]: 'Practice Squad',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]:
    'Practice Squad Injured Reserve',
  [player_nfl_status.NOT_WITH_TEAM]: 'Not With Team',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]:
    'Physically Unable to Perform',
  [player_nfl_status.INJURED_RESERVE]: 'Injured Reserve',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]:
    'Injured Reserve Designated to Return',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'Injured Reserve (COVID-19)',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]:
    'Non Football Injured Reserve',
  [player_nfl_status.RETIRED]: 'Retired',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'Restricted Free Agent',
  [player_nfl_status.SUSPENDED]: 'Suspended',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'Undrafted Free Agent',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'Unsigned Free Agent',
  [player_nfl_status.DID_NOT_REPORT]: 'Did Not Report',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'Commissioner Exempt List',
  [player_nfl_status.WAIVED]: 'Waived',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]:
    'Exclusive Rights Free Agent',

  [player_nfl_injury_status.DOUBTFUL]: 'Doubtful',
  [player_nfl_injury_status.QUESTIONABLE]: 'Questionable',
  [player_nfl_injury_status.OUT]: 'Out',
  [player_nfl_injury_status.PROBABLE]: 'Probable'
}

export const nfl_player_status_descriptions = {
  [player_nfl_status.ACTIVE]: 'Active',
  [player_nfl_status.INACTIVE]: 'Inactive',
  [player_nfl_status.EXEMPT]: 'Exempt',
  [player_nfl_status.RESERVE_FUTURE]: 'Reserve Future',
  [player_nfl_status.CUT]: 'Cut',
  [player_nfl_status.PRACTICE_SQUAD]: 'Practice Squad',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]:
    'Practice Squad Injured Reserve',
  [player_nfl_status.NOT_WITH_TEAM]: 'Not With Team',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]:
    'Physically Unable to Perform',
  [player_nfl_status.INJURED_RESERVE]: 'Injured Reserve',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]:
    'Injured Reserve Designated to Return',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'Injured Reserve (COVID-19)',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]:
    'Non Football Injured Reserve',
  [player_nfl_status.RETIRED]: 'Retired',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'Restricted Free Agent',
  [player_nfl_status.SUSPENDED]: 'Suspended',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'Undrafted Free Agent',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'Unsigned Free Agent',
  [player_nfl_status.DID_NOT_REPORT]: 'Did Not Report',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'Commissioner Exempt List',
  [player_nfl_status.WAIVED]: 'Waived',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]:
    'Exclusive Rights Free Agent',

  [player_nfl_injury_status.DOUBTFUL]: 'Doubtful',
  [player_nfl_injury_status.QUESTIONABLE]: 'Questionable',
  [player_nfl_injury_status.OUT]: 'Out',
  [player_nfl_injury_status.PROBABLE]: 'Probable'
}
