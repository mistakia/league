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
  await db.schema.alterTable('offense', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.index('pid', 'pid')
  })
  log('offense table migrated')

  await db.schema.alterTable('player', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['pid'], { indexName: 'pid' })
  })
  log('player table migrated')

  await db.schema.alterTable('players', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.index('pid', 'pid')
  })
  log('players table migrated')

  await db.schema.alterTable('players_status', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.index('pid', 'pid')
  })
  log('players_status table migrated')

  await db.schema.alterTable('poaches', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('poaches table migrated')

  await db.schema.alterTable('poach_releases', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['poachid', 'pid'], { indexName: 'pid' })
  })
  log('poach_releases table migrated')

  await db.schema.alterTable('draft', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('draft table migrated')

  await db.schema.alterTable('projections', function (table) {
    table.renameColumn('player', 'pid')

    table.dropIndex(null, 'userid')
    table.dropIndex(null, 'sourceid')
    table.dropIndex(null, 'player')
    table.unique(['userid', 'pid', 'year', 'week'], { indexName: 'userid' })
    table.unique(['sourceid', 'pid', 'year', 'week', 'timestamp'], {
      indexName: 'sourceid'
    })
    table.index('pid', 'pid')
  })
  log('projections table migrated')

  await db.schema.alterTable('ros_projections', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'sourceid')
    table.dropIndex(null, 'player')
    table.unique(['sourceid', 'pid', 'year'], { indexName: 'sourceid' })
    table.index('pid', 'pid')
  })
  log('ros_projections table migrated')

  await db.schema.alterTable(
    'league_player_projection_points',
    function (table) {
      table.renameColumn('player', 'pid')

      table.dropIndex(null, 'player_league_points')
      table.dropIndex(null, 'player')
      table.unique(['pid', 'lid', 'week', 'year'], {
        indexName: 'player_league_points'
      })
      table.index('pid', 'pid')
    }
  )
  log('league_player_projection_points table migrated')

  await db.schema.alterTable(
    'league_player_projection_values',
    function (table) {
      table.renameColumn('player', 'pid')

      table.dropIndex(null, 'player_value')
      table.dropIndex(null, 'player')
      table.unique(['pid', 'lid', 'week', 'year'], {
        indexName: 'player_value'
      })
      table.index('pid', 'pid')
    }
  )
  log('league_player_projection_values table migrated')

  await db.schema.alterTable('rosters_players', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['rid', 'pid'], { indexName: 'pid' })
  })
  log('rosters_players table migrated')

  await db.schema.alterTable('trades', function (table) {
    table.renameColumn('pid', 'propose_tid')
    table.renameColumn('tid', 'accept_tid')
  })
  log('trades table migrated')

  await db.schema.alterTable('trade_releases', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['tradeid', 'pid'], { indexName: 'pid' })
  })
  log('trade_releases table migrated')

  await db.schema.alterTable('trades_players', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['tradeid', 'pid'], { indexName: 'pid' })
  })
  log('trades_players table migrated')

  await db.schema.alterTable('league_cutlist', function (table) {
    table.renameColumn('player', 'pid')

    table.dropIndex(null, 'player')
    table.dropIndex(null, 'teamplayer')
    table.index('pid', 'pid')
    table.unique(['tid', 'pid'], { indexName: 'tid_pid' })
  })
  log('league_cutlist table migrated')

  await db.schema.alterTable('transactions', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.index('pid', 'pid')
  })
  log('transactions table migrated')

  await db.schema.alterTable('waivers', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('waivers table migrated')

  await db.schema.alterTable('waiver_releases', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['waiverid', 'pid'], { indexName: 'waiverid_pid' })
  })
  log('waiver_releases table migrated')

  await db.schema.alterTable('practice', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['pid', 'week', 'year'], { indexName: 'pid' })
  })
  log('practice table migrated')

  await db.schema.alterTable('gamelogs', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['pid', 'week', 'year'], { indexName: 'pid' })
  })
  log('gamelogs table migrated')

  await db.schema.alterTable('rankings', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('rankings table migrated')

  await db.schema.alterTable('props', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('props table migrated')

  await db.schema.alterTable('transition_bids', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('transition_bids table migrated')

  await db.schema.alterTable('transition_releases', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player')
    table.unique(['transitionid', 'pid'], { indexName: 'pid' })
  })
  log('transition_releases table migrated')

  await db.schema.alterTable('league_team_lineup_starters', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'starter')
    table.unique(['lid', 'pid', 'year', 'week'], { indexName: 'starter' })
  })
  log('league_team_lineup_starters table migrated')

  await db.schema.alterTable('league_baselines', function (table) {
    table.renameColumn('player', 'pid')
  })
  log('league_baselines table migrated')

  await db.schema.alterTable('keeptradecut_rankings', function (table) {
    table.renameColumn('player', 'pid')
    table.dropIndex(null, 'player_value')
    table.unique(['pid', 'd', 'qb', 'type'], { indexName: 'player_value' })
  })
  log('keeptradecut_rankings table migrated')

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
