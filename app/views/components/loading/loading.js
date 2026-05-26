import React from 'react'
import PropTypes from 'prop-types'

import './loading.styl'

const Loading = ({ loading }) => {
  if (loading) {
    return (
      <div className='loading'>
        <div className='loading__spinner' role='progressbar' aria-label='loading' />
      </div>
    )
  }

  return null
}

Loading.propTypes = {
  loading: PropTypes.bool
}

export default Loading
