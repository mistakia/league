/*
  The pure half of the registered data-check system: a classifier that turns a
  check's rows into a verdict, and the loader for the file that parks a
  suppressed finding.

  Nothing here touches a database, a signal or the filesystem beyond reading the
  parked file, so the whole classification is specced against fixtures through
  the SHIPPED expression rather than a copy of it. That is the compensating
  control for the checks sharing one classifier -- see
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

  A row whose `denominator` is zero is UN-GRADEABLE on both arms, not clean. It
  scanned nothing, so there is no population to judge it against; grading it
  passed the row silently while still counting it toward the detector-health
  floor, which is the same false green the contract exists to prevent.

  ## What the two thresholds compare

  `min_rate` is PER ROW -- each unit carries its own ratio against its own
  denominator, and a unit below the floor is its own finding.

  `max_count` is NOT per row. It is a budget over the check's whole unsuppressed
  violation count, because the two row shapes in the registry disagree about
  what one row means: a per-violation check emits one row per bad row carrying
  `numerator: 1`, while an aggregate check emits a single row whose numerator is
  already a count. Comparing per row would let the first shape pass ANY
  threshold above zero, however many violations it found. Parked entries are
  subtracted before the budget applies, so a threshold covers what is genuinely
  unaccounted for.

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

    // A row that scanned NOTHING cannot be graded, on either arm. The rate arm
    // would divide by zero and the count arm would compare against an empty
    // population, and both previously read as CLEAN -- so a unit whose scan
    // collapsed passed silently while still counting toward the detector-health
    // floor. Reported un-gradeable for the same reason a thin reference is.
    if (denominator <= 0) {
      ungradeable.push(classified)
      continue
    }

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

  // The rate arm is per row: each unit is its own ratio against its own
  // denominator. The count arm is NOT -- `max_count` is a budget over the
  // check's whole violation count, which is the only reading both row shapes in
  // the registry share. One shape emits a row per violation carrying
  // `numerator: 1`, the other emits a single row carrying an aggregate count,
  // and comparing per row would let a per-violation check pass any threshold
  // above 0 no matter how many violations it found.
  const violating = gradeable.filter((row) =>
    has_min_rate
      ? row.numerator / row.denominator < min_rate
      : row.numerator > 0
  )

  const unsuppressed = []
  const adjudicated = []
  const baselined = []

  for (const row of violating) {
    const key = grain_key({ check_id, grain, row })
    const entry = parked_by_key.get(key)

    // An UNREGISTERED subject defaults to unadjudicated. Silence is never the
    // failure mode of an omission -- a key with no entry is a finding.
    if (!entry) {
      unsuppressed.push(row)
      continue
    }

    keys_that_suppressed.add(key)

    if (entry.disposition === 'adjudicated') {
      adjudicated.push({ ...row, parked: entry })
    } else {
      baselined.push({ ...row, parked: entry })
    }
  }

  // Parked violations are subtracted BEFORE the budget is applied, so a
  // threshold covers what is genuinely unaccounted for rather than being spent
  // on rows that already carry a reason.
  const unsuppressed_violations = unsuppressed.reduce(
    (total, row) => total + row.numerator,
    0
  )
  const within_budget = has_max_count && unsuppressed_violations <= max_count
  const findings = within_budget ? [] : unsuppressed

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

const REQUIRED_STRING_FIELDS = ['invariant', 'calibration', 'repair_command']

/**
 * Validate the registry itself, at load.
 *
 * The registry's header calls several fields REQUIRED and nothing enforced any
 * of them -- the only check was a spec, which runs at test time rather than at
 * load, so a row could reach production missing any of them. The consequential
 * one is `min_gradeable_units`: omit it and `graded < undefined` is `false`, so
 * the detector-health floor silently disappears with no error anywhere.
 *
 * Returns the checks so a caller can validate and bind in one expression.
 */
export const validate_registry = ({ checks }) => {
  if (!Array.isArray(checks) || !checks.length) {
    throw new Error('registry must be a non-empty array of checks')
  }

  const seen = new Set()

  checks.forEach((check, index) => {
    const at = `registry entry ${index}`

    if (!check.check_id || typeof check.check_id !== 'string') {
      throw new Error(`${at} is missing a \`check_id\``)
    }

    // A duplicate id is worse than a missing field: both rows would emit and
    // resolve on ONE pair of pinned fingerprints, so each would close the
    // other's open signal.
    if (seen.has(check.check_id)) {
      throw new Error(`${at} repeats the check_id \`${check.check_id}\``)
    }
    seen.add(check.check_id)

    const where = `${at} (${check.check_id})`

    if (typeof check.rows !== 'function') {
      throw new Error(`${where} must declare a \`rows\` function`)
    }

    if (!Array.isArray(check.grain) || !check.grain.length) {
      throw new Error(`${where} must declare a non-empty \`grain\``)
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof check[field] !== 'string' || !check[field].trim()) {
        throw new Error(`${where} must carry a non-empty \`${field}\``)
      }
    }

    const declared_thresholds = [check.min_rate, check.max_count].filter(
      (value) => value !== undefined
    )
    if (declared_thresholds.length !== 1) {
      throw new Error(
        `${where} must declare exactly one of \`min_rate\` / \`max_count\``
      )
    }

    if (
      typeof check.min_gradeable_units !== 'number' ||
      !Number.isFinite(check.min_gradeable_units) ||
      check.min_gradeable_units < 1
    ) {
      throw new Error(
        `${where} must carry a \`min_gradeable_units\` of at least 1 -- an absent floor does not throw, it compares against undefined and silently disappears`
      )
    }

    if (check.min_denominator !== undefined) {
      if (
        typeof check.min_denominator !== 'number' ||
        !Number.isFinite(check.min_denominator) ||
        check.min_denominator < 1
      ) {
        throw new Error(
          `${where} declares a \`min_denominator\` that is not a positive number`
        )
      }
    }

    if (check.precondition !== undefined) {
      if (typeof check.precondition !== 'function') {
        throw new Error(
          `${where} declares a \`precondition\` that is not a function`
        )
      }
    }
  })

  return checks
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
