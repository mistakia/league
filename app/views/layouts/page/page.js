import React from 'react'
import PropTypes from 'prop-types'

import './page.styl'

export const PageLayout = ({ body, scroll, head }) => (
  <section className='page'>
    {head && <div className='page__head'>{head}</div>}
    <div className={'page__body' + (scroll ? ' scroll' : '')}>{body}</div>
  </section>
)

PageLayout.propTypes = {
  body: PropTypes.element,
  scroll: PropTypes.bool,
  head: PropTypes.element
}

export default PageLayout
