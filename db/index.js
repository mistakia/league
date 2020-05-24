const Knex = require('knex')
const env = process.env.NODE_ENV || 'development'
const config = require('../knexfile')[env]
const mysql = Knex(config)

module.exports = mysql
