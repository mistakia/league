import React from 'react'

import PageLayout from '@layouts/page'

import './draft.styl'

export default function () {
  const body = (
    <div className='draft'>
      <div className='draft__players'></div>
      <div className='draft__main'>
        <div className='draft__main-board'>
        </div>
        <div className='draft__main-trade'>
        </div>
      </div>
      <div className='draft__side'>
        <div className='draft__side-top'>
          <strong>Pick #1 (1.01)</strong>
          <h2>On The Clock</h2>
        </div>
        <div className='draft__side-main'>

        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
