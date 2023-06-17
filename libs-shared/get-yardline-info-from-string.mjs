const re = /([A-Z]*)\s([0-9]*)/i

export default function getYardlineInfoFromString(str) {
  if (!str) {
    return {
      number: null,
      side: null
    }
  }

  if (str === '50') {
    return {
      number: 50,
      side: null
    }
  }

  const results = str.match(re)
  const side = results[1]
  const number = parseInt(results[2], 10)

  if (number === 50) {
    return {
      number: 50,
      side: null
    }
  }

  return {
    side,
    number
  }
}
