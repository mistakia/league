/**
 * Scoring registry — the single source for what a league scoring format can
 * score.
 *
 * Before this module the same knowledge was enumerated in four places that had
 * to agree by hand: `base_fantasy_stats` / `kicker_fantasy_stats` /
 * `defense_fantasy_stats` in constants/stats-constants.mjs, `SCORING_COLUMNS`
 * in libs-server/find-or-create-format.mjs, the `league_scoring_formats` unique
 * tuple, and `scoring_field_labels` in constants/league-settings-labels.mjs.
 * Adding a scoring metric meant editing all four and getting no error if you
 * missed one.
 *
 * Pure data. No `#db` import and no SQL, so this is safe in the SPA bundle.
 *
 * Two dimensions, deliberately not the same list:
 *
 *   `stat`   the fantasy stat key a player gamelog carries. Drives
 *            `all_fantasy_stats`, which `format_base_gamelog` uses to filter
 *            which columns are persisted to player_gamelogs -- so an entry
 *            losing its `stat` silently stops that column being written.
 *   `column` the league_scoring_formats column holding the per-league value.
 *
 * Most entries have both. The ones that have only one are the reason a single
 * flat list could never have served both consumers:
 *
 *   - `rushing_yards_excluding_kneels` is a stat with no column; it is scored
 *     through the `rushing_yards` value when a format sets
 *     `exclude_quarterback_kneels`.
 *   - the three positional reception columns are columns with no stat; they
 *     override the `receptions` value for one position.
 *   - `exclude_quarterback_kneels` is a boolean switch, not a rate.
 *   - `field_goals_made` is a stat that is deliberately never scored. It is
 *     the total the five distance bands partition, so giving it a value would
 *     double-count every field goal.
 *
 * ORDER IS LOAD-BEARING for the base group: it reproduces the historical
 * `base_fantasy_stats` order exactly. That order sets the column order of
 * generated player_gamelogs rows and the accumulation order of the floating
 * point sum in calculate-points.mjs. `scoring_column_names` takes whatever
 * order falls out of it, which is safe -- the INSERT column list and its values
 * are built from the same array, and Postgres matches an ON CONFLICT column
 * list by set rather than by order.
 *
 * `min` and `max` are present only on entries that have a settings-page
 * control today. An entry without them is scoreable but not editable in the UI.
 */

