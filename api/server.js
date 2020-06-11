const https = require('https')
const http = require('http')
const fs = require('fs')

const WebSocket = require('ws')
const express = require('express')
const morgan = require('morgan-debug')
const bodyParser = require('body-parser')
const compression = require('compression')
const extend = require('deep-extend')
const debug = require('debug')
const logger = debug('api')
const jwt = require('express-jwt')

const config = require('../config')
const routes = require('./routes')
const db = require('../db')
const sockets = require('./sockets')

const defaults = {}
const options = extend(defaults, config)
const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

if (IS_DEV) {
  debug.enable('*')
} else if (IS_PROD) {
  debug.enable('api*,knex:query')
}

const api = express()

api.locals.db = db
api.locals.config = config
api.locals.logger = logger

api.disable('x-powered-by')
api.use(compression())
api.use(morgan('api', 'combined'))
api.use(bodyParser.json())

api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', IS_DEV ? 'http://localhost:1212' : '*')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept')
  next()
})

if (options.ssl) {
  api.use(function (req, res, next) {
    if (!req.secure) {
      res.redirect('https://' + req.host + req.url)
    } else {
      next()
    }
  })
}

api.use('/api/auth', routes.auth)
api.use(jwt(config.jwt))
api.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
})
api.use('/api/me', routes.me)
api.use('/api/players', routes.players)
api.use('/api/teams', routes.teams)
api.use('/api/leagues', routes.leagues)

const createServer = () => {
  if (!options.ssl) {
    return http.createServer(api)
  }

  const sslOptions = {
    key: fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert)
  }
  return https.createServer(sslOptions, api)
}

const server = createServer()
const wss = new WebSocket.Server({ clientTracking: false, noServer: true })

/* server.on('upgrade', function(request, socket, head) {
 *   sessionParser(request, {}, () => {
 *     if (!request.session.userId) {
 *       socket.destroy()
 *       return
 *     }
 *
 *     console.log('Session is parsed!')
 *
 *     wss.handleUpgrade(request, socket, head, function(ws) {
 *       wss.emit('connection', ws, request)
 *     })
 *   })
 * })
 *  */

sockets(wss)

module.exports = server
