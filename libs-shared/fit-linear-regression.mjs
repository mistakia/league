// Ordinary least squares of y on x. Returns null when the fit is not identified
// (fewer than two points, or no variance on either axis).
//
// Selection on x is benign here -- restricting the sample to the top of the
// projected board does not bias the slope -- but it DOES restrict the range of
// x, which deflates r. The reported r is therefore the correlation within the
// fitted population, not over the whole board, and it is the more useful of the
// two: it answers "can this projection order the players anyone would actually
// roster", which is the question the value pipeline asks of it.
const fit_linear_regression = (pairs) => {
  const n = pairs.length
  if (n < 2) return null

  let sum_x = 0
  let sum_y = 0
  for (const [x, y] of pairs) {
    sum_x += x
    sum_y += y
  }
  const mean_x = sum_x / n
  const mean_y = sum_y / n

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pairs) {
    sxx += (x - mean_x) ** 2
    syy += (y - mean_y) ** 2
    sxy += (x - mean_x) * (y - mean_y)
  }

  if (sxx === 0 || syy === 0) return null

  const slope = sxy / sxx
  return {
    n,
    slope,
    intercept: mean_y - slope * mean_x,
    r: sxy / Math.sqrt(sxx * syy),
    mean_projected: mean_x,
    mean_realized: mean_y
  }
}

export default fit_linear_regression
