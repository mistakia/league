// Shared league settings definitions
// This file contains the authoritative list of league settings fields
// that can be updated via the API

export const league_fields = [
  'name',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const league_format_fields = [
  'num_teams',
  'sqb',
  'srb',
  'swr',
  'ste',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'sdst',
  'sk',
  'bench',
  'ps',
  'ir',
  'cap',
  'min_bid'
]

export const league_scoring_format_fields = [
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',
  'ra',
  'ry',
  'tdr',
  'rec',
  'rbrec',
  'wrrec',
  'terec',
  'recy',
  'twoptc',
  'tdrec',
  'fuml',
  'prtd',
  'krtd'
]

export const season_fields = ['mqb', 'mrb', 'mwr', 'mte', 'mdst', 'mk', 'faab']

// All updatable league settings fields
export const league_settings_fields = [
  ...league_fields,
  ...season_fields,
  ...league_format_fields,
  ...league_scoring_format_fields
]

// Field type classifications for validation
export const integer_fields = [
  'sqb',
  'srb',
  'swr',
  'ste',
  'sk',
  'sdst',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'bench',
  'ps',
  'ir',
  'mqb',
  'mrb',
  'mwr',
  'mte',
  'mdst',
  'mk',
  'faab',
  'cap',
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',
  'ra',
  'ry',
  'tdr',
  'rbrec',
  'wrrec',
  'terec',
  'rec',
  'recy',
  'twoptc',
  'tdrec',
  'fuml',
  'num_teams',
  'min_bid',
  'prtd',
  'krtd',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const positive_integer_fields = [
  'sqb',
  'srb',
  'swr',
  'ste',
  'sk',
  'sdst',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'bench',
  'ps',
  'ir',
  'mqb',
  'mrb',
  'mwr',
  'mte',
  'mdst',
  'mk',
  'faab',
  'cap',
  'min_bid',
  'prtd',
  'krtd',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const float_fields = [
  'pa',
  'pc',
  'py',
  'ra',
  'ry',
  'rbrec',
  'wrrec',
  'terec',
  'rec',
  'recy'
]
