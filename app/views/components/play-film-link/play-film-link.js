import React from 'react'
import PropTypes from 'prop-types'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

import './play-film-link.styl'

export default function PlayFilmLink({ url }) {
  if (!url) return null

  return (
    <Tooltip title='Watch on NFL Pro'>
      <IconButton
        className='play-film-link'
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        size='small'
        aria-label='Watch this play on NFL Pro'
      >
        <PlayCircleOutlineIcon fontSize='small' />
      </IconButton>
    </Tooltip>
  )
}

PlayFilmLink.propTypes = {
  url: PropTypes.string
}
