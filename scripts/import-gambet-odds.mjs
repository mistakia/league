import debug from 'debug'
import fs from 'node:fs/promises'
import dayjs from 'dayjs'
import oddslib from '#libs-server/odds-conversions.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  gambet,
  wait,
  find_player_row,
  insert_prop_markets,
  report_job
} from '#libs-server'
import { normalize_selection_metric_line } from '#libs-server/normalize-selection-metric-line.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-gambet-odds')
enable_debug_namespaces('import-gambet-odds,get-player,gambet')

const exclude_words = [
  'total',
  'passing',
  'touchdowns',
  '(incl. overtime)',
  'pass',
  'completions',
  'yards',
  'receiving',
  'receptions',
  'carries',
  'rushing',
  '(incl. OT)'
]

const format_player_name = (str) => {
  str = str.indexOf(' - ') >= 0 ? str.substr(0, str.indexOf(' - ')) : str
  str = exclude_words.reduce((result, word) => result.replace(word, ''), str)
  if (str.indexOf(',') >= 0) {
    str = str.split(/,|\s/).reverse().join(' ')
  }
  return str.trim()
}

const format_market = async ({
  gambet_market,
  observed_at,
  event,
  nfl_game
}) => {
  let player_row
  const selections = []

  if (gambet_market.playerId) {
    const params = {
      name: format_player_name(gambet_market.name),
      teams: nfl_game ? [nfl_game.away_nfl_team, nfl_game.home_nfl_team] : [],
      ignore_free_agent: true,
      ignore_retired: true
    }

    try {
      player_row = await find_player_row(params)
    } catch (err) {
      log(err)
    }
  }

  for (const odd of gambet_market.odds) {
    let selection_metric_line = Number(odd.handicap) || null
    let selection_name = null

    if (odd.type === 'Over') {
      selection_name = 'over'
    } else if (odd.type === 'Under') {
      selection_name = 'under'
    } else {
      selection_name = odd.name
    }

    // Normalize the line for N+ discrete stat markets
    selection_metric_line = normalize_selection_metric_line({
      raw_value: selection_metric_line,
      selection_name: odd.name
    })

    selections.push({
      source_id: 'GAMBET',
      source_market_id: gambet_market.id,
      source_selection_id: odd.id,

      selection_pid: player_row?.pid || null,
      selection_name,
      selection_metric_line,
      odds_decimal: odd.odd,
      odds_american: oddslib.from('decimal', odd.odd).to('moneyline')
    })
  }

  return {
    market_type: null, // TODO use type

    source_id: 'GAMBET',
    source_market_id: gambet_market.id,
    source_market_name: `${gambet_market.description} - (${gambet_market.type})`,

    esbid: nfl_game?.esbid || null,
    source_event_id: event?.matchId || null,
    source_event_name: event?.longName || null,

    is_open: gambet_market.status === 'active',
    is_live: gambet_market.isLive,
    selection_count: gambet_market.odds.length,

    observed_at,
    selections
  }
}

const import_gambet_odds = async () => {
  const argv = initialize_cli()
  log('importing gambet odds')

  const formatted_markets = []
  const all_markets = []
  const timestamp = Math.round(Date.now() / 1000)
  const observed_at = new Date()

  const nfl_games = await db('nfl_games').select('*').where({
    season_year: current_season.year
  })

  const events = await gambet.get_events()

  for (const event of events) {
    const event_markets = await gambet.get_event_markets({
      event_url: event.eventUrl
    })

    let nfl_game = null

    if (event && event.homeTeam && event.awayTeam) {
      const home = fixTeam(event.homeTeam.name)
      const visitor = fixTeam(event.awayTeam.name)
      const { week, seas_type } = current_season.calculate_week(
        dayjs(event.date)
      )
      nfl_game = nfl_games.find(
        (game) =>
          game.week === week &&
          game.season_type === seas_type &&
          game.season_year === current_season.year &&
          game.away_nfl_team === visitor &&
          game.home_nfl_team === home
      )
    }

    for (const market of event_markets) {
      all_markets.push(market)
      formatted_markets.push(
        await format_market({
          gambet_market: market,
          observed_at,
          event,
          nfl_game
        })
      )
    }

    await wait(2500)
  }

  if (argv.write) {
    await fs.writeFile(
      `./tmp/gambet-event-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }
}

export const job = async () => {
  let error
  try {
    await import_gambet_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GAMBET_ODDS,
    error
  })

  // Rethrow so the exit code matches the outcome -- reporting the error and
  // then returning normally made main() exit 0, writing a failed import to the
  // runs ledger as a success.
  if (error) throw error
}

const main = async () => {
  try {
    await job()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_gambet_odds
