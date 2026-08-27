// @ts-check
import { current_season, nfl_season_types } from '#constants'

/**
 * The season-type vocabulary, taken from the DATABASE enum rather than
 * restated here.
 *
 * `nfl_week_id` is a persisted literal built from this token, so the two
 * vocabularies must not be able to drift: adding or renaming a member of
 * `public.season_type` in the DDL now moves this type and turns every
 * disagreeing site in a checked file red. That is the stranded-vocabulary
 * class the census ranks at five, whose usual symptom is a predicate that
 * silently never matches.
 *
 * The import is TYPE-ONLY and erases at compile time. That matters here
 * because `libs-shared` is isomorphic and reaches the SPA bundle -- nothing
 * about this adds a runtime import or a byte of output.
 *
 * @typedef {import('#db/schema-types.js').SeasonType} SeasonType
 */

/**
 * A week's coordinates. The same three keys the whole codebase destructures.
 *
 * @typedef {object} NflWeekParams
 * @property {number} year
 * @property {SeasonType} seas_type
 * @property {number} week
 */

/**
 * The persisted `nfl_week_id` literal, e.g. `2025_REG_WEEK_3`.
 *
 * A documented alias of `string`, NOT a template-literal pattern. The pattern
 * form was tried first and rejected on measurement: TypeScript widens a
 * template expression to `string` on return, so every producer here would need
 * a cast, and every identifier read out of the database arrives as `string`
 * anyway -- so the pattern would have bought a cast at each boundary and
 * caught nothing the parse below does not already catch. The vocabulary is
 * where the real protection is, and that is `SeasonType`.
 *
 * @typedef {string} NflWeekIdentifier
 */

/**
 * The season types, asserted to BE the database vocabulary.
 *
 * This annotation is the load-bearing part: `nfl_season_types` is a
 * hand-written array in season-constants, and `SeasonType` comes from the
 * `public.season_type` DDL enum. Assigning one to the other makes a drift
 * between them a type error at this line rather than a predicate that quietly
 * never matches. Without it the two vocabularies could diverge with nothing
 * anywhere to notice.
 *
 * @type {readonly SeasonType[]}
 */
const SEASON_TYPES = nfl_season_types

// Built FROM the vocabulary above rather than restating it. The alternation
// used to be a hardcoded `(PRE|REG|POST)`, which is a third copy of the same
// list -- and the one that fails silently, since an identifier carrying a
// season type the regex does not know is simply reported unparseable.
const NFL_WEEK_REGEX = new RegExp(
  `^(\\d{4})_(${SEASON_TYPES.join('|')})_WEEK_(\\d+)$`
)

/**
 * Week bounds for the two FIXED-length season types.
 *
 * REG is deliberately absent -- its length is era-dependent and comes from
 * REG_MAX_WEEKS_BY_ERA below. The map is typed as a Partial over the whole
 * vocabulary so that absence is part of the contract: every lookup here is
 * keyed by a season type that may be REG, and a reader that forgets to handle
 * the miss is the interpolated-key class again. The existing `range ? ... : 0`
 * guards were already right; the type now says why they have to be there.
 *
 * @type {Partial<Record<SeasonType, { min: number, max: number }>>}
 */
export const WEEK_RANGES = {
  PRE: { min: 1, max: 4 },
  POST: { min: 1, max: 4 }
}

const MIN_YEAR = 2000

// Era-specific REG week caps, sourced from nfl_games history.
// 1970-1977 = 14, 1978-1989 = 16 (1982 strike = 9, 1987 strike = 15),
// 1990-2020 = 17, 2021+ = 18.
/**
 * @param {{ year: number }} params
 * @returns {number}
 */
const REG_MAX_WEEKS_BY_ERA = ({ year }) => {
  if (year === 1982) return 9
  if (year === 1987) return 15
  if (year < 1978) return 14
  if (year < 1990) return 16
  if (year < 2021) return 17
  return 18
}

/**
 * @param {{ identifier: string | null | undefined }} params
 * @returns {NflWeekParams | null}
 */
