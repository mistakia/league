// Sweep the nfl_plays columns the Sportradar importer writes for CROSS-SEASON
// MEANING DRIFT: a column whose name, type and population rate all stay healthy
// while the thing it holds changes.
//
// `drive_yards` is the specimen and it is why this is hard to see. It is populated
// at 88% in 2024 and 89% in 2025, so every coverage check passes it; its type never
// moved; its mean shifts by three yards, which is noise. What changed is that a
// deliberate vendor-precedence switch made Sportradar the writer, and Sportradar's
// figure does not mean what the column meant.
//
// THE WHOLE DIFFICULTY IS TELLING DRIFT FROM A COLUMN THAT DID NOT EXIST BEFORE.
// A sweep that flags every 2025-only column is useless -- there are many, and the
// plays-view rebuild just shipped a batch of them. So eligibility is the first gate:
// a season counts as a comparator only if the column is populated there at a decent
// share of its OWN best season, and a column is swept only if two seasons clear
// that bar. A column that arrived in 2025 has one comparable season and is reported
// as UNCOMPARABLE, which is a different answer from clean and the report says so.
// The bar is RELATIVE rather than absolute because an absolute one cannot tell a
// column that did not exist from a rare-event column that is legitimately null on
// 95% of plays -- under an absolute bar every penalty column read as uncomparable.
//
// The signal is a SATURATED BOUND BREAK, not a distribution shift and not a new
// extreme. Season maxima wander for rule changes, weather and schedule, so "2023
// scored 70 where 2022 topped out at 62" is football. What is evidence is a value
// past a bound the column hit in nearly every season and never crossed -- a ceiling
// the meaning imposes rather than a sample maximum. `drive_yards` reads exactly 99
// in all 26 other comparable seasons and 119 in 2025. Without the saturation
// requirement the same sweep also reports home_score, rush_yards and yards_to_go,
// and the real finding is one line among forty.
//
// Its categorical twin is a value absent from every other comparable season, and it
// applies only below a cardinality bound: `drive_top` is a clock string and
// `yard_line_end` is a team-and-yardage pair, so every season holds values no other
// season does and a novel-value test reports on all 27 of them forever.
//
// Measured PER SEASON throughout. Pooling is what made five 2025-only columns read
// as weakly-populated multi-season ones during the plays-view work.

import db from '#db'
import { is_main } from '#libs-server'
import { resolve_field_authority } from './audit-sportradar-field-authority.mjs'

const FIRST_SEASON = 2000

// Below this a season is not a comparator. It is deliberately low: the question is
// whether the column EXISTED as a populated column, not whether it was complete.
const MIN_RELATIVE_POPULATION = 0.2

// Two comparable seasons is the minimum that can distinguish drift from arrival.
const MIN_COMPARABLE_SEASONS = 2

// A bound is evidence only when the column SATURATES it. Below this share the
// extremum is a sample maximum that wanders year to year, and exceeding it is
// football rather than a meaning change.
const MIN_BOUND_SATURATION = 0.8

// Above this many distinct values a column is not a category set. `drive_top` is a
// clock string and `yard_line_end` is a team-and-yardage pair, so every season
// carries values no other season happens to hold and a novel-value test reports on
// all 27 of them forever. Cardinality is what separates an enum from free text.
const MAX_CATEGORY_CARDINALITY = 32

const NUMERIC_TYPES = new Set([
  'smallint',
  'integer',
  'bigint',
  'numeric',
  'real',
  'double precision'
])

// A column whose values are identities or free text has no range and no category
// set, so neither signal applies to it. Say so rather than sweeping it and
// reporting nothing, which reads identically to sweeping it and finding nothing.
const is_identity_column = (column) =>
  /(_pid|_gsis|_gsis_player_id|_nfl_team|_sportradar_player_id)$/.test(column)

const load_column_types = async (columns) => {
  const rows = await db('information_schema.columns')
    .select('column_name', 'data_type')
    .where({ table_name: 'nfl_plays' })
    .whereIn('column_name', columns)
  return new Map(rows.map((row) => [row.column_name, row.data_type]))
}

