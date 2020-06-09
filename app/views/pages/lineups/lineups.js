import React from 'react'

import Roster from '@components/roster'
import PageLayout from '@layouts/page'

export default function () {
  const { roster } = this.props
  const body = (
    <div>
      <Roster roster={roster} />
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
