import React from 'react'
import PropTypes from 'prop-types'

import './page.styl'

export const PageLayout = ({ body, menu, scroll, head }) => (
  <section className='page'>
    <div className='page__main'>
      {head && <div className='page__head'>{head}</div>}
      <div className={'page__body' + (scroll ? ' scroll' : '')}>{body}</div>
    </div>
    {menu && <div className='page__menu'>{menu}</div>}
  </section>
)

PageLayout.propTypes = {
  body: PropTypes.element,
  menu: PropTypes.element,
  scroll: PropTypes.bool,
  head: PropTypes.element
}

export default PageLayout
