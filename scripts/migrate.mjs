import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate')

const migrate = async () => {
  await db.schema.alterTable('props_index', function (table) {
    table.string('name', 50).nullable()
    table.string('team', 3).nullable()
    table.string('opp', 3).nullable()
    table.integer('esbid', 10).unsigned().nullable()
    table.string('pos', 3).nullable()
    table.tinyint('hits_soft', 2).unsigned().nullable()
    table.json('hit_weeks_soft').nullable()
    table.tinyint('hits_hard', 2).unsigned().nullable()
    table.json('hit_weeks_hard').nullable()
    table.tinyint('hits_opp', 2).unsigned().nullable()
    table.json('opp_hit_weeks').nullable()
    table.decimal('hist_rate_soft', 5, 4).nullable()
    table.decimal('hist_rate_hard', 5, 4).nullable()
    table.decimal('opp_allow_rate', 5, 4).nullable()
    table.decimal('hist_edge_soft', 6, 5).nullable()
    table.decimal('hist_edge_hard', 6, 5).nullable()
    table.decimal('market_prob', 5, 4).nullable()
    table.tinyint('is_pending', 1).unsigned().nullable()
    table.tinyint('is_success', 1).unsigned().nullable()
    table.decimal('risk', 6, 4).nullable()
    table.decimal('payout', 7, 4).nullable()
    table.json('all_weeks').nullable()
    table.json('opp_weeks').nullable()
  })

  log('all tables migrated')
}

const main = async () => {
  let error
  try {
    await migrate()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default migrate
