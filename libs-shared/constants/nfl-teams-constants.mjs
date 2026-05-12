export const nfl_team_abbreviations = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LA',
  'LAC',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS'
]

const nfl_team_info = {
  ARI: { label: 'Arizona Cardinals', group: 'NFC_WEST' },
  ATL: { label: 'Atlanta Falcons', group: 'NFC_SOUTH' },
  BAL: { label: 'Baltimore Ravens', group: 'AFC_NORTH' },
  BUF: { label: 'Buffalo Bills', group: 'AFC_EAST' },
  CAR: { label: 'Carolina Panthers', group: 'NFC_SOUTH' },
  CHI: { label: 'Chicago Bears', group: 'NFC_NORTH' },
  CIN: { label: 'Cincinnati Bengals', group: 'AFC_NORTH' },
  CLE: { label: 'Cleveland Browns', group: 'AFC_NORTH' },
  DAL: { label: 'Dallas Cowboys', group: 'NFC_EAST' },
  DEN: { label: 'Denver Broncos', group: 'AFC_WEST' },
  DET: { label: 'Detroit Lions', group: 'NFC_NORTH' },
  GB: { label: 'Green Bay Packers', group: 'NFC_NORTH' },
  HOU: { label: 'Houston Texans', group: 'AFC_SOUTH' },
  IND: { label: 'Indianapolis Colts', group: 'AFC_SOUTH' },
  JAX: { label: 'Jacksonville Jaguars', group: 'AFC_SOUTH' },
  KC: { label: 'Kansas City Chiefs', group: 'AFC_WEST' },
  LA: { label: 'Los Angeles Rams', group: 'NFC_WEST' },
  LAC: { label: 'Los Angeles Chargers', group: 'AFC_WEST' },
  LV: { label: 'Las Vegas Raiders', group: 'AFC_WEST' },
  MIA: { label: 'Miami Dolphins', group: 'AFC_EAST' },
  MIN: { label: 'Minnesota Vikings', group: 'NFC_NORTH' },
  NE: { label: 'New England Patriots', group: 'AFC_EAST' },
  NO: { label: 'New Orleans Saints', group: 'NFC_SOUTH' },
  NYG: { label: 'New York Giants', group: 'NFC_EAST' },
  NYJ: { label: 'New York Jets', group: 'AFC_EAST' },
  PHI: { label: 'Philadelphia Eagles', group: 'NFC_EAST' },
  PIT: { label: 'Pittsburgh Steelers', group: 'AFC_NORTH' },
  SEA: { label: 'Seattle Seahawks', group: 'NFC_WEST' },
  SF: { label: 'San Francisco 49ers', group: 'NFC_WEST' },
  TB: { label: 'Tampa Bay Buccaneers', group: 'NFC_SOUTH' },
  TEN: { label: 'Tennessee Titans', group: 'AFC_SOUTH' },
  WAS: { label: 'Washington Commanders', group: 'NFC_EAST' }
}

const nfl_team_logo_url = (abbrv) =>
  `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${abbrv}.png&h=64&w=64`

export const nfl_team_value_groups = [
  {
    id: 'AFC',
    label: 'AFC',
    children: [
      { id: 'AFC_EAST', label: 'AFC East' },
      { id: 'AFC_NORTH', label: 'AFC North' },
      { id: 'AFC_SOUTH', label: 'AFC South' },
      { id: 'AFC_WEST', label: 'AFC West' }
    ]
  },
  {
    id: 'NFC',
    label: 'NFC',
    children: [
      { id: 'NFC_EAST', label: 'NFC East' },
      { id: 'NFC_NORTH', label: 'NFC North' },
      { id: 'NFC_SOUTH', label: 'NFC South' },
      { id: 'NFC_WEST', label: 'NFC West' }
    ]
  }
]

// Build the rich `{ value, label, icon, group }` list used by the value picker.
// Pass `extra` to prepend items like `INA` (inactive) that aren't NFL teams.
export const build_nfl_team_values = (extra = []) => [
  ...extra,
  ...nfl_team_abbreviations.map((abbrv) => ({
    value: abbrv,
    label: nfl_team_info[abbrv]?.label || abbrv,
    icon: nfl_team_logo_url(abbrv),
    group: nfl_team_info[abbrv]?.group || null
  }))
]
