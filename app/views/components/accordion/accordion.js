import React, { useId, useState } from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'

import './accordion.styl'

// THE APP'S DISCLOSURE. Thirteen call sites had the same three parts in the
// same order — a summary row, a chevron, and a body that shows or hides — so
// the shape is the SIGNATURE here rather than three composable sub-components.
// Owning the summary element is what lets this wire `aria-expanded`,
// `aria-controls` and the region's `aria-labelledby` itself; a compound API
// cannot do that without threading ids through every caller.
//
// CONTROLLED OR NOT, decided by whether `expanded` was passed at all. Two call
// sites hold the open state themselves because something else on the page reads
// it; the other eleven do not care and should not have to declare a useState to
// open a panel. `undefined` is the discriminator rather than a separate prop,
// so the two modes cannot both be half-configured.
//
// THE SUMMARY IS A REAL <button>, WHICH IS WHY `action` EXISTS. MUI's
// AccordionSummary is a ButtonBase and so was also a <button>, and
// settings-teams-team put our own delete Button inside it — a nested button,
// which is invalid HTML and made one click both delete and toggle. Anything
// interactive on the summary row goes in `action`, as a SIBLING of the button,
// where it cannot be swallowed by it.
//
// NO HEIGHT ANIMATION. Animating to `auto` needs a measured height, and every
// implementation of that either reads layout on each frame or lies about the
// height for the duration. Flat, like button.styl and modal.styl: the chevron
// turns over (icon.styl's `.icon--flipped`, transitioned) and the body is
// simply there or not.

export default function Accordion({
  summary,
  action,
  children,
  expanded,
  default_expanded = false,
  on_toggle,
  icon_name = 'arrow-down',
  unmount_on_collapse = false,
  className
}) {
  const [internal_expanded, set_internal_expanded] = useState(default_expanded)
  const summary_id = useId()
  const details_id = useId()

  const is_controlled = expanded !== undefined
  const is_expanded = is_controlled ? expanded : internal_expanded

  const handle_toggle = () => {
    const next = !is_expanded
    if (!is_controlled) set_internal_expanded(next)
    if (on_toggle) on_toggle(next)
  }

  // `accordion--expanded` is the open state on the ROOT. `aria-expanded` already
  // carries it, but that lives on the summary button, so a caller wanting to
  // paint the whole panel while it is open has nothing to hang a rule on —
  // league-team.styl does exactly that for the nine dashboard summaries, which
  // is the rule MUI's `.Mui-expanded` used to serve.
  const class_names = ['accordion']
  if (is_expanded) class_names.push('accordion--expanded')
  if (className) class_names.push(className)

  // `unmount_on_collapse` is what MUI's `TransitionProps={{ unmountOnExit }}`
  // was doing at the nine dashboard-team-summary-* sites: each one renders a
  // full table of every team in the league, and mounting ten of those behind
  // closed panels is the reason the flag was there.
  const render_details = is_expanded || !unmount_on_collapse

  return (
    <div className={class_names.join(' ')}>
      <div className='accordion__header'>
        <button
          type='button'
          id={summary_id}
          className='accordion__summary'
          aria-expanded={is_expanded}
          aria-controls={details_id}
          onClick={handle_toggle}
        >
          <span className='accordion__summary-content'>{summary}</span>
          <Icon
            className='accordion__chevron'
            name={icon_name}
            flipped={is_expanded}
          />
        </button>
        {action && <div className='accordion__action'>{action}</div>}
      </div>
      {render_details && (
        <div
          id={details_id}
          className='accordion__details'
          role='region'
          aria-labelledby={summary_id}
          hidden={!is_expanded}
        >
          {children}
        </div>
      )}
    </div>
  )
}

Accordion.propTypes = {
  summary: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  expanded: PropTypes.bool,
  default_expanded: PropTypes.bool,
  on_toggle: PropTypes.func,
  icon_name: PropTypes.string,
  unmount_on_collapse: PropTypes.bool,
  className: PropTypes.string
}
