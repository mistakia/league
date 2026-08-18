import https from 'https'
import http from 'http'
import fs from 'fs'
import url, { fileURLToPath } from 'url'
import path, { dirname } from 'path'

import WebSocket from 'ws'
import express from 'express'
import morgan from 'morgan'
import compression from 'compression'
import debug from 'debug'

import jwt from 'jsonwebtoken'
import { expressjwt } from 'express-jwt'
import slowDown from 'express-slow-down'

import config from '#config'
import cache from './cache.mjs'
import routes from './routes/index.mjs'
import db from '#db'
import sockets from './sockets/index.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { create_error_handler } from '#libs-server/middleware/error-handler.mjs'
import { create_render_html_middleware } from '#libs-server/middleware/render-html.mjs'
import {
  create_response_validation_middleware,
  is_response_validation_enabled
} from '#api/swagger/response-validation.mjs'

const logger = debug('api')
const morgan_logger = debug('api')
const options = config
const __dirname = dirname(fileURLToPath(import.meta.url))

const favicon_path = path.join(__dirname, '../', 'static', 'favicon.ico')
const favicon_buffer = fs.readFileSync(favicon_path)
const favicon_max_age_seconds = 604800
const favicon_middleware = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.url !== '/favicon.ico') return next()
  res.set('Cache-Control', `public, max-age=${favicon_max_age_seconds}`)
  res.set('Content-Type', 'image/x-icon')
  res.set('Content-Length', favicon_buffer.length)
  res.end(favicon_buffer)
}

// Serve robots.txt at the root from static/. The SPA catch-all below would
// otherwise return index.html for /robots.txt, which crawlers reject.
const robots_path = path.join(__dirname, '../', 'static', 'robots.txt')
const robots_buffer = fs.readFileSync(robots_path)
const robots_max_age_seconds = 86400
const robots_middleware = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.url !== '/robots.txt') return next()
  res.set('Cache-Control', `public, max-age=${robots_max_age_seconds}`)
  res.set('Content-Type', 'text/plain; charset=utf-8')
  res.set('Content-Length', robots_buffer.length)
  res.end(robots_buffer)
}

const api = express()

api.locals.db = db
api.locals.config = config
api.locals.logger = logger
api.locals.cache = cache

api.enable('etag')
api.disable('x-powered-by')
api.use(compression())
api.use(
  morgan('combined', {
    stream: { write: (message) => morgan_logger(message.trim()) }
  })
)
api.use(express.json({ limit: '150mb' }))

api.use(favicon_middleware)
api.use(robots_middleware)
api.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || config.url)
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT')
  res.set(
    'Access-Control-Allow-Headers',
    'Authorization, Origin, X-Requested-With, Content-Type, Accept'
  )
  res.set('Vary', 'Origin')
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
  // All express-jwt header rejections are benign client/scanner noise: the
  // request proceeds unauthenticated and hits the `!req.auth` 401 guard below,
  // so swallow them instead of passing to the log_error-emitting error
  // middleware. credentials_bad_scheme/credentials_bad_format are the "Format is
  // Authorization: Bearer [token]" rejections scanners trigger (signal #116769);
  // mirrors the URIError scanner-noise skip in error-handler.mjs.
  if (
    err.code === 'invalid_token' ||
    err.code === 'credentials_required' ||
    err.code === 'credentials_bad_scheme' ||
    err.code === 'credentials_bad_format'
  ) {
    return next()
  }
  return next(err)
})
// Response validation, test environment only. Mounted HERE -- after the JWT
// middleware so an authenticated response is what gets validated, and before
// the first route mount so it wraps `res.json` on every handler below. Moving
// it below the mounts silently disables it; `assert_holdout_is_current()` fails
// the run on zero observed pairs for that reason.
if (is_response_validation_enabled()) {
  api.use(create_response_validation_middleware())
}

api.use('/api/docs', routes.docs)
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
api.use('/api/markets', speed_limiter, routes.markets)
api.use('/api/percentiles', routes.percentiles)
api.use('/api/seasonlogs', routes.seasonlogs)
api.use('/api/cache', routes.cache)
api.use('/api/data-views', routes.data_views)
api.use('/api/u', speed_limiter, routes.shorten_url)
api.use('/api/wagers', routes.wagers)
api.use('/api/selection-combinations', routes.selection_combinations)
// Public, unauthenticated write: a prospective manager has no account. This
// router carries the submit route and nothing else -- its read side is mounted
// below the guard, so no handler here reads user-owned rows.
api.use('/api/waitlist', routes.waitlist)

