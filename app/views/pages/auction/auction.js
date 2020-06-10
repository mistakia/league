import React from 'react'

import PageLayout from '@layouts/page'

import './auction.styl'

export default function () {
  const body = (
    <div className='auction'>
      <div className='auction__players'></div>
      <div className='auction__main'>
        <div className='auction__main-bid'></div>
        <div className='auction__main-board'></div>
      </div>
      <div className='auction__log'></div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
