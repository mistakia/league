import React from 'react'
import PropTypes from 'prop-types'

import LoadingIndicator from '@components/loading-indicator'

import './loading.styl'

const Loading = ({ loading, onClick }) => {
  if (loading) {
    return (
      <div className='loading'>
        <LoadingIndicator />
      </div>
    )
  }

  return null
}

Loading.propTypes = {
  loading: PropTypes.bool,
  onClick: PropTypes.func
}

export default Loading
