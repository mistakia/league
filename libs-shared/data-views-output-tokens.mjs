export const RATE_TYPE_TO_OUTPUT = {
  per_game: { period: 'game', aggregation: 'rate' },
  per_team_play: { period: 'team_play', aggregation: 'rate' },
  per_team_pass_play: { period: 'team_pass_play', aggregation: 'rate' },
  per_team_rush_play: { period: 'team_rush_play', aggregation: 'rate' },
  per_team_half: { period: 'team_half', aggregation: 'rate' },
  per_team_quarter: { period: 'team_quarter', aggregation: 'rate' },
  per_team_drive: { period: 'team_drive', aggregation: 'rate' },
  per_team_series: { period: 'team_series', aggregation: 'rate' },
  per_player_rush_attempt: {
    period: 'player_rush_attempt',
    aggregation: 'rate'
  },
  per_player_pass_attempt: {
    period: 'player_pass_attempt',
    aggregation: 'rate'
  },
  per_player_target: { period: 'player_target', aggregation: 'rate' },
  per_player_catchable_target: {
    period: 'player_catchable_target',
    aggregation: 'rate'
  },
  per_player_deep_target: { period: 'player_deep_target', aggregation: 'rate' },
  per_player_catchable_deep_target: {
    period: 'player_catchable_deep_target',
    aggregation: 'rate'
  },
  per_player_reception: { period: 'player_reception', aggregation: 'rate' },
  per_player_touch: { period: 'player_touch', aggregation: 'rate' },
  per_player_opportunity: {
    period: 'player_opportunity',
    aggregation: 'rate'
  },
  per_player_play: { period: 'player_play', aggregation: 'rate' },
  per_player_pass_play: { period: 'player_pass_play', aggregation: 'rate' },
  per_player_rush_play: { period: 'player_rush_play', aggregation: 'rate' },
  per_player_route: { period: 'player_route', aggregation: 'rate' }
}

export const translate_rate_type_to_output = (rate_type) => {
  const entry = RATE_TYPE_TO_OUTPUT[rate_type]
  if (!entry) return null
  return {
    period: entry.period,
    aggregation: entry.aggregation,
    threshold: null
  }
}

// Periods whose denominator does not vary with play-level filter params.
// Single source of truth for is_play_level_period and the column-param UI
// `disabled_values` list in output-column-param.mjs / rate-type-column-param.mjs.
export const NON_PLAY_LEVEL_PERIODS = new Set([
  'game',
  'season',
  'team_half',
  'team_quarter'
])

export const is_play_level_period = (period) =>
  period != null && !NON_PLAY_LEVEL_PERIODS.has(period)
