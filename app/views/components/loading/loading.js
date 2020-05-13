import React from 'react'

import LoadingIndicator from '@components/loading-indicator'

import './loading.styl'

const Loading = ({
  loading,
  onClick
}) => {
  if (loading) {
    return <div className='loading'><LoadingIndicator /></div>
  }

  return null
}

export default Loading
