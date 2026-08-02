import db from '#db'

// Load the fitted per-position calibration for one scoring format and period
// ('season' for the week-0 board, 'week' for the weekly boards), shaped for
// calibrate_projected_points.
//
// Returns null when the format has never been fitted. That is deliberately NOT
// an error: an unfitted format falls through to the raw vendor board, which is
// the behaviour that existed before calibration and is strictly better than
// refusing to price the format at all.
export const get_projection_calibration = async ({
  scoring_format_id,
  period
}) => {
  const rows = await db('scoring_format_projection_calibration')
    .where({ scoring_format_id, period })
    .select('position', 'slope', 'intercept', 'r', 'n')

  if (!rows.length) {
    return null
  }

  const calibration = {}
  for (const row of rows) {
    calibration[row.position] = {
      slope: Number(row.slope),
      intercept: Number(row.intercept),
      r: Number(row.r),
      n: Number(row.n)
    }
  }

  return calibration
}

export default get_projection_calibration