export const parse_nfl_week_identifier = ({ identifier }) => {
  if (!identifier || typeof identifier !== 'string') return null

  const match = identifier.match(NFL_WEEK_REGEX)
  if (!match) return null

  return {
    year: parseInt(match[1], 10),
    // The regex alternation is BUILT from SEASON_TYPES, so capture group 2 can
    // only be a member of the vocabulary. This is the one place an untrusted
    // string becomes a typed season type, which is what makes it the right
    // place to say so rather than re-validating at every reader.
    seas_type: /** @type {SeasonType} */ (match[2]),
    week: parseInt(match[3], 10)
  }
}

/**
 * @param {NflWeekParams} params
 * @returns {NflWeekIdentifier}
 */
export const format_nfl_week_identifier = ({ year, seas_type, week }) => {
  return `${year}_${seas_type}_WEEK_${week}`
}

/**
 * @param {{ identifier: string | null | undefined }} params
 * @returns {boolean}
 */
export const validate_nfl_week_identifier = ({ identifier }) => {
  const parsed = parse_nfl_week_identifier({ identifier })
  if (!parsed) return false

  const { year, seas_type, week } = parsed

  if (year < MIN_YEAR || year > current_season.year) return false

  const max = get_max_weeks_for_season_type({ seas_type, year })
  if (!max) return false

  if (week < 1 || week > max) return false

  return true
}

/**
 * @param {{ year: number, seas_type?: SeasonType | null }} params
 * @returns {NflWeekIdentifier[]}
 */
export const get_nfl_week_identifiers_for_year = ({
  year,
  seas_type = null
}) => {
  const types = seas_type ? [seas_type] : nfl_season_types
  const identifiers = []

  for (const st of types) {
    const max = get_max_weeks_for_season_type({ seas_type: st, year })
    if (!max) continue
    // WEEK_RANGES is a Partial over the vocabulary on purpose -- REG is absent
    // because its length is era-dependent. Every other type is fixed-length and
    // starts at week 1, so the miss falls back rather than throwing.
    const min = st === 'REG' ? 1 : (WEEK_RANGES[st]?.min ?? 1)
    for (let w = min; w <= max; w++) {
      identifiers.push(
        format_nfl_week_identifier({ year, seas_type: st, week: w })
      )
    }
  }

  return identifiers
}

/**
 * @returns {NflWeekIdentifier[]}
 */
export const get_all_nfl_week_identifiers = () => {
  const identifiers = []
  for (let y = current_season.year; y >= MIN_YEAR; y--) {
    identifiers.push(...get_nfl_week_identifiers_for_year({ year: y }))
  }
  return identifiers
}

/**
 * @param {{ nfl_weeks: string[], year_offset: number | number[] | null | undefined }} params
 * @returns {string[]}
 */
export const apply_year_offset_to_nfl_weeks = ({ nfl_weeks, year_offset }) => {
  if (!year_offset || !nfl_weeks || !nfl_weeks.length) return nfl_weeks

  const offsets = Array.isArray(year_offset) ? year_offset : [year_offset]
  const min_offset = Math.min(...offsets)
  const max_offset = Math.max(...offsets)

  const expanded = []
  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue

    for (let offset = min_offset; offset <= max_offset; offset++) {
      const offset_year = parsed.year + offset
      if (offset_year < MIN_YEAR || offset_year > current_season.year) continue
      const candidate = format_nfl_week_identifier({
        year: offset_year,
        seas_type: parsed.seas_type,
        week: parsed.week
      })
      if (!validate_nfl_week_identifier({ identifier: candidate })) continue
      expanded.push(candidate)
    }
  }

  return [...new Set(expanded)]
}

/**
 * Weeks bucketed by `<year>_<seas_type>`, each list sorted ascending.
 *
 * @param {{ nfl_weeks: string[] }} params
 * @returns {Record<string, number[]>}
 */
export const group_nfl_weeks = ({ nfl_weeks }) => {
  /** @type {Record<string, number[]>} */
  const groups = {}
  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue
    const key = `${parsed.year}_${parsed.seas_type}`
    if (!groups[key]) groups[key] = []
    groups[key].push(parsed.week)
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a - b)
  }
  return groups
}

/**
 * @param {{ weeks: number[] }} params
 * @returns {string}
 */
