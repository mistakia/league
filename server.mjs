import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import server from './api/index.mjs'
import config from '#config'
import db from '#db'
import { create_logger } from '#libs-shared/log.mjs'
import { install_process_handlers } from '#libs-server/install-process-handlers.mjs'

const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

const logger = debug('server')
const argv = yargs(hideBin(process.argv)).argv

install_process_handlers({
  service_name: 'league-server',
  logger: create_logger('server:process', { service: 'league-server' })
})

if (IS_DEV) {
  debug.enable(
    'server,api*,notifications*,auction*,scoreboard*,express:*,knex:*'
  )
} else if (IS_PROD) {
  debug.enable('api*,notifications*,auction*,scoreboard*,data-view-socket')
} else {
  debug.enable('*')
}

const main = async () => {
  const port = config.port || 8082
  server.listen(port, () => logger(`API listening on port ${port}`))

  if (argv.clean && process.env.NODE_ENV === 'development') {
    await db.seed.run()
  }
}

try {
  main()
} catch (err) {
  // TODO move to stderr
  logger(err)
}
