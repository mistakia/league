import React from 'react'
import { createRoot } from 'react-dom/client'
// import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import 'whatwg-fetch'

import Root from '@views/root'

import 'react-virtualized/styles.css'

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root')
  const root = createRoot(rootElement)
  root.render(<Root />)
})
