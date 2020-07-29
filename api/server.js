const https = require('https')
const http = require('http')
const fs = require('fs')
const url = require('url')
const path = require('path')

const WebSocket = require('ws')
const express = require('express')
const morgan = require('morgan-debug')
const bodyParser = require('body-parser')
const compression = require('compression')
const extend = require('deep-extend')
const debug = require('debug')
const logger = debug('api')
const jwt = require('jsonwebtoken')
const expressJwt = require('express-jwt')
const slowDown = require('express-slow-down')

const config = require('../config')
const routes = require('./routes')
const db = require('../db')
const sockets = require('./sockets')

const defaults = {}
const options = extend(defaults, config)
const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

if (IS_DEV) {
  debug.enable('api,knex:query,knex:bindings,notifications*')
} else if (IS_PROD) {
  debug.enable('api*,knex:query,knex:bindings,notifications*')
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
  res.header('Access-Control-Allow-Origin', config.url)
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT')
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

const speedLimiter = slowDown({
  windowMs: 5 * 60 * 1000,
  delayAfter: 5,
  delayMs: 500,
  maxDelayMs: 2500
})

api.use('/api/*', expressJwt(config.jwt), (err, req, res, next) => {
  if (err.code === 'invalid_token') return next()
  return next(err)
})
api.use('/api/stats', speedLimiter, routes.stats)
api.use('/api/players', speedLimiter, routes.players)
api.use('/api/plays', speedLimiter, routes.plays)
api.use('/api/sources', routes.sources)
api.use('/api/auth', routes.auth)
api.use('/api/*', (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
})
api.use('/api/me', routes.me)
api.use('/api/projections', routes.projections)
api.use('/api/teams', routes.teams)
api.use('/api/leagues', routes.leagues)
api.use('/api/settings', routes.settings)
api.use('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../', 'dist', 'index.html'))
})

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
const wss = new WebSocket.Server({ noServer: true })

server.on('upgrade', async (request, socket, head) => {
  const parsed = new url.URL(request.url, config.url)
  try {
    const token = parsed.searchParams.get('token')
    const decoded = await jwt.verify(token, config.jwt.secret)
    request.user = decoded
  } catch (error) {
    logger(error)
    return socket.destroy()
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    ws.leagueId = parseInt(parsed.searchParams.get('leagueId'), 10)
    wss.emit('connection', ws, request)
  })
})

sockets(wss)

api.locals.broadcast = (leagueId, message) => {
  wss.clients.forEach((c) => {
    if (c.leagueId === leagueId) {
      if (c && c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify(message))
      }
    }
  })
}

module.exports = server
