import debug from 'debug'

import { get_websocket_connection, get_wagers } from './draftkings-api.mjs'

const log = debug('draft-kings:wagers')

export const get_all_wagers = async ({
  authorization,
  placed_after = null,
  placed_before = null
} = {}) => {
  if (!authorization) {
    throw new Error('missing authorization')
  }

  const wss = await get_websocket_connection({ authorization })
  wss.on('error', (error) => {
    log(error)
  })
  const wagers = await get_wagers({ wss, placed_after, placed_before })

  wss.terminate()

  return wagers
}
