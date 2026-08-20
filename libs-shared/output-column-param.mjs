// @ts-check
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

/**
 * @param {string} value
 * @param {string} label
 * @returns {{ value: string, label: string }}
 */
/**
 * The persisted shape of an output param, as saved views carry it.
 *
 * `threshold` is a nested `{ op, value }` object rather than two flat sibling
 * keys, which is worth naming: this value is PERSISTED in `table_state`, so the
 * nesting is part of a saved view's on-disk format and a reader that flattens
 * it silently matches nothing.
 *
 * @typedef {object} OutputParamValue
 * @property {string} [period]
 * @property {string} [aggregation]
 * @property {{ op: string, value: number }} [threshold]
 */

/**
 * @param {string} value
 * @param {string} label
 * @returns {{ value: string, label: string }}
 */
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

// The PARTITION vocabulary: a period here is a span of time, not a denominator
// unit, which is what makes `count of games clearing a threshold` and `mean per
// game` askable and `mean per team play` not. Both per-period aggregations are
// registered over exactly this set on the server.
export const COUNT_PERIOD_OPTIONS = [
  period_option('game', 'Games'),
  period_option('season', 'Seasons')
]

// The same two periods, labelled for a MEAN rather than a count: a count reads
// as a plural noun ("Games"), a mean as an average over one ("Average Per
// Game"). Deliberately distinct from the rate labels, which read as a bare
// denominator ("Per Game") -- a rate divides by games PLAYED and a mean by the
// games carrying measure rows, and 366 of 482 players disagree between them on
// 2023 REG receiving yards, so labelling both "Per Game" would put two
// different numbers under one name.
export const MEAN_PERIOD_OPTIONS = [
  period_option('game', 'Average Per Game'),
  period_option('season', 'Average Per Season')
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

const mean_period_label_by_value = new Map(
  MEAN_PERIOD_OPTIONS.map(({ value, label }) => [value, label])
)

// The chip renders the same glyph the operator dropdown offers, so a threshold
// reads identically wherever it appears.
const threshold_operator_label_by_value = new Map(
  THRESHOLD_OPERATOR_OPTIONS.map(({ value, label }) => [value, label])
)

/**
 * @param {{ value?: OutputParamValue | null }} params
 * @returns {string|null}
 */
export const format_output_value = ({ value }) => {
  if (!value || !value.period) return null

  if (value.aggregation === 'mean') {
    return mean_period_label_by_value.get(value.period) || value.period
  }

  if (value.aggregation === 'count') {
    const period_label =
      count_period_label_by_value.get(value.period) || value.period
    if (!value.threshold) return period_label
    const operator_label =
      threshold_operator_label_by_value.get(value.threshold.op) ||
      value.threshold.op
    return `${period_label} ${operator_label} ${value.threshold.value}`
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
  /** @type {Record<string, any> | null} */
  default_value: null,
  format_value: format_output_value,
  param_override_config,
  count_periods: COUNT_PERIOD_OPTIONS,
  mean_periods: MEAN_PERIOD_OPTIONS
}

export const offensive_output_param = {
  ...base_output_param,
  values: base_period_options
}

// A defender runs no ROUTES, so the participation list a defensive column
// offers is the receiver one minus `player_route`. The server's defensive
// factory has always excluded it; the client offered it anyway, and since
// dispatch does not check a request against the advertised set, picking it
// divided tackles by receiver routes and answered. Found by the client/server
// capability parity spec on its first run.
const defensive_player_period_options = player_period_options.filter(
  ({ value }) => value !== 'player_route'
)

export const defensive_player_output_param = {
  ...base_output_param,
  values: [...base_period_options, ...defensive_player_period_options]
}

export const offensive_player_output_param = {
  ...base_output_param,
  values: [
    ...base_period_options,
    ...player_period_options,
    ...player_action_period_options
  ]
}
