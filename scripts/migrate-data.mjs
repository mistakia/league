import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#utils'
import { constants } from '#common'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate-data')
debug.enable('migrate-data')

const migrateData = async () => {
  // alter seasons table
  try {
    await db.schema.alterTable('seasons', function (table) {
      table.tinyint('sqb', 1).notNullable()
      table.tinyint('srb', 1).notNullable()
      table.tinyint('swr', 1).notNullable()
      table.tinyint('ste', 1).notNullable()
      table.tinyint('srbwr', 1).notNullable()
      table.tinyint('sqbrbwrte', 1).notNullable()
      table.tinyint('srbwrte', 1).notNullable()
      table.tinyint('swrte', 1).notNullable()
      table.tinyint('sdst', 1).notNullable()
      table.tinyint('sk', 1).notNullable()

      table.tinyint('bench', 1).notNullable()
      table.tinyint('ps', 1).notNullable()
      table.tinyint('ir', 1).notNullable()

      table.tinyint('mqb', 1).notNullable()
      table.tinyint('mrb', 1).notNullable()
      table.tinyint('mwr', 1).notNullable()
      table.tinyint('mte', 1).notNullable()
      table.tinyint('mdst', 1).notNullable()
      table.tinyint('mk', 1).notNullable()

      table.integer('faab').notNullable()
      table.integer('cap').notNullable()
      table.integer('minBid').defaultTo('0')

      table.decimal('pa', 3, 2).notNullable()
      table.decimal('pc', 3, 2).notNullable()
      table.decimal('py', 3, 2).notNullable()
      table.decimal('ints', 3, 2).notNullable()
      table.tinyint('tdp', 1).notNullable()
      table.decimal('ra', 2, 1).notNullable()
      table.decimal('ry', 2, 1).notNullable()
      table.tinyint('tdr', 1).notNullable()
      table.decimal('rec', 2, 1).notNullable()
      table.decimal('rbrec', 2, 1).notNullable()
      table.decimal('wrrec', 2, 1).notNullable()
      table.decimal('terec', 2, 1).notNullable()
      table.decimal('recy', 2, 1).notNullable()
      table.tinyint('twoptc', 1).notNullable()
      table.tinyint('tdrec', 1).notNullable()
      table.tinyint('fuml', 1).notNullable()
      table.tinyint('prtd', 1).notNullable()
      table.tinyint('krtd', 1).notNullable()

      table.tinyint('tag2', 1).unsigned().defaultTo('1').notNullable()
      table.tinyint('tag3', 1).unsigned().defaultTo('1').notNullable()
      table.tinyint('tag4', 1).unsigned().defaultTo('2').notNullable()

      table.integer('ext1').defaultTo('5')
      table.integer('ext2').defaultTo('10')
      table.integer('ext3').defaultTo('20')
      table.integer('ext4').defaultTo('35')
    })
  } catch (err) {
    log(err)
  }

  // copy leagues table data to seasons table
  const leagues = await db('leagues')
  for (const league of leagues) {
    for (const position of constants.positions) {
      delete league[`b_${position}`]
    }

    delete league.processed_at
    delete league.commishid
    delete league.name
    delete league.nteams
    delete league.discord_webhook_url
    delete league.groupme_token
    delete league.groupme_id

    delete league.hosted
    delete league.host

    const { uid, ...params } = league
    await db('seasons')
      .insert({ lid: uid, year: constants.season.year, ...params })
      .onConflict()
      .merge()

    const seasons = await db('seasons')
      .where({ lid: uid })
      .whereNot('year', constants.season.year)
    for (const season of seasons) {
      await db('seasons').update(params).where({ lid: uid, year: season.year })
    }
  }

  // alter league table
  await db.schema.alterTable('leagues', function (table) {
    table.dropColumn('sqb')
    table.dropColumn('srb')
    table.dropColumn('swr')
    table.dropColumn('ste')
    table.dropColumn('srbwr')
    table.dropColumn('sqbrbwrte')
    table.dropColumn('srbwrte')
    table.dropColumn('swrte')
    table.dropColumn('sdst')
    table.dropColumn('sk')

    table.dropColumn('bench')
    table.dropColumn('ps')
    table.dropColumn('ir')

    table.dropColumn('mqb')
    table.dropColumn('mrb')
    table.dropColumn('mwr')
    table.dropColumn('mte')
    table.dropColumn('mdst')
    table.dropColumn('mk')

    table.dropColumn('faab')
    table.dropColumn('cap')
    table.dropColumn('minBid')

    table.dropColumn('pa')
    table.dropColumn('pc')
    table.dropColumn('py')
    table.dropColumn('ints')
    table.dropColumn('tdp')
    table.dropColumn('ra')
    table.dropColumn('ry')
    table.dropColumn('tdr')
    table.dropColumn('rec')
    table.dropColumn('rbrec')
    table.dropColumn('wrrec')
    table.dropColumn('terec')
    table.dropColumn('recy')
    table.dropColumn('twoptc')
    table.dropColumn('tdrec')
    table.dropColumn('fuml')
    table.dropColumn('prtd')
    table.dropColumn('krtd')

    table.dropColumn('tag2')
    table.dropColumn('tag3')
    table.dropColumn('tag4')
  })

  log('completed')
}

const main = async () => {
  let error
  try {
    await migrateData()
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

export default migrateData
