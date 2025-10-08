import React from 'react'
import { createRoot } from 'react-dom/client'
// import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import 'whatwg-fetch'

import Root from '@views/root'
import { constants } from '@libs-shared'

import 'react-virtualized-compat/styles.css'

document.addEventListener('DOMContentLoaded', () => {
  const root_element = document.getElementById('root')
  const root = createRoot(root_element)
  root.render(<Root />)

  console.log(`Year: ${constants.year}`)
  console.log(`Week: ${constants.week}`)
  console.log(`Fantasy Season Week: ${constants.fantasy_season_week}`)
  console.log(`Timezone: ${constants.season.now.format('z')}`)
  console.log(`EST Offset: ${constants.season.now.utcOffset() / 60} hours`)
  console.log(
    `Browser Native Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  )
})