export const format_week_ranges = ({ weeks }) => {
  if (!weeks || weeks.length === 0) return ''
  const sorted = [...weeks].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`)
  return ranges.join(', ')
}

/** @type {Record<number, string>} */
const POSTSEASON_WEEK_LABELS = {
  1: 'Wild Card',
  2: 'Divisional',
  3: 'Conference',
  4: 'Super Bowl'
}

/**
 * @param {{ week: number }} params
 * @returns {string}
 */
export const get_postseason_week_label = ({ week }) => {
  return POSTSEASON_WEEK_LABELS[week] || `Week ${week}`
}

/**
 * @returns {NflWeekParams}
 */
export const current_nfl_week_params = () => {
  const year = current_season.last_completed_season_year
  const live_type = current_season.nfl_seas_type
  if (live_type === 'POST') {
    return {
      year,
      seas_type: 'POST',
      week: Math.max(current_season.nfl_seas_week, 1)
    }
  }
  // REG and PRE (offseason) both default to the REG track. During offseason
  // current_season.week is 0, which we clamp to REG week 1 as the last
  // meaningful identifier for default queries.
  return {
    year,
    seas_type: 'REG',
    week: Math.max(current_season.week, 1)
  }
}

/**
 * @returns {NflWeekIdentifier}
 */
export const current_nfl_week_identifier = () => {
  return format_nfl_week_identifier(current_nfl_week_params())
}

/**
 * @param {{ offset: number }} params
 * @returns {NflWeekParams | null}
 */
export const nfl_week_offset_params = ({ offset }) => {
  if (offset === 0) return current_nfl_week_params()
  if (offset > 0) {
    throw new Error(
      `nfl_week_offset_params: positive offsets are not supported (got ${offset})`
    )
  }

  const { year, seas_type, week } = current_nfl_week_params()
  const steps = -offset
  const cur_year = year
  let cur_seas_type = seas_type
  let cur_week = week

  for (let i = 0; i < steps; i++) {
    if (cur_seas_type === 'POST') {
      if (cur_week > 1) {
        cur_week -= 1
      } else {
        cur_seas_type = 'REG'
        cur_week = REG_MAX_WEEKS_BY_ERA({ year: cur_year })
      }
    } else if (cur_seas_type === 'REG') {
      if (cur_week > 1) {
        cur_week -= 1
      } else {
        return null
      }
    } else {
      return null
    }
  }

  return { year: cur_year, seas_type: cur_seas_type, week: cur_week }
}

// Reference-week params for joins that need a "prior" week with a one-week
// bye fallback. `prior_params` is the most recent played week; `fallback_params`
// is two-weeks-prior when that exists, otherwise prior. Returns null when no
// prior week exists (offseason / REG week 1).
/**
 * @returns {{ prior_params: NflWeekParams, fallback_params: NflWeekParams } | null}
 */
export const reference_week_fallback_params = () => {
  const prior_params = nfl_week_offset_params({ offset: -1 })
  if (!prior_params) return null
  const two_weeks_prior_params = nfl_week_offset_params({ offset: -2 })
  return {
    prior_params,
    fallback_params: two_weeks_prior_params || prior_params
  }
}

// Resolves a "year-only" saved view intent to the most meaningful REG week
// for that year. Past/current years return a REG identifier; future years or
// years before MIN_YEAR return null. For the live year, returns the current
// REG week (clamped to >= 1) during REG, REG era-max during POST, and REG
// week 1 during PRE/offseason.
/**
 * @param {{ year: number | null | undefined }} params
 * @returns {NflWeekParams | null}
 */
export const last_meaningful_reg_week_params_for_year = ({ year }) => {
  if (year == null) return null
  if (year < MIN_YEAR || year > current_season.year) return null
  if (year < current_season.year) {
    return { year, seas_type: 'REG', week: REG_MAX_WEEKS_BY_ERA({ year }) }
  }
  const live_type = current_season.nfl_seas_type
  if (live_type === 'POST') {
    return { year, seas_type: 'REG', week: REG_MAX_WEEKS_BY_ERA({ year }) }
  }
  if (live_type === 'REG') {
    return { year, seas_type: 'REG', week: Math.max(current_season.week, 1) }
  }
  return { year, seas_type: 'REG', week: 1 }
}

/**
 * @param {{ seas_type: SeasonType | string, year?: number }} params
 * @returns {number} The era-correct max week, or 0 when the type is unknown.
 */
export const get_max_weeks_for_season_type = ({ seas_type, year }) => {
  if (seas_type === 'REG') {
    if (!year) return 0
    return REG_MAX_WEEKS_BY_ERA({ year })
  }
  // Cast at the lookup because the caller may hand over a raw token split out
  // of a group key rather than a checked SeasonType. The `range ? ... : 0`
  // below is what makes that safe -- an unknown season type answers 0, which
  // every caller already treats as "no such type".
  const range = WEEK_RANGES[/** @type {SeasonType} */ (seas_type)]
  return range ? range.max : 0
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const compare_nfl_week_group_keys = (a, b) => {
  const [ya, ta] = a.split('_')
  const [yb, tb] = b.split('_')
  if (ya !== yb) return parseInt(yb, 10) - parseInt(ya, 10)
  /** @type {Record<string, number>} */
  const type_order = { PRE: 0, REG: 1, POST: 2 }
  return (type_order[ta] ?? 0) - (type_order[tb] ?? 0)
}

/**
 * @param {{ nfl_weeks: string[] }} params
 * @returns {string}
 */
export const format_nfl_week_param_values = ({ nfl_weeks }) => {
  if (!nfl_weeks || nfl_weeks.length === 0) return ''

  const groups = group_nfl_weeks({ nfl_weeks })
  const sorted_keys = Object.keys(groups).sort(compare_nfl_week_group_keys)

  return sorted_keys
    .map((key) => {
      const weeks = groups[key]
      const [year, seas_type] = key.split('_')
      const range_label =
        seas_type === 'POST'
          ? weeks.map((w) => get_postseason_week_label({ week: w })).join(', ')
          : format_week_ranges({ weeks })
      return `${year} ${seas_type}: ${range_label}`
    })
    .join(', ')
}

// Returns true when the given list of nfl_week_id values equals (as a set) the
// full week enumeration for every (year, seas_type) pair it touches. When this
// holds, the IN-list adds no information beyond derived year + seas_type
// predicates, so callers can skip emitting a (potentially 100+ element)
// nfl_week_id IN list and lean on partition pruning + the (year, seas_type,
// ...) composite indexes on nfl_plays. Falls back to false (emit IN-list) when
// the user has narrowed to specific weeks within a (year, seas_type) pair.
/**
 * @param {{ nfl_weeks: string[] }} params
 * @returns {boolean}
 */
export const is_full_year_seas_type_coverage = ({ nfl_weeks }) => {
  if (!Array.isArray(nfl_weeks) || nfl_weeks.length === 0) return false
  const groups = group_nfl_weeks({ nfl_weeks })
  const keys = Object.keys(groups)
  if (keys.length === 0) return false
  for (const key of keys) {
    const [year_str, seas_type] = key.split('_')
    const year = parseInt(year_str, 10)
    const max = get_max_weeks_for_season_type({ seas_type, year })
    if (!max) return false
    // Unreachable for an unknown season type: get_max_weeks_for_season_type
    // answers 0 for one and the `if (!max) return false` above has already
    // returned. Same cast, same reason as in that function.
    const min =
      seas_type === 'REG'
        ? 1
        : (WEEK_RANGES[/** @type {SeasonType} */ (seas_type)]?.min ?? 1)
    const weeks = new Set(groups[key])
    const expected_size = max - min + 1
    if (weeks.size !== expected_size) return false
    for (let w = min; w <= max; w++) {
      if (!weeks.has(w)) return false
    }
  }
  return true
}

/**
 * @param {{ nfl_weeks: string[] }} params
 * @returns {{ years: number[], weeks: number[], seas_types: SeasonType[] }}
 */
export const decompose_nfl_weeks = ({ nfl_weeks }) => {
  const years = new Set()
  const weeks = new Set()
  const seas_types = new Set()

  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue
    years.add(parsed.year)
    weeks.add(parsed.week)
    seas_types.add(parsed.seas_type)
  }

  return {
    years: [...years],
    weeks: [...weeks],
    seas_types: [...seas_types]
  }
}
