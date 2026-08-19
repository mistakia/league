// Where a measure's facts live, and how a fact row reaches a subject.
//
// `measure_source` conflated two independent questions, which is why the
// period-CTE builder carried a `pid_via` enum whose members mixed them:
// `native` and `gsis_bridge` answer HOW THE SUBJECT ID IS OBTAINED, while
// `native_or_role` and `role_union` answer HOW A FACT ATTRIBUTES TO A SUBJECT.
// Splitting them is what lets a new combination be declared rather than added
// to an enum.
//
// SUBJECT ATTRIBUTION -- how a fact row attributes to a subject:
//
//   direct        the fact row names the subject
//   single_role   the subject is in one of N role columns, coalesced
//   multi_role    one fact attributes to several subjects, union-all
//   cohort_member the fact belongs to a group the subject is a member of
//
// SUBJECT ID LOOKUP -- where the subject id is physically read from:
//
//   column        a column on the fact row
//   gsis_bridge   an inner join to `player` on gsis_it_player_id
//   cohort        a column on the COHORT MEMBERS row, so the source must also
//                 declare a `cohort_expansion`
//
// The registry declares the attribution KIND; the column supplies its
// `role_columns`, because both role kinds are parameterized per column and six
// distinct role sets sit over the one `plays` source.
//
// COHORT EXPANSION is the one primitive here that MULTIPLIES rows: it joins the
// members of the group a fact belongs to, so one team play becomes one row per
// member. That is what puts a team total in scope of a player-grain group, and
// it is what makes a share an ordinary two-accumulator measure rather than a
// column family of its own. Measured on production for 2024 REG, the expansion
// materializes 1,096,224 rows against the 41,152 the unexpanded scan reads --
// 26.6x, which is offensive-roster size per team play and exactly what the shape
// predicts. The cost is NOT new: it is what `create_team_share_stat` emits in
// production today. What the conversion adds is the option of paying it at
// PERIOD grain, which only a `count` or `mean` request reaches.

export const SUBJECT_ATTRIBUTIONS = Object.freeze([
  'direct',
  'single_role',
  'multi_role',
  'cohort_member'
])

export const SUBJECT_ID_LOOKUPS = Object.freeze([
  'column',
  'gsis_bridge',
  'cohort'
])

// Every source here joins `nfl_games` on `esbid`, so every one partitions by
// game and by season. A source at season grain would declare `['season']`.
const GAME_AND_SEASON = Object.freeze(['game', 'season'])

// `table` is the leaf table the facts live in.
// `team_code_column` holds the team code; null means the source cannot serve a
// team subject.
// `subject_id_column` is read only under `subject_id_lookup: 'column'`.
// `extra_join` is applied before the (year, period_key) grouping.
export const FACT_SOURCES = Object.freeze({
  plays: {
    table: 'nfl_plays',
    subject_attribution: 'single_role',
    subject_id_lookup: 'column',
    // nfl_plays names no subject of its own -- every player-subject column over
    // this source supplies `role_columns`. The bare column is the shape the
    // builder falls back to when a column supplies none, which is a declaration
    // error rather than a working path; it is kept so the failure stays the
    // loud 42703 it has always been.
    subject_id_column: 'pid',
    team_code_column: 'possession_nfl_team',
    partition_periods: GAME_AND_SEASON
  },
  gamelogs: {
    table: 'player_gamelogs',
    subject_attribution: 'direct',
    subject_id_lookup: 'column',
    subject_id_column: 'pid',
    team_code_column: 'nfl_team',
    partition_periods: GAME_AND_SEASON
  },
  snaps: {
    table: 'nfl_snaps',
    subject_attribution: 'direct',
    subject_id_lookup: 'gsis_bridge',
    subject_id_column: null,
    team_code_column: null,
    partition_periods: GAME_AND_SEASON
  },
  plays_receiver: {
    table: 'nfl_plays_receiver',
    subject_attribution: 'direct',
    subject_id_lookup: 'gsis_bridge',
    subject_id_column: null,
    team_code_column: null,
    partition_periods: GAME_AND_SEASON,
    // Brings in `nfl_plays` for the `play_type='PASS'` predicate parity with
    // the legacy per_player_route denominator CTE.
    extra_join: (query) => {
      query.join('nfl_plays', function () {
        this.on('nfl_plays_receiver.esbid', '=', 'nfl_plays.esbid').andOn(
          'nfl_plays_receiver.play_id',
          '=',
          'nfl_plays.play_id'
        )
      })
    }
  },
  // One fact row credits several subjects at once -- a play credits the
  // quarterback AND the receiver, which a coalesced role list would drop one of
  // -- so each role contributes a UNION ALL arm rather than a COALESCE operand.
  plays_role_union: {
    table: 'nfl_plays',
    subject_attribution: 'multi_role',
    subject_id_lookup: 'column',
    subject_id_column: 'pid',
    team_code_column: null,
    partition_periods: GAME_AND_SEASON
  },
  // A share: every offensive play of a team attributes to every player who
  // appeared in that game for that team, so a measure can put the subject's own
  // events over the team's in one scan. The denominator is therefore team plays
  // in GAMES THE PLAYER APPEARED IN, not the team's whole season -- that is the
  // standard definition and what ships today, and per-period evaluation inherits
  // it unchanged.
  //
  // `team_code_column` is null because a share is a player-versus-team fraction:
  // grouping it by team would put the team on both sides of its own division.
  plays_cohort: {
    table: 'nfl_plays',
    subject_attribution: 'cohort_member',
    subject_id_lookup: 'cohort',
    subject_id_column: null,
    team_code_column: null,
    partition_periods: GAME_AND_SEASON,
    cohort_expansion: {
      table: 'player_gamelogs',
      alias: 'pg',
      subject_id_column: 'pid',
      join: (query) => {
        query.join('player_gamelogs as pg', function () {
          this.on('nfl_plays.esbid', '=', 'pg.esbid').andOn(
            'nfl_plays.offense_nfl_team',
            '=',
            'pg.nfl_team'
          )
        })
      }
    }
  }
})

