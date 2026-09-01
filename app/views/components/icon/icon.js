import React from 'react'
import PropTypes from 'prop-types'

import './icon.styl'

// THE APP'S ONLY ICON. Every glyph is a <symbol> in the inline sprite at the
// top of app/index.html, referenced by id — there is no icon package and no
// per-icon import.
//
// A NAME WITH NO SYMBOL RENDERS NOTHING, silently: <use> on a missing id is not
// an error in any browser, so a typo is an invisible control rather than a
// crash. test/app.icon-sprite-coverage.spec.mjs is the guard, and it anchors on
// the <Icon element rather than on a bare name= token — the loose pattern also
// matches <input name='username'> and reads as three icons that do not exist.
//
// `small` and `flipped` are props rather than caller-supplied classes because
// they are the whole vocabulary of variation across the tree: two sizes, and a
// chevron that turns over when the thing it points at is open. Every disclosure
// control here needs the second one, so it lives on the icon rather than being
// redrawn as a rotate rule in each caller's stylesheet.
function Icon({ className, name, small, flipped }) {
  const class_names = ['icon']

  if (small) class_names.push('icon--small')
  if (flipped) class_names.push('icon--flipped')
  if (className) class_names.push(className)

  return (
    <svg className={class_names.join(' ')}>
      <use xlinkHref={`#icon-${name}`} />
    </svg>
  )
}

Icon.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string.isRequired,
  small: PropTypes.bool,
  flipped: PropTypes.bool
}

export default Icon
