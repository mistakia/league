import React from 'react'
import PropTypes from 'prop-types'
import CircularProgress from '@material-ui/core/CircularProgress'

import './loading.styl'

const Loading = ({ loading }) => {
  if (loading) {
    return (
      <div className='loading'>
        <CircularProgress />
      </div>
    )
  }

  return null
}

Loading.propTypes = {
  loading: PropTypes.bool
}

export default Loading
