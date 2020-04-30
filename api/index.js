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

debug.enable('api*')

const config = require('../config')
const routes = require('./routes')
const db = require('../db')
const sockets = require('./sockets')

const defaults = {
  port: 8082
}

const api = express()
const options = extend(defaults, config)

api.locals.db = db

api.disable('x-powered-by')
api.use(compression())
api.use(morgan('api', 'combined'))
api.use(bodyParser.json())

api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

if (options.ssl) {
  api.use(function(req, res, next) {
    if (!req.secure) {
      res.redirect('https://' + req.host + req.url)
    } else {
      next()
    }
  })
}

// TODO - middleware to validate leagueId

api.use('/:leagueId/teams', routes.teams)
api.use('/:leagueId/transactions', routes.transactions)
api.use('/:leagueId/players', routes.players)
api.use('/:leagueId/games', routes.games)
api.use('/:leagueId/settings', routes.settings)

const { port } = options
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

server.listen(port, () => logger(`API listening on port ${port}`))
