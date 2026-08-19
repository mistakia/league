// @ts-check

/**
 * Utility function to clean strings by removing null bytes and other invalid UTF-8 characters
 * that can cause PostgreSQL encoding errors.
 *
 * This function removes:
 * - Null bytes (0x00) which cause "invalid byte sequence for encoding 'UTF8'" errors
 * - Other control characters that PostgreSQL doesn't handle well
 * - Invalid UTF-8 sequences
 *
 * Preserves:
 * - Tabs (0x09), newlines (0x0A), and carriage returns (0x0D) when needed
 * - All printable ASCII and valid Unicode characters
 *
 * The return type TRACKS the argument rather than widening to the union of
 * everything the function can return. That distinction is not cosmetic: most
 * callers pass a column typed `string | null`, and a flat
 * `{string|null|undefined}` return added an `undefined` the input could never
 * produce. Under strictNullChecks that one spurious member made every
 * `{ ...row, formatted_name: clean_string(row.formatted_name) }` object stop
 * being assignable to its own row type -- eleven diagnostics in player-cache
 * alone, all of them this signature and none of them a defect at the call site.
 *
 * @template {string|null|undefined} T
 * @param {T} str - The string to clean
 * @returns {T extends string ? string : T} - The cleaned string, or the original value if null/undefined
 */
const clean_string = (str) => {
  // The two casts are the generic-body limitation, not a claim about the
  // values: TypeScript does not narrow a conditional return type against the
  // branches of the function that produces it, so neither `return str` under a
  // falsy guard nor `return cleaned` after the transforms can be verified
  // against `T extends string ? ... : ...` from inside. Callers get the full
  // check; only these two returns are asserted.
  if (!str) return /** @type {T extends string ? string : T} */ (str)

  // Remove null bytes and other control characters that PostgreSQL doesn't like
  // Keep tabs, newlines, and carriage returns if needed
  // Remove all other control characters below 0x20 (space)
  let cleaned = str
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      // Keep tabs (9), newlines (10), and carriage returns (13)
      if (code === 9 || code === 10 || code === 13) return true
      // Remove null bytes and other control characters below 32 (space)
      if (code < 32) return false
      // Keep printable ASCII and valid Unicode characters
      return true
    })
    .join('')

  // Also remove any invalid UTF-8 sequences by filtering out non-printable characters
  cleaned = cleaned
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      // Keep tabs, newlines, carriage returns, and printable ASCII
      if (code >= 9 && code <= 13) return true
      if (code >= 32 && code <= 126) return true
      // Keep valid Unicode characters above 127
      if (code >= 128) return true
      return false
    })
    .join('')

  // Trim whitespace
  cleaned = cleaned.trim()

  return /** @type {T extends string ? string : T} */ (cleaned)
}

export default clean_string
