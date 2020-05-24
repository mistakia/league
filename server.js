const debug = require('debug')
const logger = debug('server')

const server = require('./api')
const config = require('./config')

const port = config.port || 8082
server.listen(port, () => logger(`API listening on port ${port}`))
