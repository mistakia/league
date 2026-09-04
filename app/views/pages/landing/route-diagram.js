import React from 'react'

// THE SITE'S MARK, drawn to match `static/images/icon.png` rather than to
// riff on it: the same two football routes, at the icon's own proportions —
// a go route straight up the field, and a shorter one breaking off at
// forty-five degrees. Nothing is added and nothing is stylised. If the two
// are ever seen together, they have to read as the same object.
//
// GEOMETRY IS TAKEN FROM THE 512x512 ICON'S OWN COORDINATE SPACE, so the
// numbers below can be checked against the file rather than trusted: both
// stems foot on y=425, the go route's stem runs to y=115 with its head above
// that, and the angled route breaks at y=313 and travels up-left to its head.
// The viewBox then CROPS to the ink with a little air, which is what lets the
// mark be sized by width alone in CSS without a transparent margin baked in.
//
// AN EARLIER VERSION OF THIS FILE DREW A SIX-ROUTE TREE. It was a different
// drawing that happened to contain the icon, which is not the same thing as
// the icon, and it read as a diagram about football rather than as the site's
// own mark.
//
// INLINE SVG, NOT AN ICON COMPONENT. `@components/icon` renders `<symbol>`
// ids from the sprite in app/index.html, which is a 24x24 UI-glyph surface —
// and a name with no symbol there renders NOTHING rather than erroring.
// Inline also means no import, so nothing here can move the MUI ratchet.
//
// aria-hidden: it is the wordmark's picture and carries nothing the copy does
// not already say.

// The arrowhead, in the icon's proportions: a solid triangle whose tip is the
// route's end point. `rotation` is degrees clockwise from pointing up.
const HALF_WIDTH = 30
const HEIGHT = 34

const head_points = (x, y) =>
  `${x},${y} ${x - HALF_WIDTH},${y + HEIGHT} ${x + HALF_WIDTH},${y + HEIGHT}`

export default function RouteDiagram() {
  return (
    <svg
      className='route-diagram'
      viewBox='118 74 226 372'
      aria-hidden='true'
      focusable='false'
    >
      {/* The go route, straight up. */}
      <path className='route-diagram__stroke' d='M 290 425 V 122' />
      <polygon
        className='route-diagram__fill'
        points={head_points(290, 88)}
        transform='rotate(0 290 88)'
      />

      {/* The route that breaks up and away at forty-five degrees. */}
      <path className='route-diagram__stroke' d='M 223 425 V 313 L 165 255' />
      <polygon
        className='route-diagram__fill'
        points={head_points(158, 248)}
        transform='rotate(-45 158 248)'
      />
    </svg>
  )
}
