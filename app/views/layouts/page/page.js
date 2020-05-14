import React from 'react'

import './page.styl'

export const PageLayout = ({ body, menu, scroll }) => (
  <section className='page'>
    <div className={'page__body' + (scroll ? ' scroll' : '')}>{body}</div>
    {menu && <div className='page__menu'>{menu}</div>}
  </section>
)

export default PageLayout
