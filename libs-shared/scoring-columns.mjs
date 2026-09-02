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
 *     `is_excluding_quarterback_kneels`.
 *   - the three positional reception columns are columns with no stat; they
 *     override the `receptions` value for one position.
 *   - `is_excluding_quarterback_kneels` is a boolean switch, not a rate.
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

// The two `*_threshold` entries are the only kicking or DST columns with no
// `stat`. They parameterise a rate rather than reporting a value, so a gamelog
// never carries them and they must stay out of `defense_fantasy_stats` and
// therefore out of `all_fantasy_stats`, which gates persisted gamelog columns.
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
    // Stat with no column, exactly like rushing_yards_excluding_kneels above.
    // Scored through the rushing_first_downs value, substituted for it when a
    // format sets touchdown_is_first_down = false.
    stat: 'rushing_first_downs_excluding_touchdowns',
    group: 'base'
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
    // Stat with no column, the receiving twin of
    // rushing_first_downs_excluding_touchdowns above.
    stat: 'receiving_first_downs_excluding_touchdowns',
    group: 'base'
  },
  {
    // Column with no stat, mirroring tight_end_reception above: overrides the
    // receiving_first_downs value for one position. SFB16 pays a tight end 1.5
    // per receiving first down against a 0.5 base.
    column: 'tight_end_receiving_first_downs',
    overrides_stat: 'receiving_first_downs',
    position: 'TE',
    group: 'base',
    section: 'receiving',
    label: 'First Downs (TE)',
    sql_type: 'numeric(2,1)',
    default_value: 0,
    input_type: 'float',
    min: 0,
    max: 2
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
    column: 'is_excluding_quarterback_kneels',
    group: 'base',
    section: 'misc',
    label: 'Exclude QB Kneels',
    sql_type: 'boolean',
    default_value: false,
    input_type: 'boolean'
  },
  {
    // The second boolean switch, structurally identical to the one above. When
    // false, the two *_first_downs stats are substituted for their
    // excluding-touchdowns twins, so a touchdown that also gained a first down
    // scores once rather than twice. TRUE is what the platform has always done.
    column: 'touchdown_is_first_down',
    group: 'base',
    section: 'misc',
    label: 'TD Counts As First Down',
    sql_type: 'boolean',
    default_value: true,
    input_type: 'boolean'
  },
  {
    // A rule LIST, not a rate -- the only registry entry whose value is not a
    // scalar. Each element is { type, stat, threshold, points }; see
    // canonicalize_bonuses below for why array order is normalized on write.
    //
    // No input_type: the settings page has no control for this, and giving it
    // one of the scalar types would render a broken input rather than nothing.
    column: 'bonuses',
    group: 'base',
    section: 'misc',
    label: 'Bonuses',
    sql_type: 'jsonb',
    default_value: []
  },

  // --- kicking ---
  {
    // Never scored, on purpose. This is the total that the five distance bands
    // below partition, so scoring both double-counts every made field goal.
    stat: 'field_goals_made',
    group: 'kicking'
  },
  {
    // A per-yard rate, not a per-kick value. The five bands below partition the
    // same made kicks and are additive with it, so a banded league sets the
    // bands and zeroes this. The 0.1 default is what production has always
    // scored -- see the migration header for the measurement.
    stat: 'field_goal_yards',
    column: 'field_goal_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG Yards',
    sql_type: 'numeric(4,3)',
    default_value: 0.1,
    input_type: 'float'
  },
  {
    stat: 'field_goals_made_0_19_yards',
    column: 'field_goals_made_0_19_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG 0-19',
    sql_type: 'numeric(4,2)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'field_goals_made_20_29_yards',
    column: 'field_goals_made_20_29_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG 20-29',
    sql_type: 'numeric(4,2)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'field_goals_made_30_39_yards',
    column: 'field_goals_made_30_39_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG 30-39',
    sql_type: 'numeric(4,2)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'field_goals_made_40_49_yards',
    column: 'field_goals_made_40_49_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG 40-49',
    sql_type: 'numeric(4,2)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'field_goals_made_50_plus_yards',
    column: 'field_goals_made_50_plus_yards',
    group: 'kicking',
    section: 'kicking',
    label: 'FG 50+',
    sql_type: 'numeric(4,2)',
    default_value: 0,
    input_type: 'float'
  },
  {
    stat: 'extra_points_made',
    column: 'extra_points_made',
    group: 'kicking',
    section: 'kicking',
    label: 'Extra Points',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },

  // --- DST (defense and special teams, one unit) ---
  {
    stat: 'defensive_sacks',
    column: 'defensive_sacks',
    group: 'dst',
    section: 'defense',
    label: 'Sacks',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },
  {
    stat: 'defensive_interceptions',
    column: 'defensive_interceptions',
    group: 'dst',
    section: 'defense',
    label: 'Ints',
    sql_type: 'numeric(4,2)',
    default_value: 2,
    input_type: 'float'
  },
  {
    stat: 'defensive_forced_fumbles',
    column: 'defensive_forced_fumbles',
    group: 'dst',
    section: 'defense',
    label: 'Forced Fumbles',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },
  {
    stat: 'defensive_recovered_fumbles',
    column: 'defensive_recovered_fumbles',
    group: 'dst',
    section: 'defense',
    label: 'Recovered Fumbles',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },
  {
    stat: 'defensive_three_and_outs',
    column: 'defensive_three_and_outs',
    group: 'dst',
    section: 'defense',
    label: 'Three And Outs',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },
  {
    stat: 'defensive_fourth_down_stops',
    column: 'defensive_fourth_down_stops',
    group: 'dst',
    section: 'defense',
    label: 'Fourth Down Stops',
    sql_type: 'numeric(4,2)',
    default_value: 1,
    input_type: 'float'
  },
  {
    // Rate half of a rate/threshold pair: the value is applied per point
    // ALLOWED BEYOND the threshold, replacing the hardcoded
    // `max(points_against - 20, 0) * -0.4` in calculate-points.mjs.
    stat: 'defensive_points_against',
    column: 'defensive_points_against',
    group: 'dst',
    section: 'defense',
    label: 'Points Against',
    sql_type: 'numeric(4,3)',
    default_value: -0.4,
    input_type: 'float'
  },
  {
    // Threshold half of the pair. A count, not a rate, so smallint -- the
    // repo's numeric(2,1) scoring convention cannot hold 300. Carries no
    // `stat`: it is a parameter of the scoring, not a value a gamelog reports,
    // so it must stay out of defense_fantasy_stats and all_fantasy_stats.
    column: 'defensive_points_against_threshold',
    group: 'dst',
    section: 'defense',
    label: 'Points Against Threshold',
    sql_type: 'smallint',
    default_value: 20,
    input_type: 'int'
  },
  {
    stat: 'defensive_yards_against',
    column: 'defensive_yards_against',
    group: 'dst',
    section: 'defense',
    label: 'Yards Against',
    sql_type: 'numeric(5,4)',
    default_value: -0.02,
    input_type: 'float'
  },
  {
    column: 'defensive_yards_against_threshold',
    group: 'dst',
    section: 'defense',
    label: 'Yards Against Threshold',
    sql_type: 'smallint',
    default_value: 300,
    input_type: 'int'
  },
  {
    stat: 'defensive_blocked_kicks',
    column: 'defensive_blocked_kicks',
    group: 'dst',
    section: 'defense',
    label: 'Blocked Kicks',
    sql_type: 'numeric(4,2)',
    default_value: 3,
    input_type: 'float'
  },
  {
    stat: 'defensive_safeties',
    column: 'defensive_safeties',
    group: 'dst',
    section: 'defense',
    label: 'Safeties',
    sql_type: 'numeric(4,2)',
    default_value: 2,
    input_type: 'float'
  },
  {
    stat: 'defensive_two_point_returns',
    column: 'defensive_two_point_returns',
    group: 'dst',
    section: 'defense',
    label: 'Two PT Returns',
    sql_type: 'numeric(4,2)',
    default_value: 2,
    input_type: 'float'
  },
  {
    stat: 'defensive_touchdowns',
    column: 'defensive_touchdowns',
    group: 'dst',
    section: 'defense',
    label: 'Tds',
    sql_type: 'numeric(4,2)',
    default_value: 6,
    input_type: 'float'
  }
]

