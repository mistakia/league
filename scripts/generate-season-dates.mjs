import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'
import { eastern } from '#libs-shared/season.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-season-dates')
enable_debug_namespaces('generate-season-dates')

const generateSeasonDates = async ({
  season_year = current_season.year
} = {}) => {
  // Field names match `libs-shared/season-dates.mjs` exactly, because that file
  // is maintained by hand-copying this output into it.
  const result = {
    offseason: null,
    regular_season_start: null,
    end: null,
    opening_day: null,
    final_week: null,
    nfl_final_week: null,
    regular_season_final_week: null,
    wildcard_week: null,
    super_bowl_bye_weeks: 1
  }

  const games = await db('nfl_games')
    .whereIn('season_type', ['REG', 'POST'])
    .where({ season_year })

  if (!games.length) {
    log(`found no games for ${season_year} season`)
    return result
  }

  const sorted = games
    .filter((g) => g.kickoff_at)
    .sort((a, b) => a.kickoff_at - b.kickoff_at)
  const first_game = sorted[0]
  const first_game_day = eastern(dayjs(first_game.kickoff_at).unix()).startOf(
    'day'
  )

  // first game day
  result.opening_day = first_game_day.unix()

  // two tuesdays before first game
  result.regular_season_start = first_game_day
    .day(2) // set to tuesday
    .subtract(1, 'week')
    .unix()

  // The anchor is the thing `calculate_week` subtracts from, so a wrong value
  // shifts every game to week N+1 and fails nowhere -- odds importers just
  // miss `find_nfl_game` and write a null esbid. Check the gap, not the
  // calendar: the opener is always a Thursday, the anchor the Tuesday nine
  // days before it.
  const anchor_gap_days = result.opening_day - result.regular_season_start
  if (anchor_gap_days !== 777600) {
    throw new Error(
      `regular_season_start is ${anchor_gap_days / 86400} days before the opener, expected 9`
    )
  }

  // `end` and `offseason` are the SAME instant computed for different seasons:
  // the midnight ENDING Super Bowl day, so the game itself is still inside the
  // season it belongs to. `Season.year` flips at `end` and five odds importers
  // stop there, so a value on the near side of kickoff cuts the season short.
  const super_bowl_midnight = (kickoff_at) =>
    eastern(dayjs(kickoff_at).unix()).startOf('day').add(1, 'day').unix()

  // Only reached for a season whose Super Bowl is not yet scheduled; February 1
  // is a placeholder, not a convention.
  const placeholder_end = eastern(
    dayjs.tz(`${season_year}/02/01`, 'YYYY/MM/DD', 'America/New_York').unix()
  )
    .startOf('week')
    .unix()

  // current season super bowl
  const super_bowl = games.find((g) => g.day === 'SB')
  result.end =
    super_bowl && super_bowl.kickoff_at
      ? super_bowl_midnight(super_bowl.kickoff_at)
      : placeholder_end

  // previous season super bowl
  const previous_super_bowl_query = await db('nfl_games').where({
    day: 'SB',
    season_year: season_year - 1
  })
  const previous_super_bowl = previous_super_bowl_query[0]
  result.offseason =
    previous_super_bowl && previous_super_bowl.kickoff_at
      ? super_bowl_midnight(previous_super_bowl.kickoff_at)
      : placeholder_end

  result.nfl_final_week = Math.max(
    ...games.filter((g) => g.season_type === 'REG').map((g) => g.week)
  )
  result.final_week = result.nfl_final_week - 1
  result.regular_season_final_week = result.final_week - 3
  result.wildcard_week = result.final_week - 2

  log(result)

  return result
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await generateSeasonDates({ season_year: argv.year })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generateSeasonDates
