import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '#libs-shared'

/**
 * Resolve params.year_offset into [min, max]. Returns null when no offset is
 * specified so callers can take their non-offset code path. Shared across the
 * source-attach rules and aggregator-rate join logic.
 * @param {Object} params
 * @returns {[number, number]|null}
 */
export const resolve_year_offset_range = (params) => {
  const raw = params && params.year_offset
  if (raw == null) return null
  const arr = Array.isArray(raw) ? raw : [raw, raw]
  if (!arr.length) return null
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}

/**
 * Expand a set of base years by a year_offset range into the sorted, deduped
 * set of target years actually reachable by some (base_year, offset) pair.
 * `{ base_year + off : base_year in years, off in [min..max] }`. A single
 * offset [k,k] collapses to `{ y + k }`. Mirrors the cross-product the
 * source-attach `emit_year_match` no-anchor branch and select-string's
 * `compute_year_in_list` already build, so CTE-backed sources can scope their
 * own year filter to the same set the correlation predicate will reference.
 * @param {Array<number>} years - base/anchor years
 * @param {[number, number]|null} offset_range - from resolve_year_offset_range
 * @returns {Array<number>} sorted unique target years (base years unchanged when offset_range is null)
 */
export const offset_expanded_years = (years, offset_range) => {
  const base = (Array.isArray(years) ? years : [years])
    .map(Number)
    .filter((n) => Number.isFinite(n))
  if (!offset_range) return base
  const [min_off, max_off] = offset_range
  const out = new Set()
  for (const y of base) {
    for (let off = min_off; off <= max_off; off++) out.add(y + off)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Canonical year-offset correlation primitive. Emits the join/where predicate
 * that correlates a source's year column to a base-year anchor THROUGH a
 * year_offset:
 *  - anchored (year_reference present): `col = ref + k` for a single offset,
 *    `col BETWEEN ref + min AND ref + max` for a range;
 *  - no anchor: the offset-shifted source.year_default (a single shifted year,
 *    or, for a range against a multi-year default, the `{base x offset}`
 *    cross-product IN-list -- a BETWEEN would over-include unreachable years).
 * Lives here (the neutral offset-utils module) rather than in a source-attach
 * rule so every year-grained source -- CTE-attach bridges, direct joins, the
 * rate-type joiners -- can share one implementation. `is_first` selects
 * builder.on/onIn (first predicate in a join) vs andOn/andOnIn.
 * @param {Object} args
 * @param {Object} args.builder - knex join/where builder
 * @param {Object} args.db - knex instance
 * @param {string|null} args.year_reference - SQL fragment for the base-year anchor
 * @param {Object} args.source - source descriptor (reads source.year_default)
 * @param {Object} args.key_columns - { year: '<source year column>' }
 * @param {Object} args.params - column params (reads params.year_offset)
 * @param {string} args.ref - source relation alias/name to qualify the year column
 * @param {boolean} [args.is_first=false] - emit as the first ON predicate
 */
export const emit_year_match = ({
  builder,
  db,
  year_reference,
  source,
  key_columns,
  params,
  ref,
  is_first = false
}) => {
  if (!key_columns.year) return
  const col = `${ref}.${key_columns.year}`
  const eq = is_first ? builder.on.bind(builder) : builder.andOn.bind(builder)
  const offset_range = resolve_year_offset_range(params)
  if (year_reference) {
    if (offset_range) {
      const [min_off, max_off] = offset_range
      if (min_off === max_off) {
        eq(db.raw(`${col} = ${year_reference} + ?`, [min_off]))
      } else {
        eq(
          db.raw(
            `${col} BETWEEN ${year_reference} + ? AND ${year_reference} + ?`,
            [min_off, max_off]
          )
        )
      }
      return
    }
    eq(col, '=', year_reference)
    return
  }
  if (typeof source.year_default !== 'function') return
  const v = source.year_default(params)
  if (v == null) return
  // Apply year_offset to the literal default year when no year_reference is
  // available. The default is treated as the anchor "base year"; an offset
  // shifts that base.
  const shift = (n) =>
    offset_range && offset_range[0] === offset_range[1]
      ? Number(n) + offset_range[0]
      : Number(n)
  if (Array.isArray(v)) {
    if (offset_range && offset_range[0] !== offset_range[1]) {
      // Range offset against a multi-year default: enumerate the full
      // cross-product of {year_default values} x {offset range values}
      // into an IN (...) list so that only combinations actually in the
      // cross-product are matched. A BETWEEN over [min_anchor+min_off,
      // max_anchor+max_off] over-includes years that fall in the range
      // but are not reachable by any (anchor, offset) pair.
      const [min_off, max_off] = offset_range
      const years = new Set()
      for (const anchor of v.map(Number)) {
        for (let off = min_off; off <= max_off; off++) {
          years.add(anchor + off)
        }
      }
      const in_op = is_first
        ? builder.onIn.bind(builder)
        : builder.andOnIn.bind(builder)
      in_op(
        col,
        [...years].sort((a, b) => a - b)
      )
      return
    }
    const shifted = v.map(shift)
    if (shifted.length === 1) {
      eq(col, '=', db.raw('?', [shifted[0]]))
    } else if (shifted.length > 1) {
      const in_op = is_first
        ? builder.onIn.bind(builder)
        : builder.andOnIn.bind(builder)
      in_op(col, shifted)
    }
    return
  }
  if (offset_range && offset_range[0] !== offset_range[1]) {
    eq(
      db.raw(`${col} BETWEEN ? AND ?`, [
        Number(v) + offset_range[0],
        Number(v) + offset_range[1]
      ])
    )
    return
  }
  eq(col, '=', db.raw('?', [shift(v)]))
}

/**
 * Normalise a career_year or career_game param (which arrives as a 2-element
 * array [lo, hi] in any order) into a guaranteed [lo, hi] pair where lo <=
 * hi. Used by the three play-by-play with-statement builders.
 * @param {Array} arr - Two-element array [a, b]
 * @returns {[number, number]} [min, max]
 */
export const normalize_career_year_range = (arr) => [
  Math.min(Number(arr[0]), Number(arr[1])),
  Math.max(Number(arr[0]), Number(arr[1]))
]

/**
 * Extracts a single value from a parameter that may be an array or single value
 * @param {*} value - The parameter value (may be array or single)
 * @param {*} default_value - Default value if value is undefined or null
 * @returns {*} Single value (first element if array, otherwise the value itself)
 */
export const get_single_value = (value, default_value) => {
  if (value === undefined || value === null) {
    return default_value
  }
  if (Array.isArray(value)) {
    return value[0] !== undefined ? value[0] : default_value
  }
  return value
}

/**
 * Extracts the scoring format id from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} Scoring format id
 */
export const get_scoring_format_id = (params = {}) => {
  return get_single_value(params.scoring_format_id, DEFAULT_SCORING_FORMAT_ID)
}

/**
 * Extracts the league format id from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} League format id
 */
export const get_league_format_id = (params = {}) => {
  return get_single_value(params.league_format_id, DEFAULT_LEAGUE_FORMAT_ID)
}
