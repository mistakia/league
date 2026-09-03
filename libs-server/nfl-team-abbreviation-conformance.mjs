/*
  The season-aware completeness oracle for the canonical team-abbreviation
  convention: for every stored NFL team abbreviation, does the token the row
  carries equal the CURRENT abbreviation of the franchise it named in that
  row's season?

  ## Why a token census cannot answer this

  The obvious check -- collect the distinct tokens in a team column and require
  them to be a subset of the canonical 32 -- is wrong, and it is wrong in the
  direction that looks like success. Two era tokens are THEMSELVES canonical
  abbreviations belonging to a later, different franchise:

    BAL   Colts 1953-1983, then Ravens 1996-
    HOU   Oilers 1960-1996, then Texans 2002-

  A 1975 Colts row stores `BAL`. `BAL` is in the canonical 32, so a token census
  reads that row as clean while it names the wrong franchise -- and there are
  633 such slots in nfl_games alone. The season is the only thing that separates
  them, so the oracle has to ask the SEASON-FIRST question, which is exactly
  what resolve_canonical_nfl_team answers.

  test/db.checks-nfl-team-abbreviation-conformance.spec.mjs pins this by seeding
  an unconformed 1975 `BAL` Colts row and requiring BOTH readings: this oracle
  reports it, and the naive token census does not.

  ## Why the predicate is SQL rather than the JS resolver

  resolve_canonical_nfl_team is the contract, but the population is 5.7M
  nfl_play_stats rows and 1.4M nfl_plays rows, so it cannot be called per row.
  The SQL below is GENERATED from nfl_team_franchise_eras rather than
  hand-transcribed beside it, so the two cannot drift: adding a franchise era to
  that module changes this predicate in the same edit. The lookup ORDER is
  preserved as the load-bearing part -- a range match is consulted before the
  canonical-identity fallback, and inverting the two silently no-ops every
  collision slot.

  A token with no range match and no membership in the canonical or
  non-franchise sets is a VIOLATION here, which is this predicate's form of the
  resolver's `throw`: an unmodelled token must be loud rather than passed
  through.

  ## What this cannot grade, and why it is reported rather than skipped

  nfl_play_stats carries no season column, so its rows are dated by joining
  nfl_games on esbid. 85,332 rows holding a non-null nfl_team have no matching
  nfl_games row (measured 2026-09-02) and therefore have no season at all. They
  are emitted as an explicit un-gradeable row with a zero denominator rather
  than dropped by the join, because a population that silently leaves the scan
  is the "no problems found" shape that means "I found nothing to check". Any
  conform driven by the same esbid join will likewise not reach them.
*/

import db from '#db'

import {
  nfl_team_franchise_eras,
  canonical_nfl_teams,
  non_franchise_nfl_teams
} from '#libs-shared/nfl-team-franchise-eras.mjs'

const sql_string = (value) => `'${String(value).replace(/'/g, "''")}'`

const sql_year = (value) => (value === null ? 'null::int' : String(value))

// The franchise-era table as a SQL VALUES list, generated from the module that
// owns it. Hand-copying it here is the drift this generation exists to prevent.
const era_values = nfl_team_franchise_eras
  .map(
    (era) =>
      `(${sql_string(era.era_nfl_team)}, ${era.start_year}, ${sql_year(
        era.end_year
      )}, ${sql_string(era.canonical_nfl_team)})`
  )
  .join(', ')

// Canonical and non-franchise tokens share one list because they share one
// role in the predicate: a token with NO era range for the row's season
// conforms if and only if it is one of these. Keeping them separate here would
// imply a distinction the predicate does not make.
const known_values = [...canonical_nfl_teams, ...non_franchise_nfl_teams]
  .map((nfl_team) => `(${sql_string(nfl_team)})`)
  .join(', ')

const reference_ctes = `
  era (era_nfl_team, start_year, end_year, canonical_nfl_team) as (
    values ${era_values}
  ),
  known (nfl_team) as (
    values ${known_values}
  )
`

/*
  The conformance predicate, over a `slots` CTE exposing `season_year` and `t`.

  Reads exactly as resolve_canonical_nfl_team's documented order: when a
  (token, season) range exists, the row conforms only if that range's canonical
  token IS the stored token; otherwise the token must be canonical or
  non-franchise. Anything else is a violation.
*/
const conforms_predicate = `
  case
    /*
      An UNDATABLE row is a violation, never a pass. Without this arm a NULL
      season makes both range comparisons NULL, so neither EXISTS is true and
      control reaches the membership arm below -- where BAL and HOU are
      canonical and a Colts or Oilers row grades CLEAN. That is the exact
      collision this check exists to catch, arriving through the one column in
      scope that is nullable (nfl_games.season_year), and it is inherited by
      every nfl_play_stats row joining such a game.

      Reported as a violation rather than as un-gradeable because it is loud in
      the direction that matters: nothing can say whether the row conforms, and
      a check that cannot tell must not answer yes. Zero such rows exist today.
    */
    when s.season_year is null then false
    when exists (
      select 1 from era e
      where e.era_nfl_team = s.t
        and s.season_year >= e.start_year
        and (e.end_year is null or s.season_year <= e.end_year)
    )
    then exists (
      select 1 from era e
      where e.era_nfl_team = s.t
        and s.season_year >= e.start_year
        and (e.end_year is null or s.season_year <= e.end_year)
        and e.canonical_nfl_team = s.t
    )
    else exists (select 1 from known k where k.nfl_team = s.t)
  end
`

