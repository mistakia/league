// Measure the replacement dispersion model, and check it is a property of the
// PROJECTIONS rather than of one league's scoring.
//
// The shipped model estimates a player's realized dispersion by rescaling his
// cross-vendor spread. dispersion-cross-section.mjs shows that spread carries
// almost no cross-sectional signal: splitting on projection level first, a 6.8x
// change in vendor sd moves realized residual sd by 1.22x at QB, and less at
// every other position. What DOES move it is the size of the projection.
//
// So the model becomes, per position:
//
//   sd(player) = intercept_share * mean_projection(position) + slope * projection(player)
//
// Both terms are linear in the format's point scale, so the two constants are
// DIMENSIONLESS and should be the same number at every scoring format. That is
// what makes them a property of the projection panel rather than a fit to
// genesis. This script measures them per format and reports the spread across
// formats, which is the falsification test.
//
// Fitted against realized OUTCOMES, never against prices, salaries or auction
// results -- the same standing this model's other measured inputs have.
//
// This is the reproduction path for the constants in
// libs-shared/calculate-projection-dispersion.mjs, and the falsification test
// named in that module's header. Committed rather than left in the working tier
// precisely because a measured constant nobody can re-measure is a fitted one.
//
//   . "$HOME/.nvm/nvm.sh" && nvm use
//   SCORING_FORMAT_IDS=genesis,<other>,<other> NODE_ENV=production \
//     LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node scripts/measure-projection-dispersion-model.mjs
//
// Pass several scoring formats: the constants are dimensionless, so a spread
// across formats is the signal that they have stopped describing the projection
// panel and started describing one league.
//
// Read-only. Computes and prints, never persists.
import db from '#db'
import { calculatePoints } from '#libs-shared'
import { external_data_sources } from '#constants'

const HISTORY_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DST']
const MIN_PROJECTION = Number(process.env.MIN_PROJECTION || 30)
const BINS = 6

const mean = (values) =>
  values.length ? values.reduce((t, v) => t + v, 0) / values.length : 0
const sd = (values) => {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(
    values.reduce((t, v) => t + (v - m) ** 2, 0) / (values.length - 1)
  )
}

// Ordinary least squares of y on x.
const fit_line = (points) => {
  const n = points.length
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  let sxy = 0
  let sxx = 0
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my)
    sxx += (p.x - mx) ** 2
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, intercept: my - slope * mx, n }
}

const measure_format = async ({ scoring_format_id, projections_by_year }) => {
  const scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()
  if (!scoring_format) return null

  const observations = []
  for (const year of HISTORY_YEARS) {
    const rows = projections_by_year[year]
    if (!rows) continue

    const realized_rows = await db('scoring_format_player_seasonlogs')
      .where({ year, scoring_format_id })
      .select('pid', 'points')
    const realized_by_pid = Object.fromEntries(
      realized_rows.map((row) => [row.pid, Number(row.points)])
    )

    for (const row of rows) {
      if (row.sourceid !== external_data_sources.AVERAGE) continue
      const position = row.primary_position
      if (!POSITIONS.includes(position)) continue
      const { week, primary_position, ...stats } = row
      const { total } = calculatePoints({
        stats,
        position,
        league: scoring_format,
        use_projected_stats: true
      })
      if (!(total > MIN_PROJECTION)) continue
      const realized = realized_by_pid[row.pid]
      if (realized === undefined) continue
      observations.push({
        position,
        year,
        projection: total,
        residual: realized - total
      })
    }
  }

  const result = {}
  for (const position of POSITIONS) {
    const group = observations.filter((row) => row.position === position)
    if (group.length < 60) continue

    // Scale anchor: the mean projection of the position's top 12 players in each
    // season. It has to be computable identically at runtime from the board
    // alone, and it must not depend on how DEEP the projection set runs -- a
    // mean over everyone projected moves when a vendor adds forty more bench
    // players, which would silently rescale every dispersion on the board.
    const anchors = []
    for (const year of HISTORY_YEARS) {
      const season = group.filter((row) => row.year === year)
      if (season.length < 12) continue
      const top = season
        .map((row) => row.projection)
        .sort((a, b) => b - a)
        .slice(0, 12)
      anchors.push(mean(top))
    }
    const position_mean = mean(anchors)

    // Bin by projection, take the residual sd inside each bin, and regress those
    // on the bin's mean projection. Binning first is what makes this a
    // measurement of DISPERSION rather than of the residual itself.
    const sorted = group.slice().sort((a, b) => a.projection - b.projection)
    const points = []
    for (let i = 0; i < BINS; i++) {
      const bin = sorted.slice(
        Math.floor((i / BINS) * sorted.length),
        Math.floor(((i + 1) / BINS) * sorted.length)
      )
      if (bin.length < 10) continue
      points.push({
        x: mean(bin.map((row) => row.projection)),
        y: sd(bin.map((row) => row.residual))
      })
    }
    if (points.length < 4) continue

    const { slope, intercept } = fit_line(points)
    result[position] = {
      n: group.length,
      position_mean,
      slope,
      intercept,
      // Dimensionless: the intercept expressed as a share of the position's own
      // mean projection, which is what makes it travel across scoring formats.
      intercept_share: intercept / position_mean,
      pooled_sd: sd(group.map((row) => row.residual))
    }
  }
  return result
}