api.use('/api/*', (req, res, next) => {
  if (req.method !== 'OPTIONS' && !req.auth) {
    return res.status(401).send({ error: 'Authentication required' })
  }
  next()
})
api.use('/api/scoreboard', routes.scoreboard)
api.use('/api/me', routes.me)
api.use('/api/settings', routes.settings)
// Candidate PII, readable only by the league's sitting managers. Mounted here
// rather than beside /api/waitlist so the blanket guard above refuses an
// anonymous caller before any handler runs.
api.use('/api/waitlist-submissions', routes.waitlist_submissions)
// Confidential ballots. Mounted here rather than under /api/leagues, which sits
// ABOVE the blanket guard, so an anonymous caller is refused before any handler
// touches an admission vote row.
api.use('/api/admission-votes', routes.admission_votes)
// `fallthrough: false` so a MISSING bundle asset 404s here instead of reaching
// the SPA catch-all below. With fallthrough the catch-all answered every absent
// chunk with `200 text/html` and index.html's body, so the browser parsed
// `<!doctype html>` as JavaScript and reported `SyntaxError: Unexpected token
// '<'` — an error naming neither the asset nor the deploy that dropped it
// (signal #123576). A 404 is what webpack's chunk loader expects and what makes
// served-client drift diagnosable. Matches the `/static` and `/docs` mounts.
api.use(
  '/dist',
  express.static(path.join(__dirname, '../', 'dist'), {
    fallthrough: false,
    setHeaders: (res, path) => {
      // Set Cache-Control to cache forever
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }),
  (err, req, res, next) => {
    if (err) {
      res.status(404).send('Asset not found')
    } else {
      next()
    }
  }
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
// Repository markdown backing the in-app doc pages (/about, /constitution,
// /glossary, ...). These were fetched from the GitHub contents API, which is
// rate limited to 60 requests/hour/IP unauthenticated — once a visitor tripped
// that, every doc page rendered "Failed to Load". Serving them from the deploy
// tree removes the runtime dependency on github.com. Short max-age so a
// `yarn deploy` (which git pulls) propagates doc edits without a rebuild.
const docs_max_age_seconds = 300
api.get('/docs/README.md', (req, res) => {
  res.set('Cache-Control', `public, max-age=${docs_max_age_seconds}`)
  res.sendFile(path.join(__dirname, '../', 'README.md'))
})
api.use(
  '/docs',
  express.static(path.join(__dirname, '../', 'docs'), {
    fallthrough: false,
    setHeaders: (res) => {
      res.set('Cache-Control', `public, max-age=${docs_max_age_seconds}`)
    }
  }),
  (err, req, res, next) => {
    if (err) {
      res.status(404).send('Document not found')
    } else {
      next()
    }
  }
)
// Markdown context documents served at human-path + `.md` (not under /api).
// Mounted after the static handlers and before the SPA catch-all.
api.use('/', routes.context_docs)
// SPA fallback. Serves the built bundle with a per-route `<head>` filled in —
// see libs-server/middleware/render-html.mjs for why that cannot happen at
// build time.
api.use(
  '/*',
  create_render_html_middleware({
    dist_path: path.join(__dirname, '../', 'dist'),
    origin: config.url
  })
)

// Error middleware: emits log_error signals and returns a sanitized response.
// Mounted last so it captures next(err) from any preceding route.
api.use(
  create_error_handler({
    logger: create_logger('api:error', { service: 'league-server' })
  })
)

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
    if (token) {
      const decoded = await jwt.verify(token, config.jwt.secret)
      request.auth = decoded
    }
  } catch (error) {
    logger(error)
    // Don't destroy the socket for invalid tokens, allow connection without auth
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    const league_id_param =
      parsed.searchParams.get('league_id') ||
      parsed.searchParams.get('leagueId')
    ws.league_id = Number(league_id_param)
    ws.user_id = request.auth ? request.auth.userId : null
    wss.emit('connection', ws, request)
  })
})

sockets(wss)

api.locals.broadcast = (league_id, message) => {
  wss.clients.forEach((c) => {
    if (c.league_id === league_id) {
      if (c && c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify(message))
      }
    }
  })
}

export default server
