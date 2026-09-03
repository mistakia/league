import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import server from './api/index.mjs'
import config from '#config'
import db from '#db'
import { create_logger } from '#libs-shared/log.mjs'
import { install_process_handlers } from '#libs-server/install-process-handlers.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
import { start_generation_drainer_if_configured } from '#libs-server/data-views/generation/generation-drainer.mjs'

const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

const logger = debug('server')
const argv = yargs(hideBin(process.argv)).argv

install_process_handlers({
  service_name: 'league-server',
  logger: create_logger('server:process', { service: 'league-server' })
})

if (IS_DEV) {
  enable_debug_namespaces(
    'server,api*,notifications*,auction*,scoreboard*,express:*,knex:*'
  )
} else if (IS_PROD) {
  enable_debug_namespaces(
    'api*,notifications*,auction*,scoreboard*,data-view-socket'
  )
} else {
  enable_debug_namespaces('*')
}

const main = async () => {
  const port = config.port || 8082
  server.listen(port, () => logger(`API listening on port ${port}`))

  // The data-view generation drainer lives in the API process, and that is the
  // one place it can live: this is already the process that enqueues the jobs
  // and serves the socket the results come back over, so a separate worker
  // would be a second deploy unit and a second thing to notice had died.
  //
  // It starts only where it can actually dispatch (see
  // describe_drainer_readiness) and says which way it went either way, so a
  // production host where generation silently never drains is not a state this
  // can reach quietly.
  const drainer = start_generation_drainer_if_configured({
    report: (message) => logger(message)
  })
  if (drainer.started) {
    process.on('SIGTERM', drainer.stop)
  }

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
