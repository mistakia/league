const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const env = process.env.NODE_ENV || 'development'
const configPath = argv.config || `./config.${env}`
module.exports = require(configPath)
