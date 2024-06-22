import React from 'react'

import Lineup from '@components/lineup'
import PageLayout from '@layouts/page'

export default function LineupsPage() {
  const { roster } = this.props
  const body = (
    <div className='league-container large'>
      <Lineup roster={roster} />
    </div>
  )

  return <PageLayout body={body} scroll />
}
