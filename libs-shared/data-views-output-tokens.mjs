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

// Legacy request-path param KEYS from the pre-identity `rate_type` vocabulary.
//
// This map is PERMANENT, not a deprecation window. Shared short URLs are
// immutable rows in the production `urls` table and carry these spellings
// forever, and the saved-view migrator runs against browser localStorage, so it
// cannot reach them -- a request carrying the legacy key arrives at the server
// indefinitely.
//
// It is declared ONCE here so the two consumers cannot drift: the client-side
// saved-view migrator folds it into PARAM_KEY_RENAMES, and the server rewrites
// it at the request boundary in get-data-view-results. Everything downstream of
// that boundary sees the canonical key only, so no read site has to carry a
// second spelling -- the alternative is a `??` fallback at each reader, which is
// how one legacy key ends up handled in four places and missed in a fifth.
export const LEGACY_OUTPUT_PARAM_KEYS = {
  rate_type_column_params: 'output_column_params',
  rate_type_match_column_params: 'output_match_column_params'
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
// `disabled_values` list in output-column-param.mjs.
export const NON_PLAY_LEVEL_PERIODS = new Set([
  'game',
  'season',
  'team_half',
  'team_quarter'
])

export const is_play_level_period = (period) =>
  period != null && !NON_PLAY_LEVEL_PERIODS.has(period)