export const scoring_columns = scoring_registry.filter((entry) => entry.column)

export const scoring_column_names = scoring_columns.map((entry) => entry.column)

// Resolves the value to write for a config column a caller did not supply.
//
// This is load bearing, not a convenience. Every one of the 21 kicking and DST
// columns is NOT NULL, and callers routinely supply a partial config: the
// external-league importer builds `scoring_params` from a platform mapper that
// has no kicking or DST keys at all, and the named format definitions declare
// only the base columns. Mapping an absent key to `null` -- which is what
// find-or-create did before these columns existed -- inserts an explicit NULL
// and fails the constraint, taking live external-league import with it. An
// explicit NULL does NOT fall back to the column DEFAULT, so the schema cannot
// rescue this and the fill has to happen here.
//
// A base column with no registry default still resolves to `null`, preserving
// the previous behaviour: those have no schema default either, so a caller
// omitting one is a real error and should fail loudly rather than be invented.
export const default_value_for_column = (column) => {
  const entry = scoring_columns.find((entry) => entry.column === column)
  return entry && entry.default_value !== undefined ? entry.default_value : null
}

// The four fields of a bonus rule, in the order they sort by. All four
// participate so no two distinct rules can tie and leave the order undefined.
const BONUS_RULE_KEYS = ['type', 'stat', 'threshold', 'points']

