import React from 'react'

// THE FIGURE PAINTED IN THE END ZONE: a projected distribution — a sample drawn
// as bars, the density it was drawn from as a curve over them, and the middle
// eighty per cent of it as an interval above that. The end zone is the one band
// on the page with nothing in it to compete with, so it is where the site can
// say what KIND of thing it is without a line of copy or an icon, and this is
// the figure that says it: not a chart of anything a reader is meant to read
// off, but the shape of one, which is a claim about how the site thinks.
//
// THREE MARKS, AND EACH ONE IS A DIFFERENT CLAIM. The bars say there is data,
// the curve says it is fitted rather than plotted, and the interval says the
// answer is a range rather than a number. A histogram alone said only the first
// of those, which is why this is no longer a histogram.
//
// THE HEIGHTS ARE COMPUTED, NOT DRAWN. A literal array of numbers would be a
// picture nobody could edit or check; a density function is a claim anybody can
// read. Cheap enough to run at render, and it runs once.
//
// INLINE SVG, LIKE route-diagram.js, and for the same two reasons: the sprite in
// app/index.html is a 24x24 UI-glyph surface and renders NOTHING for a name it
// does not carry, and an inline element takes no import that could move the MUI
// ratchet. It also keeps the PAINT in the stylesheet as a token rather than
// spelt into a data uri, where it would be the one colour on the page that
// cannot follow the palette.
//
// aria-hidden: it is a shape, not a chart. There is no series behind it, nothing
// to read off it, and no axis a screen reader could describe.

// A LOG-NORMAL, which is right-skewed: the mode sits below the median and the
// tail runs long to the right. That is the shape a week of fantasy scoring
// takes, and choosing it over a symmetrical bell is the difference between a
// distribution and a decorative wave — the interesting half of the curve is the
// half a bell does not have.
//
// MEDIAN_AT IS THE MEDIAN AND NOT THE MODE, which is worth stating because the
// parameter it feeds is the log-scale mean: for a log-normal, exp(mu) is the
// median exactly, and the mode falls below it at exp(mu - sigma^2). Naming it
// for the mode would have been wrong by a tenth of the width, and it is what
// lets the interval below take the median for free.
//
// Both are in axis units, which run 0 to 1 across the zone, and both are set by
// how much of the BAND they use. A tighter pair — 0.30 and 0.55 was tried — puts
// the whole distribution in the left two thirds and leaves the right third of a
// six-to-one band empty, which reads as a figure that ran out rather than as a
// tail that decays. At 0.36 and 0.62 the ninetieth percentile lands at four
// fifths of the width and the last bar is still standing, so the skew is visible
// at a glance and the band is used to its far edge.
const MEDIAN_AT = 0.36
const SPREAD = 0.62

// The drawing space. These are ratios rather than pixels — the svg is stretched
// to the zone by `preserveAspectRatio="none"`, so they set PROPORTIONS and
// nothing about size.
const WIDTH = 444
const HEIGHT = 100

// BAR_WIDTH IS MOST OF THE PITCH, and that is what makes this a histogram. At a
// fifth of it the bars were hairlines with air between them and the figure read
// as a comb or a waveform — a row of separate marks rather than a curve made of
// adjacent bins. Bins abut; the gap is a hairline of relief and nothing more.
const BAR_COUNT = 37
const BAR_WIDTH = 9

// The tallest bar stands at three quarters of the depth rather than at the top,
// and the quarter it gives up is what the interval is drawn in. It also stops
// the peak butting into the goal line, which read as a figure cropped by the
// boundary rather than as one composed inside it.
const PEAK_HEIGHT = 74

// The floor under the tail, deliberately below where the density lands. Without
// a floor the last bars round to nothing and the row stops early, which reads as
// a figure that was cropped; with a floor set ABOVE the tail — 5 was tried — the
// last third of the bars clamp to one height and the tail becomes a flat band, a
// baseline, which is the one thing a decaying tail must not look like.
const MIN_HEIGHT = 2

// THE BARS ARE A SAMPLE AND THE CURVE IS THE MODEL, and the scatter between them
// is the whole reason the curve is worth drawing. Bar tops sitting exactly on
// the curve make the curve an outline of the bars — one mark drawn twice — and
// the pair only reads as data-under-a-fit when the data misses.
//
// THE SCATTER IS SQUARE-ROOT SCALED, which is the part that has to be right.
// Counting noise in a bin goes as the square root of the count, so a tall bin
// deviates more in absolute terms and less in relative terms — flat noise would
// have made the tail as ragged as the peak, which is what a figure looks like
// when someone has added jitter rather than sampled anything.
const SCATTER = 0.9

// Deterministic, so the figure is the same drawing on every render and in every
// browser. Seeding a real generator would be a dependency and a stored seed for
// a decoration; the fractional part of a large sine is the cheapest hash that
// decorrelates adjacent indices, which is all that is being asked of it.
const scatter_at = (index) => {
  const wave = Math.sin((index + 1) * 12.9898) * 43758.5453
  return (wave - Math.floor(wave)) * 2 - 1
}

