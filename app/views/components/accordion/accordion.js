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
// IT OWNS ITS OWN OPEN STATE, and there is no controlled mode. An earlier
// version had one, on the assumption that the two call sites holding the state
// in a parent needed to read it there. Neither does — `open` in
// settings-section and `this.state.open` in settings-teams-team were each read
// at exactly one place, the accordion itself — so the controlled path was an
// API axis with no consumer, which is the same mistake as the three button
// variants button.styl records deleting rather than repairing.
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
  default_expanded = false,
  icon_name = 'arrow-down',
  unmount_on_collapse = false,
  className
}) {
  const [is_expanded, set_is_expanded] = useState(default_expanded)
  const summary_id = useId()
  const details_id = useId()

  const handle_toggle = () => set_is_expanded(!is_expanded)

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
  default_expanded: PropTypes.bool,
  icon_name: PropTypes.string,
  unmount_on_collapse: PropTypes.bool,
  className: PropTypes.string
}