const main = async () => {
  const format_ids = process.env.SCORING_FORMAT_IDS
    ? process.env.SCORING_FORMAT_IDS.split(',')
    : ['genesis']

  // Load projections once; they do not depend on scoring format.
  const projections_by_year = {}
  for (const year of HISTORY_YEARS) {
    const rows = await db('projections_index').where({
      season_year: year,
      week: 0,
      season_type: 'REG',
      sourceid: external_data_sources.AVERAGE
    })
    if (!rows.length) continue
    const players = await db('player')
      .whereIn(
        'pid',
        rows.map((row) => row.pid)
      )
      .select('pid', 'primary_position')
    const position_by_pid = Object.fromEntries(
      players.map((row) => [row.pid, row.primary_position])
    )
    projections_by_year[year] = rows.map((row) => ({
      ...row,
      primary_position: position_by_pid[row.pid]
    }))
  }

  const by_format = {}
  for (const scoring_format_id of format_ids) {
    const measured = await measure_format({
      scoring_format_id,
      projections_by_year
    })
    if (measured) by_format[scoring_format_id] = measured
  }

  for (const position of POSITIONS) {
    const rows = Object.entries(by_format)
      .map(([id, measured]) => [id, measured[position]])
      .filter(([, value]) => value)
    if (!rows.length) continue
    console.log(`\n${position}`)
    console.log(
      '  scoring format                       |    n | top12    | intercept | int share | slope | pooled sd'
    )
    for (const [id, value] of rows) {
      console.log(
        `  ${id.padEnd(36)} | ${String(value.n).padStart(4)} | ` +
          `${value.position_mean.toFixed(0).padStart(8)} | ` +
          `${value.intercept.toFixed(1).padStart(9)} | ` +
          `${value.intercept_share.toFixed(3).padStart(9)} | ` +
          `${value.slope.toFixed(3).padStart(5)} | ` +
          `${value.pooled_sd.toFixed(1).padStart(9)}`
      )
    }
    const shares = rows.map(([, value]) => value.intercept_share)
    const slopes = rows.map(([, value]) => value.slope)
    console.log(
      `  ACROSS FORMATS  intercept share ${mean(shares).toFixed(3)} ` +
        `(min ${Math.min(...shares).toFixed(3)}, max ${Math.max(...shares).toFixed(3)})   ` +
        `slope ${mean(slopes).toFixed(3)} ` +
        `(min ${Math.min(...slopes).toFixed(3)}, max ${Math.max(...slopes).toFixed(3)})`
    )
  }

  process.exit()
}

main()
