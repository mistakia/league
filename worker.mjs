import debug from 'debug'
import schedule from 'node-schedule'

import import_live_plays from '#jobs/import-live-plays.mjs'
import import_live_odds from '#jobs/import-live-odds.mjs'
import finalize_week from '#jobs/finalize-week.mjs'

const log = debug('worker')
debug.enable(
  'worker,get-player,import-plays-nfl-v3,import-plays-ngs,import-live-plays,import-live-odds,import-draft-kings,draftkings,import-caesars,caesars,import-fanduel,fanduel,import-betmgm,betmgm,import-prizepicks-odds,prizepicks,insert-prop-markets,finalize-week'
)

log(`env: ${process.env.NODE_ENV}`)

// REGULAR SEASON

// monday
schedule.scheduleJob('*/1 9-23 * 1,2,9-12 1', import_live_plays)

// tuesday
schedule.scheduleJob('0 0 * 1,2,9-12 2', finalize_week)

// wednesday
schedule.scheduleJob('0 0 * 1,2,9-12 3', finalize_week)

// thursday
schedule.scheduleJob('*/1 12-23 * 1,2,9-12 4', import_live_plays)

// TODO black friday game

// saturday in December
schedule.scheduleJob('*/1 9-23 * 12 6', import_live_plays)

// sunday
schedule.scheduleJob('*/1 9-23 * 1,2,9-12 7', import_live_plays)

// friday through saturday
schedule.scheduleJob('*/5 * * 1,2,9-12 5-6', import_live_odds)

// All times

// every 4 hours all year
schedule.scheduleJob('0 */4 * * *', import_live_odds)

log('all jobs registered')