const measure = async (subjects) => {
  const selects = ['season_year', 'count(*) AS row_count']
  for (const [index, subject] of subjects.entries()) {
    const column = `"${subject.column}"`
    selects.push(`count(${column}) AS s${index}_non_null`)
    if (subject.kind === 'numeric') {
      selects.push(`min(${column}) AS s${index}_min`)
      selects.push(`max(${column}) AS s${index}_max`)
      selects.push(`avg(${column}) AS s${index}_mean`)
    } else if (subject.kind === 'boolean') {
      selects.push(
        `count(*) FILTER (WHERE ${column} IS TRUE) AS s${index}_true_count`
      )
    } else {
      selects.push(`count(DISTINCT ${column}) AS s${index}_distinct`)
    }
  }

  const result = await db.raw(
    `SELECT ${selects.join(', ')} FROM nfl_plays WHERE season_year >= ? GROUP BY season_year ORDER BY season_year`,
    [FIRST_SEASON]
  )
  return result.rows
}

// A range break on a numeric column and a new category on a categorical one are the
// same claim -- the column produced something its previous meaning could not -- so
// the categorical half needs the actual value sets, which the aggregate pass cannot
// carry. Only low-cardinality columns get it; a free-text column has no categories.
const load_category_sets = async (subjects) => {
  const sets = new Map()
  for (const subject of subjects) {
    const rows = await db.raw(
      `SELECT season_year, "${subject.column}"::text AS value, count(*) AS n
       FROM nfl_plays
       WHERE season_year >= ? AND "${subject.column}" IS NOT NULL
       GROUP BY 1, 2`,
      [FIRST_SEASON]
    )
    const by_season = new Map()
    for (const row of rows.rows) {
      if (!by_season.has(row.season_year))
        by_season.set(row.season_year, new Map())
      by_season.get(row.season_year).set(row.value, Number(row.n))
    }
    sets.set(subject.column, by_season)
  }
  return sets
}

const run_negative_controls = async ({ findings, comparable_by_column }) => {
  // Must-report: `drive_yards` breaks a bound it saturated for 26 seasons, so the
  // sweep must name it. Driven off production data through the same aggregate path
  // the sweep uses rather than off a fixture, because a fixture would prove the
  // comparison arithmetic and not that the query reaches the rows.
  const drive_yards_finding = findings.find(
    (finding) =>
      finding.column === 'drive_yards' && finding.season_year === 2025
  )

  // Decoy: ARRIVAL must never read as drift. This is the property the eligibility
  // gate exists for and the one a sweep matching novelty would fail, so assert it
  // over the real output -- no finding may name a column's FIRST populated season,
  // where there is by construction nothing earlier to have drifted from.
  const arrival_findings = findings.filter((finding) => {
    const seasons = comparable_by_column.get(finding.column) || []
    return finding.season_year === Math.min(...seasons)
  })

  console.error('NEGATIVE CONTROL')
  console.error(
    `  [${drive_yards_finding ? 'WENT RED' : 'STAYED GREEN'}] must-report: drive_yards 2025 -- ${drive_yards_finding ? drive_yards_finding.detail : 'NOT REPORTED'}`
  )
  console.error(
    `  [${arrival_findings.length === 0 ? 'STAYED GREEN' : 'WENT RED'}] decoy: ${arrival_findings.length} finding(s) name a column's first populated season, where arrival would be reported as drift${
      arrival_findings.length
        ? `: ${arrival_findings.map((finding) => `${finding.column} ${finding.season_year}`).join(', ')}`
        : ''
    }`
  )
  console.error('')

  return Boolean(drive_yards_finding) && arrival_findings.length === 0
}

