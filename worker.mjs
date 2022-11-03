import debug from 'debug'
import cron from 'node-cron'

import import_live_plays from '#jobs/import-live-plays.mjs'
import finalize_week from '#jobs/finalize-week.mjs'

const log = debug('worker')
debug.enable('worker,import-plays-nfl,import-plays-ngs,import-live-plays')

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

log('worker jobs registered')
