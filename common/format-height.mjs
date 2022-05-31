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

  if (!str.includes("'")) {
    return parseInt(str, 10)
  }

  const s = str.split("'")
  const feet = parseInt(s[0], 10)
  const inches = parseInt(s[1], 10) || 0

  return feet * 12 + inches
}
