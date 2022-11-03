import debug from 'debug'
import cron from 'node-cron'

import import_live_plays from '#jobs/import-live-plays.mjs'
import import_live_odds from '#jobs/import-live-odds.mjs'
import finalize_week from '#jobs/finalize-week.mjs'

const log = debug('worker')
debug.enable(
  'worker,import-plays-nfl,import-plays-ngs,import-live-plays,import-live-odds'
)

// monday
cron.schedule('*/1 20-23 * 1,2,9-12 1', import_live_plays)

// tuesday
cron.schedule('0 0 * 1,2,9-12 2', finalize_week)

// wednesday
cron.schedule('0 0 * 1,2,9-12 3', finalize_week)

// thursday
cron.schedule('*/1 20-23 * 1,2,9-12 4', import_live_plays)

// sunday
cron.schedule('*/1 9-23 * 1,2,9-12 7', import_live_plays)

// monday through thursday and sunday
cron.schedule('*/10 * * 1,2,9-12 1-4,7', import_live_odds)

// friday through saturday
cron.schedule('*/5 * * 1,2,9-12 5-6', import_live_odds)

log('all jobs registered')
