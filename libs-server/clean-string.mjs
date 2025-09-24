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
 * @param {string|null|undefined} str - The string to clean
 * @returns {string|null|undefined} - The cleaned string, or original value if null/undefined
 */
const clean_string = (str) => {
  if (!str) return str

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

  return cleaned
}

export default clean_string