const log_normal_density = (x) => {
  const mu = Math.log(MEDIAN_AT)
  const exponent = -((Math.log(x) - mu) ** 2) / (2 * SPREAD ** 2)
  return Math.exp(exponent) / (x * SPREAD * Math.sqrt(2 * Math.PI))
}

// The peak of the density itself, at the mode. Taken in closed form rather than
// by scanning the samples so that the curve and the bars are normalised by the
// same number — sampled separately they would disagree wherever the bar centres
// happened to straddle the mode, and the curve would sit a little off the bars
// for reasons nothing in the file would explain.
const PEAK_DENSITY = log_normal_density(MEDIAN_AT * Math.exp(-(SPREAD ** 2)))

const height_of = (x) => (log_normal_density(x) / PEAK_DENSITY) * PEAK_HEIGHT

// The bar pitch, and the mapping from axis units to the drawing space that goes
// with it. Everything else in the figure — the curve, the interval, the median —
// is placed through `x_of` so that it lands on the bars rather than near them.
const PITCH = (WIDTH - BAR_COUNT * BAR_WIDTH) / (BAR_COUNT - 1) + BAR_WIDTH
const x_of = (axis_position) =>
  (axis_position * BAR_COUNT - 0.5) * PITCH + BAR_WIDTH / 2

// The bar centres, which are also the domain the curve is drawn over: a fitted
// curve runs from the first observation to the last, not off the ends of the
// data into space.
const FIRST_CENTRE = 0.5 / BAR_COUNT
const LAST_CENTRE = (BAR_COUNT - 0.5) / BAR_COUNT

const bars = () =>
  Array.from({ length: BAR_COUNT }, (_, index) => {
    const centre = (index + 0.5) / BAR_COUNT
    const fitted = height_of(centre)
    const sampled = fitted + SCATTER * Math.sqrt(fitted) * scatter_at(index)
    const height = Math.min(HEIGHT, Math.max(MIN_HEIGHT, sampled))

    return { x: index * PITCH, y: HEIGHT - height, height }
  })

// Sampled far more finely than the bars, since this is the continuous half of
// the pair and a polyline that showed its own vertices would undo that.
const CURVE_SAMPLES = 160

const curve = () =>
  Array.from({ length: CURVE_SAMPLES }, (_, index) => {
    const axis_position =
      FIRST_CENTRE +
      (index / (CURVE_SAMPLES - 1)) * (LAST_CENTRE - FIRST_CENTRE)
    const command = index === 0 ? 'M' : 'L'
    return `${command} ${x_of(axis_position).toFixed(2)} ${(HEIGHT - height_of(axis_position)).toFixed(2)}`
  }).join(' ')

// THE MIDDLE EIGHTY PER CENT, drawn as an interval above the distribution it
// belongs to. This is the mark that moves the figure from "we have data" to "we
// give you a range", and it is the reason the peak was pulled down to leave a
// band clear at the top.
//
// The quantiles are closed form, which for a log-normal they are: the p-th is
// median * exp(sigma * z_p), so the only thing needed from the normal is z at
// the tenth, and the interval is symmetric in log space and lopsided on the page
// exactly as the distribution under it is.
const Z_AT_TENTH = 1.2815515655446004
const LOW = MEDIAN_AT * Math.exp(-SPREAD * Z_AT_TENTH)
const HIGH = MEDIAN_AT * Math.exp(SPREAD * Z_AT_TENTH)

const INTERVAL_Y = 13
const CAP_RADIUS = 5
const MEDIAN_RADIUS = 8

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

      <path
        className='landing__end-curve'
        d={curve()}
        vectorEffect='non-scaling-stroke'
      />

      {/* The interval: a rule from the tenth to the ninetieth, capped at both
          ends, with a taller tick at the median. */}
      <g className='landing__end-interval'>
        <path
          d={`M ${x_of(LOW)} ${INTERVAL_Y} H ${x_of(HIGH)}`}
          vectorEffect='non-scaling-stroke'
        />
        <path
          d={`M ${x_of(LOW)} ${INTERVAL_Y - CAP_RADIUS} V ${INTERVAL_Y + CAP_RADIUS}`}
          vectorEffect='non-scaling-stroke'
        />
        <path
          d={`M ${x_of(HIGH)} ${INTERVAL_Y - CAP_RADIUS} V ${INTERVAL_Y + CAP_RADIUS}`}
          vectorEffect='non-scaling-stroke'
        />
        <path
          d={`M ${x_of(MEDIAN_AT)} ${INTERVAL_Y - MEDIAN_RADIUS} V ${INTERVAL_Y + MEDIAN_RADIUS}`}
          vectorEffect='non-scaling-stroke'
        />
      </g>
    </svg>
  )
}
