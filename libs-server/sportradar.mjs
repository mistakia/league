import PQueue from 'p-queue'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import config from '#config'
import { wait } from '#libs-server'
import is_main from './is-main.mjs'
import * as cache from './cache.mjs'

const queue = new PQueue({ concurrency: 1 })
let last_request

const log = debug('sportradar')
debug.enable('sportradar')

export const getPlayer = ({ sportradar_id }) =>
  queue.add(async () => {
    const api_path = `players/${sportradar_id}/profile.json`
    const cache_key = `/sportradar/${api_path}`
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }

    const current_time = process.hrtime.bigint()
    if (last_request && current_time - last_request < 2e9) {
      await wait(2000)
    }
    last_request = process.hrtime.bigint()

    const url = `https://api.sportradar.us/nfl/official/trial/v7/en/${api_path}?api_key=${config.sportradar_api}`
    const res = await fetch(url)
    const data = await res.json()

    if (res.ok) {
      await cache.set({ key: cache_key, value: data })
    }

    return data
  })

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('id', {
      describe: 'Sportradar player ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    if (!argv.id) {
      log('missing --id')
      process.exit()
    }

    const data = await getPlayer({ sportradar_id: argv.id })
    log(data)
  } catch (err) {
    error = err
    log(error)
  }
}

if (is_main(import.meta.url)) {
  main()
}
