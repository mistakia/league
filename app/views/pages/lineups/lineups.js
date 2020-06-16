import React from 'react'

import Lineup from '@components/lineup'
import PageLayout from '@layouts/page'

export default function () {
  const { roster } = this.props
  const body = (
    <div>
      <Lineup roster={roster} />
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
