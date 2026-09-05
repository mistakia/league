import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import Tooltip from '@components/tooltip'

import './play-film-link.styl'

// An anchor rather than a button: this leaves the app, so middle-click and
// open-in-new-tab have to keep working, and neither survives an onClick handler
// on a <button>. `rel` is required alongside target='_blank' -- without it the
// opened page gets a live `window.opener` handle back into the SPA.
//
// NFL Pro is told nothing about where the click came from. `referrerPolicy` and
// the `noreferrer` in `rel` are BOTH set deliberately, and they are not
// redundant: `rel` also carries the opener guarantee and is the only half that
// applies to a middle-click or a context-menu "open in new tab", while the
// attribute is the half that survives a `rel` a future edit trims. Without
// either, the browser's default cross-origin policy sends `https://xo.football/`
// on every film click.
export default function PlayFilmLink({ url }) {
  if (!url) return null

  return (
    <Tooltip title='Watch on NFL Pro'>
      <a
        className='play-film-link'
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        referrerPolicy='no-referrer'
        aria-label='Watch this play on NFL Pro'
      >
        <Icon name='play' small />
      </a>
    </Tooltip>
  )
}

PlayFilmLink.propTypes = {
  url: PropTypes.string
}
