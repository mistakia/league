import { NON_PLAY_LEVEL_PERIODS } from './data-views-output-tokens.mjs'

// The `output` column param: how a numeric measure aggregates to a row.
//
// Its value is the canonical object the server consumes directly --
// `{ period, aggregation, threshold }` -- not the flat legacy `per_*` token.
// `rate_type` is still accepted on the request path (shared short URLs are
// immutable and carry it forever) but nothing in the UI authors one: the
// editor writes `output` and the saved-view migrator rewrites persisted state.
//
// Rendering is fully overridden. `component` (attached in
// app/core/data-views-fields/index.js) owns the editor, and `format_value`
// owns the chip label -- both take precedence over the data_type dispatch in
// react-table, which is why this definition declares no data_type. A flat
// SELECT fallback would write a scalar over the object.

const period_option = (value, label) => ({ value, label })

// Periods available to every rate-capable column.
const base_period_options = [
  period_option('game', 'Per Game'),
  period_option('team_play', 'Per Team Play'),
  period_option('team_pass_play', 'Per Team Pass Play'),
  period_option('team_rush_play', 'Per Team Rush Play'),
  period_option('team_drive', 'Per Team Drive'),
  period_option('team_series', 'Per Team Series'),
  period_option('team_half', 'Per Team Half'),
  period_option('team_quarter', 'Per Team Quarter')
]

// Periods denominated by the player's own participation.
const player_period_options = [
  period_option('player_play', 'Per Player Play'),
  period_option('player_route', 'Per Player Route'),
  period_option('player_pass_play', 'Per Player Pass Play'),
  period_option('player_rush_play', 'Per Player Rush Play')
]

// Periods denominated by a specific player action.
const player_action_period_options = [
  period_option('player_rush_attempt', 'Per Player Rush Attempt'),
  period_option('player_pass_attempt', 'Per Player Pass Attempt'),
  period_option('player_target', 'Per Player Target'),
  period_option('player_catchable_target', 'Per Player Catchable Target'),
  period_option('player_deep_target', 'Per Player Deep Target'),
  period_option(
    'player_catchable_deep_target',
    'Per Player Catchable Deep Target'
  ),
  period_option('player_reception', 'Per Player Reception'),
  period_option('player_touch', 'Per Player Touch'),
  period_option('player_opportunity', 'Per Player Opportunity')
]

// `count` counts periods clearing a threshold, so its period is a span of time
// rather than a denominator unit. Only these two are registered as count
// tuples in the server's output-aggregator registry.
export const COUNT_PERIOD_OPTIONS = [
  period_option('game', 'Games'),
  period_option('season', 'Seasons')
]

export const AGGREGATION_OPTIONS = [
  { value: 'rate', label: 'Rate' },
  { value: 'count', label: 'Count' }
]

export const THRESHOLD_OPERATOR_OPTIONS = [
  { value: '>=', label: '≥' },
  { value: '>', label: '>' },
  { value: '<=', label: '≤' },
  { value: '<', label: '<' }
]

const rate_period_label_by_value = new Map(
  [
    ...base_period_options,
    ...player_period_options,
    ...player_action_period_options
  ].map(({ value, label }) => [value, label])
)

// Count labels read as a plural noun ("Games"), rate labels as a denominator
// ("Per Game"); a count chip needs the former even for a period the rate list
// also carries.
const count_period_label_by_value = new Map(
  COUNT_PERIOD_OPTIONS.map(({ value, label }) => [value, label])
)

export const format_output_value = ({ value }) => {
  if (!value || !value.period) return null

  if (value.aggregation === 'count') {
    const period_label =
      count_period_label_by_value.get(value.period) || value.period
    if (!value.threshold) return period_label
    return `${period_label} ${value.threshold.op} ${value.threshold.value}`
  }

  return rate_period_label_by_value.get(value.period) || value.period
}

// The denominator-parameter override panel. Disabled for periods whose
// denominator ignores play-level filters -- overriding them would be a no-op.
const param_override_config = {
  label: 'Denominator Parameters',
  toggle_param: 'output_match_column_params',
  override_param: 'output_column_params',
  disabled_values: [null, ...NON_PLAY_LEVEL_PERIODS],
  overridable_param_filter: {
    exclude_groups: [
      'Weather',
      'Game',
      'Betting Markets',
      'Pace',
      'Play Timeout'
    ],
    exclude_param_names: [
      'year',
      'week',
      'year_offset',
      'week_offset',
      'seas_type',
      'career_year',
      'career_game',
      'output',
      'output_match_column_params',
      'output_column_params'
    ]
  }
}

const base_output_param = {
  label: 'Output',
  default_value: null,
  format_value: format_output_value,
  param_override_config,
  aggregations: AGGREGATION_OPTIONS,
  count_periods: COUNT_PERIOD_OPTIONS
}

export const offensive_output_param = {
  ...base_output_param,
  values: base_period_options
}

export const defensive_player_output_param = {
  ...base_output_param,
  values: [...base_period_options, ...player_period_options]
}

export const offensive_player_output_param = {
  ...base_output_param,
  values: [
    ...base_period_options,
    ...player_period_options,
    ...player_action_period_options
  ]
}
