/*
  The pure half of the registered data-check system: a classifier that turns a
  check's rows into a verdict, and the loader for the file that parks a
  suppressed finding.

  Nothing here touches a database, a signal or the filesystem beyond reading the
  parked file, so the whole classification is specced against fixtures through
  the SHIPPED expression rather than a copy of it. That is the compensating
  control for eight checks sharing one classifier -- see
  user:guideline/software/design-data-checks.md.

  ## The denominator contract

  Every check's rows MUST carry `denominator` as the population the query
  SCANNED, whatever its threshold arm. For a `max_count` check `numerator` is
  the violation count and `denominator` is still the scanned population, which
  is what makes the two arms share one detector-health floor and one report.

  Without it a count-threshold check has no denominator at all: its gradeable
  population IS its finding count, so a floor meant to catch an emptied
  predicate fires precisely when the corpus is clean, and an emptied predicate
  is indistinguishable from health. Both arms are validated against the same
  field for that reason, and a row missing it throws rather than defaulting.

  ## Parking

  One file, one code path, two dispositions. An `adjudicated` entry asserts
  validated-correct and must carry its own reason and evidence; a `baselined`
  entry records known standing debt and must name what owns the repair. They
  suppress findings identically -- load keys, subtract, report entries that
  suppressed nothing -- so the difference is data, not behavior, and lives in a
  field rather than in a second loader.
*/

const GRAIN_SEPARATOR = '␟'

/**
 * The key a finding and a parked entry are matched on: the check id plus the
 * value of every grain column, in the check's declared grain order.
 *
 * Keyed per grain row and never per check, so parking one week cannot mask
 * another. A grain column absent from the row is a distinct key from one whose
 * value is the string 'undefined', which is why the value is JSON-encoded
 * rather than interpolated.
 */
export const grain_key = ({ check_id, grain, row }) =>
  [check_id, ...grain.map((column) => JSON.stringify(row[column]))].join(
    GRAIN_SEPARATOR
  )

const read_count = ({ value, field, check_id }) => {
  const number = typeof value === 'string' ? Number(value) : value

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new Error(
      `${check_id}: row is missing a usable \`${field}\` (got ${JSON.stringify(value)}). Every check must return the population it scanned as \`denominator\`, whatever its threshold arm.`
    )
  }

  return number
}

/**
 * Classify one check's rows.
 *
 * `parked` is the array from db/checks/parked.json, unfiltered -- entries for
 * other checks are ignored here rather than by the caller, so a runner cannot
 * forget to filter and silently suppress across checks.
 *
 * Returns every population the report needs, including the ones that are
 * normally empty: `ungradeable` so a thin reference is visible rather than
 * silently passed, and `stale_parked` so an entry that has stopped applying
 * resurfaces instead of standing forever.
 */
export const classify_check_rows = ({ rows, check, parked = [] }) => {
  const { check_id, grain, precondition, min_rate, max_count } = check

  const has_min_rate = min_rate !== undefined
  const has_max_count = max_count !== undefined

  if (has_min_rate === has_max_count) {
    throw new Error(
      `${check_id}: exactly one of \`min_rate\` / \`max_count\` must be declared`
    )
  }

  const parked_for_check = parked.filter((entry) => entry.check_id === check_id)
  const parked_by_key = new Map(
    parked_for_check.map((entry) => [
      grain_key({ check_id, grain, row: entry.grain }),
      entry
    ])
  )
  const keys_that_suppressed = new Set()

  const gradeable = []
  const ungradeable = []

  for (const row of rows) {
    const denominator = read_count({
      value: row.denominator,
      field: 'denominator',
      check_id
    })
    const numerator = read_count({
      value: row.numerator,
      field: 'numerator',
      check_id
    })

    const classified = { ...row, numerator, denominator }

    // Declared preconditions gate GRADEABILITY, never the verdict. A row that
    // fails one is reported as un-gradeable rather than passed, because a
    // reference too thin to judge against reads as clean under a one-sided
    // threshold.
    if (precondition && !precondition(classified)) {
      ungradeable.push(classified)
      continue
    }

    gradeable.push(classified)
  }

  const below_threshold = gradeable.filter((row) =>
    has_min_rate
      ? row.denominator > 0 && row.numerator / row.denominator < min_rate
      : row.numerator > max_count
  )

  const findings = []
  const adjudicated = []
  const baselined = []

  for (const row of below_threshold) {
    const key = grain_key({ check_id, grain, row })
    const entry = parked_by_key.get(key)

    // An UNREGISTERED subject defaults to unadjudicated. Silence is never the
    // failure mode of an omission -- a key with no entry is a finding.
    if (!entry) {
      findings.push(row)
      continue
    }

    keys_that_suppressed.add(key)

    if (entry.disposition === 'adjudicated') {
      adjudicated.push({ ...row, parked: entry })
    } else {
      baselined.push({ ...row, parked: entry })
    }
  }

  const stale_parked = parked_for_check.filter(
    (entry) =>
      !keys_that_suppressed.has(
        grain_key({ check_id, grain, row: entry.grain })
      )
  )

  return {
    gradeable,
    ungradeable,
    findings,
    adjudicated,
    baselined,
    stale_parked
  }
}

const DISPOSITIONS = ['adjudicated', 'baselined']

/**
 * Validate and return the parked entries.
 *
 * The loader is where the two dispositions differ, and it is the only thing
 * stopping debt being written as validated-correct by omission: an
 * `adjudicated` entry must carry its own distinct reason, the evidence that
 * validated it and a date, while a `baselined` entry must name the task or
 * repair that owns it. Neither requirement is enforceable by a schema shared
 * with the other.
 */
export const load_parked = ({ entries, checks_by_id = null }) => {
  if (!Array.isArray(entries)) {
    throw new Error('parked file must be an array of entries')
  }

  entries.forEach((entry, index) => {
    const at = `parked entry ${index}`

    if (!entry.check_id) {
      throw new Error(`${at} is missing \`check_id\``)
    }

    if (checks_by_id && !checks_by_id.has(entry.check_id)) {
      throw new Error(
        `${at} names \`${entry.check_id}\`, which is not in the registry`
      )
    }

    if (!entry.grain || typeof entry.grain !== 'object') {
      throw new Error(`${at} (${entry.check_id}) is missing \`grain\``)
    }

    if (!DISPOSITIONS.includes(entry.disposition)) {
      throw new Error(
        `${at} (${entry.check_id}) must declare a \`disposition\` of ${DISPOSITIONS.join(' or ')}, got ${JSON.stringify(entry.disposition)}`
      )
    }

    if (entry.disposition === 'adjudicated') {
      for (const field of ['reason', 'evidence', 'validated_at']) {
        if (!entry[field]) {
          throw new Error(
            `${at} (${entry.check_id}) is adjudicated and so must carry \`${field}\` -- an adjudication asserts validated-correct and needs its own evidence, not a repeated sentence`
          )
        }
      }
    }

    if (entry.disposition === 'baselined' && !entry.owner) {
      throw new Error(
        `${at} (${entry.check_id}) is baselined and so must name an \`owner\` -- the task or repair command that will clear it. Debt with no owner is an adjudication wearing the wrong disposition.`
      )
    }
  })

  return entries
}
