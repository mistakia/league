import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'

const log = debug('populate-opening-days')
debug.enable('populate-opening-days')

// Refresh the `opening_days` materialized view. The view is derived purely from
// the NFL schedule (min REG game date per year over nfl_games), so its coverage
// tracks whichever seasons have been imported into nfl_games. It is created
// WITH NO DATA and nothing else refreshes it, so it must be refreshed whenever
// the schedule changes -- otherwise opening-day-derived columns (KeepTradeCut
// snapshot key, player_age) go blank for any year past the last refresh.
const populate_opening_days = async () => {
  log(`Refreshing opening_days materialized view`)

  // Guard: a REFRESH against an empty nfl_games would leave the view empty and
  // silently blank every opening-day-derived column. Require schedule data.
  const reg_games = await db('nfl_games')
    .where({ season_type: 'REG' })
    .max('season_year as max_year')
    .first()

  if (!reg_games || reg_games.max_year == null) {
    log(`No NFL regular season games found -- skipping refresh`)
    return { success: false, error: 'No NFL games data found' }
  }

  const nfl_games_max_year = reg_games.max_year

  const before = await db('opening_days').max('year as max_year').first()
  log(`opening_days max year before refresh: ${before?.max_year ?? 'none'}`)

  await db.raw('REFRESH MATERIALIZED VIEW opening_days')

  const after = await db('opening_days').max('year as max_year').first()
  const opening_days_max_year = after?.max_year ?? null
  log(`opening_days max year after refresh: ${opening_days_max_year ?? 'none'}`)

  // Surfacing check: the view should now cover every scheduled season. If it
  // lags the schedule (or the live season) after a refresh, the schedule import
  // upstream has stalled -- flag it rather than let the gap masquerade as a
  // query bug in downstream KTC/age columns.
  const lags_schedule = opening_days_max_year < nfl_games_max_year
  const lags_season = opening_days_max_year < current_season.year
  if (lags_schedule || lags_season) {
    log(
      `WARNING: opening_days lags -- opening_days=${opening_days_max_year}, ` +
        `nfl_games REG=${nfl_games_max_year}, current_season=${current_season.year}`
    )
  }

  return {
    success: !lags_schedule,
    opening_days_max_year,
    nfl_games_reg_max_year: nfl_games_max_year,
    current_season_year: current_season.year
  }
}

const main = async () => {
  let error
  try {
    const result = await populate_opening_days()
    log('Operation completed:', result)
  } catch (err) {
    error = err
    log('Error:', error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default populate_opening_days
