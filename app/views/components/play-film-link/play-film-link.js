import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import Tooltip from '@components/tooltip'

import './play-film-link.styl'

// An anchor rather than a button: this leaves the app, so middle-click and
// open-in-new-tab have to keep working, and neither survives an onClick handler
// on a <button>. `rel` is required alongside target='_blank' -- without it the
// opened page gets a live `window.opener` handle back into the SPA.
export default function PlayFilmLink({ url }) {
  if (!url) return null

  return (
    <Tooltip title='Watch on NFL Pro'>
      <a
        className='play-film-link'
        href={url}
        target='_blank'
        rel='noopener noreferrer'
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
