/* global IS_DEV, MACHINE_IP */

// MACHINE_IP is defined in webpack.config.dev.babel.mjs
// it is used instead of localhost to allow the app to be accessed from
// other devices on the same network (i.e. testing on a mobile phone)

export const BASE_URL = IS_DEV
  ? 'http://' + MACHINE_IP + ':8082'
  : 'https://xo.football'

export const API_URL = `${BASE_URL}/api`
export const WS_URL = IS_DEV
  ? 'ws://' + MACHINE_IP + ':8082'
  : 'wss://xo.football'
// Repository markdown is served same-origin from the deploy tree — see the
// /docs mount in api/index.mjs (dev is served by webpack devServer).
export const DOCS_URL = '/docs'

export const README_URL = '/docs/README.md'

export const TRANSACTIONS_PER_LOAD = 100

export const DISCORD_URL = 'https://discord.gg/azSX97Qj9Z'