// Fails at module load rather than emitting wrong SQL at query time. Exported
// per ENTRY so the rules can be exercised against a declaration that is not in
// the registry -- a spec cannot otherwise reach them, since the only way to run
// them is to ship a broken source.
export const validate_fact_source = (name, source) => {
  const attributions = new Set(SUBJECT_ATTRIBUTIONS)
  const lookups = new Set(SUBJECT_ID_LOOKUPS)
  if (typeof source.table !== 'string' || source.table.length === 0) {
    throw new Error(`fact source: ${name} requires a non-empty table`)
  }
  if (!attributions.has(source.subject_attribution)) {
    throw new Error(
      `fact source: ${name} has unknown subject_attribution '${source.subject_attribution}' (expected ${SUBJECT_ATTRIBUTIONS.join(' | ')})`
    )
  }
  if (!lookups.has(source.subject_id_lookup)) {
    throw new Error(
      `fact source: ${name} has unknown subject_id_lookup '${source.subject_id_lookup}' (expected ${SUBJECT_ID_LOOKUPS.join(' | ')})`
    )
  }
  if (
    source.subject_id_lookup === 'column' &&
    (typeof source.subject_id_column !== 'string' ||
      source.subject_id_column.length === 0)
  ) {
    throw new Error(
      `fact source: ${name} looks the subject id up on a column and must name one`
    )
  }
  // A cohort source is exactly the pairing of the two: the attribution says a
  // fact reaches the subject through a group, and the expansion is the only
  // thing that can name the group's members. Either half alone emits a scan
  // that silently attributes to nobody, so both throw at module load.
  const declares_cohort =
    source.subject_attribution === 'cohort_member' ||
    source.subject_id_lookup === 'cohort'
  if (declares_cohort) {
    if (source.subject_attribution !== 'cohort_member') {
      throw new Error(
        `fact source: ${name} looks the subject id up on a cohort but does not attribute through one`
      )
    }
    if (source.subject_id_lookup !== 'cohort') {
      throw new Error(
        `fact source: ${name} attributes through a cohort but reads its subject id from '${source.subject_id_lookup}'`
      )
    }
    const expansion = source.cohort_expansion
    if (!expansion || typeof expansion !== 'object') {
      throw new Error(
        `fact source: ${name} attributes through a cohort and must declare a cohort_expansion`
      )
    }
    for (const field of ['table', 'alias', 'subject_id_column']) {
      if (
        typeof expansion[field] !== 'string' ||
        expansion[field].length === 0
      ) {
        throw new Error(
          `fact source: ${name} cohort_expansion requires a non-empty ${field}`
        )
      }
    }
    if (typeof expansion.join !== 'function') {
      throw new Error(
        `fact source: ${name} cohort_expansion requires a join function`
      )
    }
  }
  if (
    !Array.isArray(source.partition_periods) ||
    source.partition_periods.length === 0
  ) {
    throw new Error(
      `fact source: ${name} requires at least one partition period`
    )
  }
}

for (const [name, source] of Object.entries(FACT_SOURCES)) {
  validate_fact_source(name, source)
}

// Back-compat: undefined / unknown falls through to gamelogs, preserving the
// legacy `measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'`
// semantic that predates the registry.
export const resolve_fact_source = (measure_source) => {
  if (measure_source && FACT_SOURCES[measure_source]) {
    return FACT_SOURCES[measure_source]
  }
  return FACT_SOURCES.gamelogs
}

// The subject-id expression a single-arm scan groups by, plus whether reaching
// it needs the `player` join. `role_columns` is the column's own declaration
// and is meaningful only for the role attributions.
export const subject_id_expression = ({ fact_source, role_columns }) => {
  if (fact_source.subject_id_lookup === 'gsis_bridge') {
    return { expression: 'player.pid', requires_player_join: true }
  }

  // The cohort members row carries the subject, not the fact row -- the fact row
  // names a team play and has no member on it at all.
  if (fact_source.subject_id_lookup === 'cohort') {
    const { alias, subject_id_column } = fact_source.cohort_expansion
    return {
      expression: `${alias}.${subject_id_column}`,
      requires_player_join: false
    }
  }

  const bare = `${fact_source.table}.${fact_source.subject_id_column}`

  if (fact_source.subject_attribution !== 'single_role') {
    return { expression: bare, requires_player_join: false }
  }

  if (!role_columns || !role_columns.length) {
    return { expression: bare, requires_player_join: false }
  }
  if (role_columns.length === 1) {
    return {
      expression: `${fact_source.table}.${role_columns[0]}`,
      requires_player_join: false
    }
  }
  return {
    expression: `COALESCE(${role_columns
      .map((column) => `${fact_source.table}.${column}`)
      .join(', ')})`,
    requires_player_join: false
  }
}
