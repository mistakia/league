import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import PQueue from 'p-queue'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import config from '#config'
import { wait } from '#utils'
import isMain from './is-main.mjs'

const queue = new PQueue({ concurrency: 1 })
const cache_path = path.join(os.homedir(), '/sportradar')
let last_request

const argv = yargs(hideBin(process.argv)).argv
const log = debug('sportradar')
debug.enable('sportradar')

export const getPlayer = ({ sportradar_id }) =>
  queue.add(async () => {
    const api_path = `/players/${sportradar_id}/profile.json`
    const full_path = path.join(cache_path, api_path)
    if (fs.pathExistsSync(full_path)) {
      return fs.readJsonSync(full_path)
    }

    const current_time = process.hrtime.bigint()
    if (last_request && current_time - last_request < 2e9) {
      await wait(2000)
    }
    last_request = process.hrtime.bigint()

    const url = `https://api.sportradar.us/nfl/official/trial/v7/en${api_path}?api_key=${config.sportradar_api}`
    const res = await fetch(url)
    const data = await res.json()

    fs.ensureFileSync(full_path)
    fs.writeJsonSync(full_path, data, { spaces: 2 })

    return data
  })

const main = async () => {
  let error
  try {
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

if (isMain(import.meta.url)) {
  main()
}
