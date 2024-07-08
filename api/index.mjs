import https from 'https'
import http from 'http'
import fs from 'fs'
import url, { fileURLToPath } from 'url'
import path, { dirname } from 'path'

import WebSocket from 'ws'
import express from 'express'
import morgan from 'morgan-debug'
import bodyParser from 'body-parser'
import compression from 'compression'
import extend from 'deep-extend'
import debug from 'debug'

import jwt from 'jsonwebtoken'
import { expressjwt } from 'express-jwt'
import slowDown from 'express-slow-down'
import favicon from 'serve-favicon'

import config from '#config'
import cache from './cache.mjs'
import routes from './routes/index.mjs'
import db from '#db'
import sockets from './sockets/index.mjs'

const logger = debug('api')
const defaults = {}
const options = extend(defaults, config)
const __dirname = dirname(fileURLToPath(import.meta.url))

const api = express()

api.locals.db = db
api.locals.config = config
api.locals.logger = logger
api.locals.cache = cache

api.enable('etag')
api.disable('x-powered-by')
api.use(compression())
api.use(morgan('api', 'combined'))
api.use(bodyParser.json({ limit: '150mb' }))

api.use(
  favicon(path.join(__dirname, '../', 'static', 'favicon.ico'), {
    maxAge: '604800'
  })
)
api.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || config.url)
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT')
  res.set(
    'Access-Control-Allow-Headers',
    'Authorization, Origin, X-Requested-With, Content-Type, Accept'
  )
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

const speed_limiter = slowDown({
  windowMs: 5 * 60 * 1000,
  delayAfter: 5,
  delayMs: (hits, req) => (hits - req.slowDown.limit) * 500, // begin adding 500ms of delay per request above `delayAfter`
  maxDelayMs: 10000
})

// disable caching for all api routes
api.use('/api/*', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate')
  res.set('Expires', '0')
  res.set('Pragma', 'no-cache')
  res.set('Surrogate-Control', 'no-store')
  next()
})

api.use('/api/*', expressjwt(config.jwt), (err, req, res, next) => {
  if (err.code === 'invalid_token' || err.code === 'credentials_required') {
    return next()
  }
  return next(err)
})
api.use('/api/status', routes.status)
api.use('/api/errors', routes.errors)
api.use('/api/stats', speed_limiter, routes.stats)
api.use('/api/players', routes.players)
api.use('/api/projections', routes.projections)
api.use('/api/plays', speed_limiter, routes.plays)
api.use('/api/schedule', routes.schedule)
api.use('/api/sources', routes.sources)
api.use('/api/auth', routes.auth)
api.use('/api/leagues', routes.leagues)
api.use('/api/teams', routes.teams)
api.use('/api/odds', speed_limiter, routes.odds)
api.use('/api/markets', speed_limiter, routes.markets)
api.use('/api/percentiles', routes.percentiles)
api.use('/api/seasonlogs', routes.seasonlogs)
api.use('/api/cache', routes.cache)
api.use('/api/table-views', routes.table_views)
api.use('/api/wagers', routes.wagers)

api.use('/api/*', (req, res, next) => {
  if (req.method !== 'OPTIONS' && !req.auth) {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
})
api.use('/api/scoreboard', routes.scoreboard)
api.use('/api/me', routes.me)
api.use('/api/settings', routes.settings)
api.use(
  '/dist',
  express.static(path.join(__dirname, '../', 'dist'), {
    fallthrough: true,
    setHeaders: (res, path) => {
      // Set Cache-Control to cache forever
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
    }
  })
)
api.use(
  '/static',
  express.static(path.join(__dirname, '../', 'static'), {
    fallthrough: false,
    setHeaders: (res, path) => {
      // Set Cache-Control for 7 days
      res.set('Cache-Control', 'public, max-age=604800')
    }
  }),
  (err, req, res, next) => {
    // Error handling middleware
    if (err) {
      res.status(404).send('Static content not found')
    } else {
      next()
    }
  }
)
api.use('/u', routes.shorten_url)
api.use('/*', (req, res, next) => {
  res.sendFile(path.join(__dirname, '../', 'dist', 'index.html'), (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(404).send('Page not found')
      } else {
        next(err)
      }
    }
  })
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
    request.auth = decoded
  } catch (error) {
    logger(error)
    return socket.destroy()
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    ws.leagueId = parseInt(parsed.searchParams.get('leagueId'), 10)
    ws.userId = request.auth.userId
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

export default server
