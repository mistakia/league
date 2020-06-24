const { argv } = require('yargs')
const env = process.env.NODE_ENV || 'development'
const configPath = argv.config || `./config.${env}`
module.exports = require(configPath)
