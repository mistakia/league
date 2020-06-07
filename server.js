const debug = require('debug')
const logger = debug('server')

const db = require('./db')
const server = require('./api')
const config = require('./config')

const main = async () => {
  // await db.migrate.latest()
  await db.seed.run()
  const port = config.port || 8082
  server.listen(port, () => logger(`API listening on port ${port}`))
}

try {
  main()
} catch (err) {
  // TODO move to stderr
  logger(err)
}
