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

  if (str.includes("'")) {
    const s = str.split("'")
    const feet = parseInt(s[0], 10)
    const inches = parseInt(s[1], 10) || 0

    return feet * 12 + inches
  } else if (str.includes('-')) {
    const s = str.split('-')
    const feet = parseInt(s[0], 10)
    const inches = parseInt(s[1], 10) || 0

    return feet * 12 + inches
  } else {
    return parseInt(str, 10)
  }
}
