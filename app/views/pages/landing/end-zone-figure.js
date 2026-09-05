import React from 'react'

// THE FIGURE PAINTED IN THE END ZONE: a distribution, drawn as a row of standing
// bars. The end zone is the one band on the page with no content to compete
// with, so it is where the site can say what kind of thing it is without a line
// of copy or an icon — and a histogram is the figure that says analytics the way
// the yard numbers say field.
//
// THE HEIGHTS ARE COMPUTED, NOT DRAWN. A literal array of thirty-seven numbers
// would be a picture nobody could edit or check; a density function is a claim
// anybody can read, and it is the claim that matters here — see the log-normal
// below. Cheap enough to run at render: thirty-seven exponentials, once.
//
// INLINE SVG, LIKE route-diagram.js, and for the same two reasons: the sprite in
// app/index.html is a 24x24 UI-glyph surface and renders NOTHING for a name it
// does not carry, and an inline element takes no import that could move the MUI
// ratchet. It also keeps the PAINT in the stylesheet as $prose_rule rather than
// spelt into a data uri, where it would be the one colour on the page that
// cannot follow its token.
//
// aria-hidden: it is a shape, not a chart. There is no series behind it, nothing
// to read off it, and no axis a screen reader could describe.

// A LOG-NORMAL DENSITY, which is right-skewed: the mode sits below the mean and
// the tail runs long to the right. That is the shape a week of fantasy scoring
// takes, and choosing it over a symmetrical bell is the difference between a
// distribution and a decorative wave — the interesting half of the curve is the
// half a bell does not have.
//
// `mode_at` and `spread` are in the same units as the axis, which runs 0 to 1
// across the zone. The mode at 0.30 leaves two thirds of the width for the tail,
// which is what makes the skew visible at a glance rather than on inspection.
const BAR_COUNT = 37
const MODE_AT = 0.3
const SPREAD = 0.55

// The drawing space. WIDTH and HEIGHT are ratios rather than pixels — the svg is
// stretched to the zone by `preserveAspectRatio="none"`, so these set the bars'
// PROPORTIONS and nothing about their size.
//
// BAR_WIDTH IS MOST OF THE PITCH, and that is what makes this a histogram. At a
// fifth of it the bars were hairlines with air between them and the figure read
// as a comb or a waveform — a row of separate marks rather than a curve made of
// adjacent bins. Bins abut; the gap is a hairline of relief and nothing more.
const WIDTH = 444
const HEIGHT = 100
const BAR_WIDTH = 9

// The floor under the tail, and it is deliberately below where the density
// lands: without a floor the last bars round to nothing and the row stops early,
// which reads as a figure that was cropped rather than as one that decays, but a
// floor set ABOVE the tail is worse. At 5 it clamped the last third of the bars
// to one height and the tail became a flat band — a baseline, which is the one
// thing a decaying tail must not look like. At 2 the clamp only catches bars
// that would otherwise vanish, and the decay is the density's own.
const MIN_HEIGHT = 2

const log_normal_density = (x) => {
  const mu = Math.log(MODE_AT)
  const exponent = -((Math.log(x) - mu) ** 2) / (2 * SPREAD ** 2)
  return Math.exp(exponent) / (x * SPREAD * Math.sqrt(2 * Math.PI))
}

// Sampled at each bar's midpoint and scaled so the tallest bar stands the full
// depth of the zone. Normalising to the peak rather than to the density's own
// units is what makes the figure independent of the constants above: change the
// spread and the curve changes shape without changing how tall it is.
const bars = () => {
  const densities = Array.from({ length: BAR_COUNT }, (_, index) =>
    log_normal_density((index + 0.5) / BAR_COUNT)
  )
  const peak = Math.max(...densities)
  const pitch = (WIDTH - BAR_COUNT * BAR_WIDTH) / (BAR_COUNT - 1) + BAR_WIDTH

  return densities.map((density, index) => {
    const height = Math.max(MIN_HEIGHT, (density / peak) * HEIGHT)
    return { x: index * pitch, y: HEIGHT - height, height }
  })
}

export default function EndZoneFigure() {
  return (
    <svg
      className='landing__end-figure'
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio='none'
      aria-hidden='true'
      focusable='false'
    >
      {bars().map((bar) => (
        <rect
          key={bar.x}
          className='landing__end-bar'
          x={bar.x}
          y={bar.y}
          width={BAR_WIDTH}
          height={bar.height}
        />
      ))}
    </svg>
  )
}
