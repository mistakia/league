import React from 'react'
import { createRoot } from 'react-dom/client'
// import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import 'whatwg-fetch'

import Root from '@views/root'
import { constants } from '@common'

import 'react-virtualized/styles.css'

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root')
  const root = createRoot(rootElement)
  root.render(<Root />)

  console.log(`Year: ${constants.year}`)
  console.log(`Week: ${constants.week}`)
  console.log(`Fantasy Season Week: ${constants.fantasy_season_week}`)
})