// The kicking and DST entries below carry a `stat` but no `column`: their
// values are still hardcoded in calculate-points.mjs. The columns arrive with
// the league_scoring_formats migration, at which point the `if/else` in that
// file collapses into one loop over this registry.
export const scoring_registry = [
  // --- passing ---
  {
    stat: 'passing_attempts',
    column: 'passing_attempts',
    group: 'base',
    section: 'passing',
    label: 'Attempts',
    sql_type: 'numeric(3,2)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    stat: 'passing_completions',
    column: 'passing_completions',
    group: 'base',
    section: 'passing',
    label: 'Completions',
    sql_type: 'numeric(3,2)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    stat: 'passing_yards',
    column: 'passing_yards',
    group: 'base',
    section: 'passing',
    label: 'Yards',
    sql_type: 'numeric(3,2)',
    input_type: 'float',
    min: 0,
    max: 1
  },
  {
    stat: 'passing_interceptions',
    column: 'passing_interceptions',
    group: 'base',
    section: 'passing',
    label: 'Ints',
    sql_type: 'smallint',
    input_type: 'int',
    min: -3,
    max: 0
  },
  {
    stat: 'passing_touchdowns',
    column: 'passing_touchdowns',
    group: 'base',
    section: 'passing',
    label: 'Tds',
    sql_type: 'smallint',
    input_type: 'int',
    min: 0,
    max: 12
  },

  // --- rushing ---
  {
    stat: 'rushing_attempts',
    column: 'rushing_attempts',
    group: 'base',
    section: 'rushing',
    label: 'Attempts',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 1
  },
  {
    stat: 'rushing_yards',
    column: 'rushing_yards',
    group: 'base',
    section: 'rushing',
    label: 'Yards',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    // Stat with no column. Scored at the rushing_yards value, substituted for
    // rushing_yards when the format excludes quarterback kneels.
    stat: 'rushing_yards_excluding_kneels',
    group: 'base'
  },
  {
    stat: 'rushing_touchdowns',
    column: 'rushing_touchdowns',
    group: 'base',
    section: 'rushing',
    label: 'Tds',
    sql_type: 'smallint',
    input_type: 'int',
    min: 0,
    max: 12
  },
  {
    stat: 'rushing_first_downs',
    column: 'rushing_first_downs',
    group: 'base',
    section: 'rushing',
    label: 'First Downs',
    sql_type: 'numeric(2,1)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'fumbles_lost',
    column: 'fumbles_lost',
    group: 'base',
    section: 'rushing',
    label: 'Fumbles',
    sql_type: 'smallint',
    input_type: 'int',
    min: -3,
    max: 0
  },

  // --- receiving ---
  {
    stat: 'targets',
    column: 'targets',
    group: 'base',
    section: 'receiving',
    label: 'Targets',
    sql_type: 'numeric(2,1)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'receptions',
    column: 'receptions',
    group: 'base',
    section: 'receiving',
    label: 'Rec. (Other)',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    // Columns with no stat: each overrides the `receptions` value for one
    // position. A value of exactly 0 currently falls back to `receptions`
    // rather than scoring nothing -- see the characterization spec.
    column: 'running_back_reception',
    overrides_stat: 'receptions',
    position: 'RB',
    group: 'base',
    section: 'receiving',
    label: 'Rec. (RB)',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    column: 'wide_receiver_reception',
    overrides_stat: 'receptions',
    position: 'WR',
    group: 'base',
    section: 'receiving',
    label: 'Rec. (WR)',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    column: 'tight_end_reception',
    overrides_stat: 'receptions',
    position: 'TE',
    group: 'base',
    section: 'receiving',
    label: 'Rec. (TE)',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    stat: 'receiving_yards',
    column: 'receiving_yards',
    group: 'base',
    section: 'receiving',
    label: 'Yards',
    sql_type: 'numeric(2,1)',
    input_type: 'float',
    min: 0,
    max: 2
  },
  {
    stat: 'receiving_first_downs',
    column: 'receiving_first_downs',
    group: 'base',
    section: 'receiving',
    label: 'First Downs',
    sql_type: 'numeric(2,1)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'receiving_touchdowns',
    column: 'receiving_touchdowns',
    group: 'base',
    section: 'receiving',
    label: 'Tds',
    sql_type: 'smallint',
    input_type: 'int',
    min: 0,
    max: 12
  },

  // --- misc ---
  {
    stat: 'two_point_conversions',
    column: 'two_point_conversions',
    group: 'base',
    section: 'misc',
    label: 'Two PT Conv.',
    sql_type: 'smallint',
    input_type: 'int',
    min: 0,
    max: 4
  },
  {
    stat: 'punt_return_touchdowns',
    column: 'punt_return_touchdowns',
    group: 'base',
    section: 'misc',
    label: 'Punt Return Tds',
    sql_type: 'smallint',
    input_type: 'int'
  },
  {
    stat: 'kickoff_return_touchdowns',
    column: 'kickoff_return_touchdowns',
    group: 'base',
    section: 'misc',
    label: 'Kick Return Tds',
    sql_type: 'smallint',
    input_type: 'int'
  },
  {
    stat: 'fumble_return_touchdowns',
    column: 'fumble_return_touchdowns',
    group: 'base',
    section: 'misc',
    label: 'Fumble Return Tds',
    sql_type: 'smallint',
    input_type: 'int'
  },
  {
    // Column with no stat: a switch, not a rate.
    column: 'exclude_quarterback_kneels',
    group: 'base',
    section: 'misc',
    label: 'Exclude QB Kneels',
    sql_type: 'boolean',
    default_value: false,
    input_type: 'boolean'
  },

  // --- kicking ---
  {
    // Never scored, on purpose. This is the total that the five distance bands
    // below partition, so scoring both double-counts every made field goal.
    stat: 'field_goals_made',
    group: 'kicking'
  },
  { stat: 'field_goal_yards', group: 'kicking' },
  { stat: 'field_goals_made_0_19_yards', group: 'kicking' },
  { stat: 'field_goals_made_20_29_yards', group: 'kicking' },
  { stat: 'field_goals_made_30_39_yards', group: 'kicking' },
  { stat: 'field_goals_made_40_49_yards', group: 'kicking' },
  { stat: 'field_goals_made_50_plus_yards', group: 'kicking' },
  { stat: 'extra_points_made', group: 'kicking' },

  // --- DST (defense and special teams, one unit) ---
  { stat: 'defensive_sacks', group: 'dst' },
  { stat: 'defensive_interceptions', group: 'dst' },
  { stat: 'defensive_forced_fumbles', group: 'dst' },
  { stat: 'defensive_recovered_fumbles', group: 'dst' },
  { stat: 'defensive_three_and_outs', group: 'dst' },
  { stat: 'defensive_fourth_down_stops', group: 'dst' },
  { stat: 'defensive_points_against', group: 'dst' },
  { stat: 'defensive_yards_against', group: 'dst' },
  { stat: 'defensive_blocked_kicks', group: 'dst' },
  { stat: 'defensive_safeties', group: 'dst' },
  { stat: 'defensive_two_point_returns', group: 'dst' },
  { stat: 'defensive_touchdowns', group: 'dst' }
]

export const scoring_columns = scoring_registry.filter((entry) => entry.column)

export const scoring_column_names = scoring_columns.map((entry) => entry.column)

export const stat_names_for_group = (group) =>
  scoring_registry
    .filter((entry) => entry.group === group && entry.stat)
    .map((entry) => entry.stat)
