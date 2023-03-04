import auth from './auth.mjs'
import me from './me.mjs'
import teams from './teams/index.mjs'
import players from './players.mjs'
import leagues from './leagues/index.mjs'
import sources from './sources.mjs'
import plays from './plays.mjs'
import projections from './projections.mjs'
import settings from './settings/index.mjs'
import stats from './stats.mjs'
import schedule from './schedule.mjs'
import status from './status.mjs'
import scoreboard from './scoreboard.mjs'
import errors from './errors.mjs'
import odds from './odds/index.mjs'
import percentiles from './percentiles.mjs'
import seasonlogs from './seasonlogs.mjs'
import cache from './cache.mjs'

export default {
  auth,
  schedule,
  status,
  errors,
  teams,
  leagues,
  players,
  me,
  sources,
  settings,
  plays,
  projections,
  scoreboard,
  stats,
  odds,
  percentiles,
  seasonlogs,
  cache
}
