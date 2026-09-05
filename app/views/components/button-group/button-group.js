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
//
// EVERY DIRECT CHILD MUST BE A `.button`, and this is the one rule here that
// fails silently. That paint is written as `.button-group > .button` plus a
// `+ .button` adjacency, so a wrapper div in a segment slot is reached by none
// of it: the wrapped button keeps its full radius and its own hover shadow,
// and the segment AFTER the wrapper loses the -1px and the seam border,
// because its previous sibling is no longer a button. Nothing errors, nothing
// is missing from the DOM, and no stylesheet changed — so it reads as a CSS
// regression with no CSS commit behind it. Shipped 2026-09-04 in the auction
// bid bar, where a new control was added by wrapping it and the existing
// button together and the wrapper was what rendered as the segment. A control
// that is not a segment goes BESIDE the group; the row around it carries the
// gap. player-context-menu.js states the same rule for its own note.

export default function ButtonGroup({ children, className }) {
  const class_names = ['button-group']
  if (className) class_names.push(className)

  return <div className={class_names.join(' ')}>{children}</div>
}

ButtonGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}
