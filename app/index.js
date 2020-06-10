import React from 'react'
import { render } from 'react-dom'
import { AppContainer } from 'react-hot-loader'
// import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import 'whatwg-fetch'

import Root from '@views/root'

import 'react-virtualized/styles.css'

document.addEventListener('DOMContentLoaded', () =>
  render(
    <AppContainer>
      <Root />
    </AppContainer>,
    document.getElementById('root')
  )
)