const main = async () => {
  // Subject set is what the importer WRITES, not what carries no authority ruling.
  // The second set is empty as of the 2026-09-05 ruling and would make this sweep
  // vacuous; the first is a fact about the code and is what decides which columns a
  // Sportradar run can change the meaning of.
  const { written_columns } = await resolve_field_authority()
  const types = await load_column_types(written_columns)

  const subjects = []
  const out_of_scope = []
  for (const column of written_columns) {
    const data_type = types.get(column)
    if (!data_type) {
      out_of_scope.push({ column, reason: 'not an nfl_plays column' })
    } else if (is_identity_column(column)) {
      out_of_scope.push({
        column,
        reason: 'identity or team reference -- no range and no category set'
      })
    } else if (NUMERIC_TYPES.has(data_type)) {
      subjects.push({ column, kind: 'numeric' })
    } else if (data_type === 'boolean') {
      subjects.push({ column, kind: 'boolean' })
    } else if (
      data_type === 'USER-DEFINED' ||
      data_type === 'character varying' ||
      data_type === 'text'
    ) {
      subjects.push({ column, kind: 'categorical' })
    } else {
      out_of_scope.push({ column, reason: `unswept type ${data_type}` })
    }
  }

  const rows = await measure(subjects)

  // Cardinality is read off the aggregate pass rather than guessed from the type,
  // and it decides which categorical columns are category sets at all. Doing it
  // here also keeps the value-set queries -- one GROUP BY per column over every
  // partition -- off the free-text columns, where they are both expensive and
  // meaningless.
  const categorical = []
  for (const [index, subject] of subjects.entries()) {
    if (subject.kind !== 'categorical') continue
    const peak_distinct = Math.max(
      ...rows.map((row) => Number(row[`s${index}_distinct`] || 0))
    )
    if (peak_distinct > MAX_CATEGORY_CARDINALITY) {
      subject.kind = 'high_cardinality'
      out_of_scope.push({
        column: subject.column,
        reason: `free text, not a category set (${peak_distinct} distinct values in a season)`
      })
    } else {
      categorical.push(subject)
    }
  }
  const category_sets = await load_category_sets(categorical)

  const findings = []
  const uncomparable = []
  const clean = []
  const comparable_by_column = new Map()

  for (const [index, subject] of subjects.entries()) {
    const seasons = rows
      .map((row) => ({
        season_year: row.season_year,
        row_count: Number(row.row_count),
        non_null: Number(row[`s${index}_non_null`]),
        min:
          row[`s${index}_min`] === null ? null : Number(row[`s${index}_min`]),
        max:
          row[`s${index}_max`] === null ? null : Number(row[`s${index}_max`]),
        mean:
          row[`s${index}_mean`] === null ? null : Number(row[`s${index}_mean`]),
        true_count: Number(row[`s${index}_true_count`] || 0),
        distinct: Number(row[`s${index}_distinct`] || 0)
      }))
      .map((season) => ({
        ...season,
        population: season.row_count ? season.non_null / season.row_count : 0
      }))

    // Eligibility is RELATIVE to the column's own best season, not an absolute rate.
    // An absolute bar conflates two different things: a column that did not exist,
    // and a rare-event column that is legitimately null on 95% of plays. Under an
    // absolute 0.2 every penalty column reported as uncomparable, which is a wrong
    // answer rather than a cautious one. Relative to its own peak, a rare-event
    // column is comparable in every season it was collected and a 2025-only column
    // still has exactly one.
    const peak_population = Math.max(
      ...seasons.map((season) => season.population)
    )
    const comparable = seasons.filter(
      (season) =>
        season.non_null > 0 &&
        season.population >= MIN_RELATIVE_POPULATION * peak_population
    )

    if (subject.kind === 'high_cardinality') continue

    comparable_by_column.set(
      subject.column,
      comparable.map((season) => season.season_year)
    )

    if (comparable.length < MIN_COMPARABLE_SEASONS) {
      uncomparable.push({
        column: subject.column,
        comparable_seasons: comparable.map((season) => season.season_year)
      })
      continue
    }

    // A column's FIRST comparable season has nothing earlier to have drifted from,
    // so whatever it holds is arrival rather than drift. Without this the sweep
    // reports the window's own opening season on every column whose vocabulary
    // predates it, and reports a 2025-arrival column as 2025 drift -- which is the
    // exact confusion the eligibility gate exists to prevent, arriving one level
    // further in. The decoy control caught this; it was not caught by review.
    const first_comparable_season = Math.min(
      ...comparable.map((season) => season.season_year)
    )

    let flagged = false
    for (const season of comparable) {
      if (season.season_year === first_comparable_season) continue
      const others = comparable.filter(
        (other) => other.season_year !== season.season_year
      )
      if (!others.length) continue

      if (subject.kind === 'numeric') {
        // A new EXTREME is not drift. Season maxima wander for rule changes,
        // weather and schedule, so "2023 scored 70 where 2022 topped out at 62" is
        // football. What is evidence is breaking a SATURATED bound -- a value the
        // column hit in almost every season and never passed, which is a ceiling
        // the meaning imposes rather than a sample maximum. `drive_yards` reads
        // exactly 99 in all 26 other seasons and 119 in 2025; `home_score` reads a
        // different maximum nearly every year. Without this the sweep reports both
        // and the real finding is one line among forty.
        const break_finding = (bound, observed, prior_values) => {
          const counts = new Map()
          for (const value of prior_values) {
            counts.set(value, (counts.get(value) || 0) + 1)
          }
          const [modal_value, modal_count] = [...counts.entries()].sort(
            (a, b) => b[1] - a[1]
          )[0]
          const saturation = modal_count / prior_values.length
          if (saturation < MIN_BOUND_SATURATION) return null
          const broken =
            bound === 'max' ? observed > modal_value : observed < modal_value
          if (!broken) return null
          return (
            `${bound} of ${observed} against a saturated ${bound} of ${modal_value} ` +
            `held in ${modal_count} of ${prior_values.length} other comparable seasons`
          )
        }

        const detail =
          break_finding(
            'max',
            season.max,
            others.map((other) => other.max)
          ) ||
          break_finding(
            'min',
            season.min,
            others.map((other) => other.min)
          )
        if (detail) {
          findings.push({
            column: subject.column,
            season_year: season.season_year,
            signal: 'bound break',
            detail
          })
          flagged = true
        }
      } else if (subject.kind === 'categorical') {
        const by_season = category_sets.get(subject.column)
        const own = by_season?.get(season.season_year) || new Map()
        const prior = new Set(
          others.flatMap((other) => [
            ...(by_season?.get(other.season_year)?.keys() || [])
          ])
        )
        const novel = [...own.keys()].filter((value) => !prior.has(value))
        if (novel.length) {
          findings.push({
            column: subject.column,
            season_year: season.season_year,
            signal: 'new category',
            detail: `values absent from all ${others.length} other comparable seasons: ${novel
              .map((value) => `${value} (${own.get(value)} rows)`)
              .join(', ')}`
          })
          flagged = true
        }
      }
    }

    if (!flagged) clean.push(subject.column)
  }

  console.log('=== Sportradar written-column meaning-drift sweep ===\n')
  console.log(`Sportradar-written columns:      ${written_columns.length}`)
  console.log(
    `  swept:                         ${subjects.filter((s) => s.kind !== 'high_cardinality').length}`
  )
  console.log(`  out of scope:                  ${out_of_scope.length}`)
  console.log(
    `  uncomparable (too few populated seasons): ${uncomparable.length}`
  )
  console.log(`  swept and clean:               ${clean.length}`)
  console.log(
    `population bar: ${MIN_RELATIVE_POPULATION} of the column own peak season, comparable seasons needed: ${MIN_COMPARABLE_SEASONS}, bound saturation: ${MIN_BOUND_SATURATION}, from ${FIRST_SEASON}\n`
  )

  console.log('--- DRIFT: a value the column could not previously produce ---')
  if (findings.length) {
    for (const finding of findings.sort(
      (a, b) =>
        a.column.localeCompare(b.column) || a.season_year - b.season_year
    )) {
      console.log(
        `  ${finding.season_year}  ${finding.column} [${finding.signal}]: ${finding.detail}`
      )
    }
  } else {
    console.log('  (none)')
  }
  console.log('')

  // Not a finding and not a pass. A column with one populated season cannot be
  // compared against anything, and reporting it as clean is the failure this sweep
  // exists to avoid in the other direction.
  console.log(
    '--- UNCOMPARABLE: too few populated seasons to tell drift from arrival ---'
  )
  if (uncomparable.length) {
    for (const item of uncomparable) {
      console.log(
        `  ${item.column}: populated in ${item.comparable_seasons.length ? item.comparable_seasons.join(', ') : 'no season'}`
      )
    }
  } else {
    console.log('  (none)')
  }
  console.log('')

  console.log('--- OUT OF SCOPE ---')
  for (const item of out_of_scope) {
    console.log(`  ${item.column}: ${item.reason}`)
  }
  console.log('')

  const controls_fired = await run_negative_controls({
    findings,
    comparable_by_column
  })

  let exit_code = 0
  if (!controls_fired) {
    console.log(
      'CONTROL STAYED GREEN: this sweep cannot report and its findings mean nothing.'
    )
    exit_code = 1
  }
  const accounted = new Set([
    ...subjects
      .filter((subject) => subject.kind !== 'high_cardinality')
      .map((subject) => subject.column),
    ...out_of_scope.map((item) => item.column)
  ])
  if (accounted.size !== written_columns.length) {
    console.log(
      'COVERAGE GAP: a written column was neither swept nor excluded.'
    )
    exit_code = 1
  }

  await db.destroy()
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}
