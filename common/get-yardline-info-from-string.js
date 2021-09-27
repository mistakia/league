const re = /([A-Z]*)\s([0-9]*)/i

export default function getYardlineInfoFromString(str) {
  if (!str) {
    return {
      yardlineNumber: null,
      yardlineSide: null
    }
  }

  if (str === '50') {
    return {
      yardlineNumber: 50,
      yardlineSide: null
    }
  }

  const results = str.match(re)
  const yardlineSide = results[1]
  const yardlineNumber = parseInt(results[2], 10)

  return {
    yardlineSide,
    yardlineNumber
  }
}
