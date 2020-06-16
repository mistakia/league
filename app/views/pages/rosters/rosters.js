import React from 'react'

import PageLayout from '@layouts/page'

import './rosters.styl'

export default function () {
  const rosters = []
  const body = (
    <div className='rosters'>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