/*
  Every stored NFL team abbreviation this convention governs, with the
  expression that dates it.

  Scope is DECLARED here rather than discovered from information_schema, and
  that is deliberate: a name-shaped sweep for `%team%` would pull in the
  changelog tables, which are audit history of what a value WAS and are correct
  to hold era tokens, and it would miss nfl_plays.yard_line_side, which holds a
  team abbreviation despite its name. Both errors are silent.

  nfl_plays.penalty_team, .timeout_team and .fumble_recovered_team are included
  even though they carry zero violations today. A clean column costs one more
  aggregate on a scan already being made, and the class this check exists to
  catch is an importer REINTRODUCING an era token -- which would land in a
  column that is clean right now. fumble_recovered_team holds no non-null value
  at all, so it contributes no gradeable row and says so.
*/
const slot_sources = [
  {
    table_name: 'nfl_games',
    season_expression: 'season_year',
    columns: ['away_nfl_team', 'home_nfl_team'],
    from: 'nfl_games'
  },
  {
    table_name: 'nfl_plays',
    season_expression: 'season_year',
    columns: [
      'possession_nfl_team',
      'offense_nfl_team',
      'defense_nfl_team',
      'yard_line_side',
      'score_team',
      'touchdown_nfl_team',
      'return_nfl_team',
      'penalty_team',
      'timeout_team',
      'fumble_recovered_team'
    ],
    from: 'nfl_plays'
  },
  {
    table_name: 'player_gamelogs',
    season_expression: 'season_year',
    columns: ['nfl_team', 'opponent_nfl_team'],
    from: 'player_gamelogs'
  },
  {
    // No season column on this table; nfl_games supplies it. The rows this join
    // cannot reach are reported separately below rather than dropped.
    table_name: 'nfl_play_stats',
    season_expression: 'g.season_year',
    columns: ['nfl_team'],
    from: 'nfl_play_stats ps join nfl_games g on g.esbid = ps.esbid',
    column_qualifier: 'ps.'
  },
  {
    // A draft is dated by the draft year, which is a genuine calendar year and
    // is the season whose franchise map applies to the team that drafted them.
    table_name: 'player',
    season_expression: 'nfl_draft_year',
    columns: ['draft_team'],
    from: 'player',
    extra_where: 'nfl_draft_year is not null'
  }
]

const build_source_query = (source) => {
  const qualifier = source.column_qualifier || ''

  const slots = source.columns
    .map((column) => {
      const conditions = [`${qualifier}${column} is not null`]
      if (source.extra_where) {
        conditions.push(source.extra_where)
      }

      return `select ${sql_string(column)} as column_name, ${
        source.season_expression
      } as season_year, ${qualifier}${column} as t from ${
        source.from
      } where ${conditions.join(' and ')}`
    })
    .join('\n      union all ')

  return `
    with ${reference_ctes},
    slots as (
      ${slots}
    ),
    graded as (
      select s.column_name, s.season_year, ${conforms_predicate} as conforms
      from slots s
    )
    select
      column_name,
      season_year,
      count(*) as denominator,
      count(*) filter (where not conforms) as numerator
    from graded
    group by column_name, season_year
  `
}

/*
  nfl_play_stats rows whose esbid matches no nfl_games row. They carry a team
  abbreviation and no season, so nothing can decide whether they conform.
*/
const ungradeable_play_stats_query = `
  select count(*) as orphaned
  from nfl_play_stats ps
  left join nfl_games g on g.esbid = ps.esbid
  where ps.nfl_team is not null and g.esbid is null
`

/**
 * Rows for the `nfl-team-abbreviation-conformance` registered check.
 *
 * One row per (table, column, season_year): `denominator` is every slot
 * scanned in that season, `numerator` the count whose token does not equal the
 * franchise's current abbreviation.
 *
 * Issued as one query PER TABLE rather than one union over all of them. The
 * union form measured about 35 seconds against production, which sits over the
 * client statement timeout, while the largest single table is under 25.
 */
export const nfl_team_abbreviation_conformance_rows = async () => {
  const rows = []

  for (const source of slot_sources) {
    const { rows: source_rows } = await db.raw(build_source_query(source))

    for (const row of source_rows) {
      rows.push({
        table_name: source.table_name,
        column_name: row.column_name,
        season_year: row.season_year === null ? null : Number(row.season_year),
        numerator: Number(row.numerator),
        denominator: Number(row.denominator)
      })
    }
  }

  const {
    rows: [orphaned]
  } = await db.raw(ungradeable_play_stats_query)

  // A zero denominator is classified UN-GRADEABLE rather than clean, which is
  // the reporting this population needs: it is neither conforming nor
  // violating, it is undatable.
  rows.push({
    table_name: 'nfl_play_stats',
    column_name: 'nfl_team',
    season_year: null,
    numerator: Number(orphaned.orphaned),
    denominator: 0
  })

  return rows
}

/*
  The NAIVE oracle, exported solely so the spec can demonstrate that it is
  blind. It is the check a reader would write first: are the distinct stored
  tokens a subset of the canonical and non-franchise sets? It reads a 1975 `BAL`
  Colts row as clean, and that contrast is what establishes the season-aware
  form is load-bearing rather than merely more elaborate.

  Nothing else may call this. It is not a check and must never be registered.
*/
export const naive_token_census_violations = async ({ table_name, column }) => {
  const known = [...canonical_nfl_teams, ...non_franchise_nfl_teams]

  const { rows } = await db.raw(
    `select count(*) as violations from ${table_name}
     where ${column} is not null and ${column} <> all (?::text[])`,
    [known]
  )

  return Number(rows[0].violations)
}