// Put a `bonuses` array into canonical form: rules sorted, and each rule's keys
// rebuilt in a fixed order.
//
// This exists because config_digest is what dedups league_scoring_formats, and
// it reads `bonuses::text`. jsonb normalizes object key order and whitespace on
// store, so two equal rule OBJECTS already render identically -- but jsonb
// preserves array ORDER, so [A, B] and [B, A] would digest differently and mint
// two format rows for one rule set, with no error anywhere.
//
// It runs on WRITE rather than inside the digest expression. A generated column
// must be IMMUTABLE and cannot contain a set-returning function, which rules out
// jsonb_array_elements; routing it through a user-defined IMMUTABLE function
// would make a generated column depend on a function whose pg_dump/restore
// ordering is a known hazard.
//
// Unknown keys on a rule are preserved rather than dropped -- a config written
// for a newer engine must not be silently rewritten by an older one -- but they
// sort after the known four so the output stays deterministic.
export const canonicalize_bonuses = (bonuses) => {
  if (!Array.isArray(bonuses)) {
    return []
  }

  const sort_key = (rule) =>
    BONUS_RULE_KEYS.map((key) => String(rule?.[key] ?? '')).join('\x00')

  return [...bonuses]
    .map((rule) => {
      if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
        return rule
      }
      const extra_keys = Object.keys(rule)
        .filter((key) => !BONUS_RULE_KEYS.includes(key))
        .sort()
      return Object.fromEntries(
        [...BONUS_RULE_KEYS, ...extra_keys]
          .filter((key) => rule[key] !== undefined)
          .map((key) => [key, rule[key]])
      )
    })
    .sort((a, b) =>
      sort_key(a) < sort_key(b) ? -1 : sort_key(a) > sort_key(b) ? 1 : 0
    )
}

// The single funnel every writer of a scoring config goes through. Fills absent
// columns from the registry defaults and canonicalizes the one column whose
// value has an ordering degree of freedom.
export const resolve_scoring_config = (config) => {
  const resolved = Object.fromEntries(
    scoring_column_names.map((column) => [
      column,
      config[column] === undefined
        ? default_value_for_column(column)
        : config[column]
    ])
  )
  resolved.bonuses = canonicalize_bonuses(resolved.bonuses)
  return resolved
}

// The `stat` filter runs AFTER the map rather than alongside the group test.
// Narrowing inside a filter over the entries does not carry through to the
// mapped result, so the combined form returned `(string | undefined)[]` -- and
// every consumer that used those names as computed keys
// (`{ ...o, [key]: 0 }`) then failed on a member the filter had already
// excluded. Same output, stated in a shape the checker can follow.
export const stat_names_for_group = (group) =>
  scoring_registry
    .filter((entry) => entry.group === group)
    .map((entry) => entry.stat)
    // Two filters, not one: TypeScript infers a type predicate only from a
    // body that is purely a type test, so folding the emptiness check into the
    // same expression left the result `(string | undefined)[]` again.
    .filter((stat) => typeof stat === 'string')
    .filter((stat) => stat.length > 0)
