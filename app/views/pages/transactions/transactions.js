import React from 'react'

import PageLayout from '@layouts/page'

import './transactions.styl'

export default function () {
  const body = (
    <div className='transactions'>
      <div className='transactions__filter'>
        {/* Team Filter */}
        {/* Transaction Type Filter */}
      </div>
      <div className='transactions__body'>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
