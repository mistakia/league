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
    const feet = Number(s[0])
    let inches = 0

    if (s[1]) {
      // Remove any quotes and whitespace from the inches part
      const inches_str = s[1].replace(/"/g, '').trim()
      inches = Number(inches_str) || 0
    }

    return feet * 12 + inches
  } else if (clean_str.includes('-')) {
    const s = clean_str.split('-')
    const feet = Number(s[0])
    const inches = Number(s[1]) || 0

    return feet * 12 + inches
  } else if (clean_str.includes('/')) {
    // Handle fractions like "33 1/4"
    const fraction_regex = /(\d+)\s+(\d+)\/(\d+)/
    const match = clean_str.match(fraction_regex)

    if (match) {
      const whole_number = Number(match[1])
      const numerator = Number(match[2])
      const denominator = Number(match[3])

      return whole_number + numerator / denominator
    }

    return Number(clean_str)
  } else {
    return Number(clean_str)
  }
}
