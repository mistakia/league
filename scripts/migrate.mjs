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
  await db.schema.dropTable('game')
  await db.schema.dropTable('offense')
  await db.schema.alterTable('seasons', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('nfl_games', function (table) {
    table.renameColumn('seas', 'year')
    table.renameColumn('wk', 'week')
  })
  await db.schema.alterTable('nfl_games', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.dropTable('team')
  await db.schema.alterTable('draft', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('matchups', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('playoffs', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('projections', function (table) {
    table.tinyint('week').alter()
    table.smallint('year').alter()
  })
  await db.schema.alterTable('projections_archive', function (table) {
    table.tinyint('week').alter()
    table.smallint('year').alter()
  })
  await db.schema.alterTable('ros_projections', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable(
    'league_player_projection_points',
    function (table) {
      table.smallint('year').alter()
    }
  )
  await db.schema.alterTable(
    'league_player_projection_values',
    function (table) {
      table.smallint('year').alter()
    }
  )
  await db.schema.alterTable('rosters', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('team_stats', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('trades', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('transactions', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('nfl_plays', function (table) {
    table.renameColumn('wk', 'week')
    table.renameColumn('seas', 'year')
  })
  await db.schema.alterTable('nfl_plays', function (table) {
    table.tinyint('week').alter()
  })
  await db.schema.alterTable('nfl_plays_current_week', function (table) {
    table.renameColumn('wk', 'week')
    table.renameColumn('seas', 'year')
  })
  await db.schema.alterTable('nfl_plays_current_week', function (table) {
    table.tinyint('week').alter()
    table.smallint('year').alter()
  })
  await db.schema.alterTable('practice', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('player_gamelogs', function (table) {
    table.dropColumn('week')
    table.dropColumn('year')
  })
  await db.schema.alterTable('player_seasonlogs', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable(
    'league_player_regular_seasonlogs',
    function (table) {
      table.smallint('year').alter()
    }
  )
  await db.schema.alterTable('footballoutsiders', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('rankings', function (table) {
    table.renameColumn('wk', 'week')
  })
  await db.schema.alterTable('rankings', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('props', function (table) {
    table.renameColumn('wk', 'week')
  })
  await db.schema.alterTable('props', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('transition_bids', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('league_team_lineups', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable(
    'league_team_lineup_contributions',
    function (table) {
      table.smallint('year').alter()
    }
  )
  await db.schema.alterTable(
    'league_team_lineup_contribution_weeks',
    function (table) {
      table.smallint('year').alter()
    }
  )
  await db.schema.alterTable('league_team_lineup_starters', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('league_team_forecast', function (table) {
    table.smallint('year').alter()
  })
  await db.schema.alterTable('league_baselines', function (table) {
    table.smallint('year').alter()
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
