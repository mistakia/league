import React from 'react'
import { createRoot } from 'react-dom/client'
import { current_season } from '@constants'
// import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import 'whatwg-fetch'

import Root from '@views/root'

import 'react-virtualized-compat/styles.css'

document.addEventListener('DOMContentLoaded', () => {
  const root_element = document.getElementById('root')
  const root = createRoot(root_element)
  root.render(<Root />)

  console.log(`Year: ${current_season.year}`)
  console.log(`Week: ${current_season.week}`)
  console.log(`Fantasy Season Week: ${current_season.fantasy_season_week}`)
  console.log(`Timezone: ${current_season.now.format('z')}`)
  console.log(`EST Offset: ${current_season.now.utcOffset() / 60} hours`)
  console.log(
    `Browser Native Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  )
})
