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
const favicon = require('serve-favicon')

const config = require('../config')
const routes = require('./routes')
const db = require('../db')
const sockets = require('./sockets')

const defaults = {}
const options = extend(defaults, config)
const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

if (IS_DEV) {
  debug.enable('api,notifications*,auction*,scoreboard*')
} else if (IS_PROD) {
  debug.enable('api*,notifications*,auction*')
}

const api = express()

api.locals.db = db
api.locals.config = config
api.locals.logger = logger

api.enable('etag')
api.disable('x-powered-by')
api.use(compression())
api.use(morgan('api', 'combined'))
api.use(bodyParser.json())

api.use(favicon(path.join(__dirname, '../', 'dist', 'favicon.ico'), { maxAge: '604800' }))
api.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || config.url)
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT')
  res.set('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept')
  res.set('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate')
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
  res.set('Expires', '0')
  res.set('Pragma', 'no-cache')
  res.set('Surrogate-Control', 'no-store')
  if (err.code === 'invalid_token') return next()
  return next(err)
})
api.use('/api/status', routes.status)
api.use('/api/errors', routes.errors)
api.use('/api/stats', speedLimiter, routes.stats)
api.use('/api/players', routes.players)
api.use('/api/plays', speedLimiter, routes.plays)
api.use('/api/schedule', routes.schedule)
api.use('/api/sources', routes.sources)
api.use('/api/auth', routes.auth)
api.use('/api/*', (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
})
api.use('/api/scoreboard', routes.scoreboard)
api.use('/api/me', routes.me)
api.use('/api/projections', routes.projections)
api.use('/api/teams', routes.teams)
api.use('/api/leagues', routes.leagues)
api.use('/api/settings', routes.settings)
api.use('/index.js.map', (req, res) => {
  res.sendFile(path.join(__dirname, '../', 'dist', 'index.js.map'), { cacheControl: false })
})
api.use('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../', 'dist', 'index.html'), { cacheControl: false })
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
    ws.userId = request.user.userId
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
