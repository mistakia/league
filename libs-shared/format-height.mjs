export default function (str) {
  if (!str) {
    return null
  }

  if (Number.isInteger(str)) {
    if (str > 0 && str < 88) {
      return str
    }

    return null
  }

  // Convert string to a more usable format
  const clean_str = String(str).trim()

  if (clean_str.includes("'")) {
    const s = clean_str.split("'")
    const feet = parseInt(s[0], 10)
    const inches = parseInt(s[1], 10) || 0

    return feet * 12 + inches
  } else if (clean_str.includes('-')) {
    const s = clean_str.split('-')
    const feet = parseInt(s[0], 10)
    const inches = parseInt(s[1], 10) || 0

    return feet * 12 + inches
  } else if (clean_str.includes('/')) {
    // Handle fractions like "33 1/4"
    const fraction_regex = /(\d+)\s+(\d+)\/(\d+)/
    const match = clean_str.match(fraction_regex)

    if (match) {
      const whole_number = parseInt(match[1], 10)
      const numerator = parseInt(match[2], 10)
      const denominator = parseInt(match[3], 10)

      return whole_number + numerator / denominator
    }

    return parseInt(clean_str, 10)
  } else {
    return parseInt(clean_str, 10)
  }
}
