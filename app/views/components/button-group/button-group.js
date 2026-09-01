import React from 'react'
import PropTypes from 'prop-types'

import './button-group.styl'

// A ROW OF BUTTONS THAT SHARE EDGES. Three call sites join two to five actions
// into one segmented control — the auction's bid stepper, the selected player's
// external links, and the player context menu in its button-group mode.
//
// IT PROPAGATES NOTHING, which is the deliberate difference from MUI's
// ButtonGroup. That component pushes `size`, `variant`, `color` and `disabled`
// down onto its children by cloning them, so a reader of the child cannot see
// what the child will render as. Here every button declares its own `small` and
// `disabled` at its own call site. Two of the three sites were already written
// that way; only auction-main-bid relied on the propagation.
//
// The paint that makes a group read as one control — the undone pair spacing,
// the squared inner corners and the seam between segments — lives in
// button.styl rather than here. See the specificity note there.

export default function ButtonGroup({ children, className }) {
  const class_names = ['button-group']
  if (className) class_names.push(className)

  return <div className={class_names.join(' ')}>{children}</div>
}

ButtonGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}
