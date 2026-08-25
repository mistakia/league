import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { NGS_API_URL } from '#private/libs-server/ngs.mjs'
import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-games-ngs')
enable_debug_namespaces('import-games-ngs')

const getWeek = (week, week_type) => {
  switch (week_type) {
    case 'PRE':
    case 'REG':
    case 'HOF':
      return week

    case 'WC':
      return 1

    case 'DIV':
      return 2

    case 'CON':
    case 'CONF':
      return 3

    case 'SB':
      return 4

    case 'PRO':
      return week

    default:
      throw new Error(`invalid week_type: ${week_type}`)
  }
}

const format = (item) => {
  const date = item.gameDate ? dayjs(item.gameDate).format('YYYY/MM/DD') : null
  const season_type = item.seasonType
  const week_type = ['REG', 'PRE'].includes(season_type)
    ? season_type
    : item.weekNameAbbr
  const time_eastern = item.gameTimeEastern
  const week = getWeek(item.week, week_type)
  const season_year = item.season
  const score = item.score || {}
  const day = date
    ? getGameDayAbbreviation({ season_type, date, time_eastern, week_type })
    : null

  const datetime = dayjs(
    `${item.gameDate} ${item.gameTimeEastern}`,
    'DD/MM/YYYY HH:mm:ss'
  ).tz(item.time, 'America/New_York')

  return {
    esbid: item.gameId,
    gsis_game_id: item.gameKey,
    shield_game_id: item.smartId,
    ngs_game_id: item.gameId,

    season_year,
    week,
    date,
    time_eastern,
    day,
    kickoff_at: datetime.isValid() ? datetime.toDate() : null,

    away_nfl_team: fixTeam(item.visitorTeamAbbr),
    home_nfl_team: fixTeam(item.homeTeamAbbr),

    season_type,
    week_type,
    is_overtime: (score.phase || '').includes('OVERTIME'),

    home_score: (score.homeTeamScore || {}).pointTotal,
    away_score: (score.visitorTeamScore || {}).pointTotal,

    stadium_name: item.site.siteFullName,
    ngs_stadium_id: item.site.siteId,

    game_clock: score.time,
    status: score.phase
  }
}

const run = async ({
  season_year = current_season.year,
  collector = null
} = {}) => {
  log(`Importing games for ${season_year}`)

  const result = {
    games_processed: 0,
    games_updated: 0
  }

  const url = `${NGS_API_URL}/league/schedule?season=${season_year}`

  let data
  try {
    data = await fetch_with_retry({
      url,
      headers: {
        referer: 'https://nextgenstats.nfl.com/'
      },
      use_proxy: true,
      response_type: 'json'
    })
  } catch (error) {
    if (collector) {
      collector.add_error(error, { season_year, context: 'fetch_schedule' })
    }
    throw error
  }

  const inserts = []
  for (const item of data) {
    inserts.push(format(item))
  }

  result.games_processed = inserts.length

  if (inserts.length) {
    await db('nfl_games')
      .insert(inserts)
      .onConflict([
        'away_nfl_team',
        'home_nfl_team',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    log(`saved data for ${inserts.length} games`)
    result.games_updated = inserts.length
  }

  if (collector) {
    collector.set_stats({
      games_processed: result.games_processed,
      games_updated: result.games_updated
    })
  }

  return result
}

// Conservative floor for a full NFL season schedule (~285 games incl. PRE
// + REG + POST). 100 catches catastrophic API failures (empty payload,
// truncated response) while remaining flexible for partial-year edge cases.
const NFL_GAMES_FLOOR_PER_YEAR = 100

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const season_year = argv.year
    const result = await run({ season_year })

    throw_if_shortfall(
      result.games_processed < NFL_GAMES_FLOOR_PER_YEAR
        ? `nfl_games row-count shortfall for season_year ${season_year ?? current_season.year}: ${result.games_processed} games processed (floor=${NFL_GAMES_FLOOR_PER_YEAR})`
        : null
    )
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_GAMES_NGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
