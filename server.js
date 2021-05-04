const debug = require('debug')
const logger = debug('server')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const server = require('./api')
const config = require('./config')
const db = require('./db')

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
