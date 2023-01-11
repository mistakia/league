import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, team_aliases } from '#common'
import { isMain, getPlayer, fanduel, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel')
debug.enable('import-fanduel,get-player,fanduel')

const formatPlayerName = (str) => {
  str = str.split(' - ')[0]
  return str.trim()
}

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    return
  }

  console.time('import-fanduel-odds')

  const timestamp = Math.round(Date.now() / 1000)

  const missing = []
  const props = []

  const nfl_games = await db('nfl_games').where({
    week: constants.season.nfl_seas_week,
    year: constants.season.year,
    seas_type: constants.season.nfl_seas_type
  })
  const events = await fanduel.getEvents()

  // filter events to those for current week
  const week_end = constants.season.week_end
  const current_week_events = events.filter(
    (event) =>
      dayjs(event.openDate).isBefore(week_end) && event.name !== 'NFL Matches'
  )

  log(`Getting odds for ${current_week_events.length} events`)

  const handle_over_under_market = ({ market, player_row }) => {
    const nfl_game = nfl_games.find(
      (game) => game.v === player_row.cteam || game.h === player_row.cteam
    )

    if (!nfl_game) {
      return
    }

    const prop = {}
    prop.pid = player_row.pid
    prop.prop_type = fanduel.markets[market.marketType]
    prop.id = market.marketId
    prop.timestamp = timestamp
    prop.week = constants.season.week
    prop.year = constants.season.year
    prop.esbid = nfl_game.esbid
    prop.sourceid = constants.sources.FANDUEL_NJ
    prop.active = true
    prop.live = Boolean(market.inPlay)

    prop.ln = parseFloat(market.runners[0].handicap, 10)

    for (const selection of market.runners) {
      if (selection.result.type.toLowerCase() === 'over') {
        prop.o = Number(
          selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
        )
        prop.o_am = Number(
          selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
        )
      } else if (selection.result.type.toLowerCase() === 'under') {
        prop.u = Number(
          selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds
        )
        prop.u_am = Number(
          selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
        )
      }
    }
    props.push(prop)
  }

  const handle_alt_line_market = ({ market, player_row }) => {
    for (const selection of market.runners) {
      const nfl_game = nfl_games.find(
        (game) => game.v === player_row.cteam || game.h === player_row.cteam
      )

      if (!nfl_game) {
        continue
      }

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type = fanduel.markets[market.marketType]
      prop.id = market.marketId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.esbid = nfl_game.esbid
      prop.sourceid = constants.sources.FANDUEL_NJ
      prop.active = true
      prop.live = Boolean(market.inPlay)

      const runner_name_number = Number(
        selection.runnerName.replace(/\D+/g, '')
      )
      prop.ln = runner_name_number - 0.5
      prop.o = Number(selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds)
      prop.o_am = Number(
        selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
      )

      props.u = null
      props.u_am = null

      props.push(prop)
    }
  }

  const handle_leader_market = async ({ market, teams = [], line = null }) => {
    for (const selection of market.runners) {
      let player_row
      const params = {
        name: selection.runnerName,
        teams
      }

      try {
        player_row = await getPlayer(params)
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        missing.push(params)
        continue
      }

      const nfl_game = nfl_games.find(
        (game) => game.v === player_row.cteam || game.h === player_row.cteam
      )

      if (!nfl_game) {
        continue
      }

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type =
        fanduel.leader_market_names[market.marketName] ||
        fanduel.markets[market.marketType]
      prop.id = market.marketId
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.esbid = nfl_game.esbid
      prop.sourceid = constants.sources.FANDUEL_NJ
      prop.active = true
      prop.live = Boolean(market.inPlay)

      prop.ln = line
      prop.o = Number(selection.winRunnerOdds.trueOdds.decimalOdds.decimalOdds)
      prop.o_am = Number(
        selection.winRunnerOdds.americanDisplayOdds.americanOddsInt
      )

      props.u = null
      props.u_am = null

      props.push(prop)
    }
  }

  for (const event of current_week_events) {
    const teams = event.name.split('@').map((p) => team_aliases[p.trim()])

    console.time(`fanduel-event-${event.eventId}`)
    for (const tab of fanduel.tabs) {
      const data = await fanduel.getEventTab({ eventId: event.eventId, tab })

      for (const market of Object.values(data.attachments.markets)) {
        // ignore unsuported markets
        if (!market.marketType || !fanduel.markets[market.marketType]) {
          continue
        }

        if (market.marketType === 'ANY_TIME_TOUCHDOWN_SCORER') {
          const line = 0.5
          await handle_leader_market({ market, teams, line })
        } else {
          const is_leader_market = fanduel.leader_markets[market.marketType]
          if (is_leader_market) {
            await handle_leader_market({ market, teams })
          } else {
            let player_row
            const params = {
              name: formatPlayerName(market.marketName),
              teams
            }

            try {
              player_row = await getPlayer(params)
            } catch (err) {
              log(err)
            }

            if (!player_row) {
              missing.push(params)
              continue
            }

            const is_alt_line_market =
              fanduel.alt_line_markets[market.marketType]
            if (is_alt_line_market) {
              handle_alt_line_market({ market, player_row })
            } else {
              handle_over_under_market({ market, player_row })
            }
          }
        }
      }
    }
    console.timeEnd(`fanduel-event-${event.eventId}`)
  }

  /* const weekly_specials_markets = await fanduel.getWeeklySpecials()
   * for (const market of weekly_specials_markets) {
   *   await handle_leader_market({ market })
   * }
   */
  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.teams}`))

  if (argv.dry) {
    log(props[0])
    return
  }

  if (props.length) {
    log(`Inserting ${props.length} props into database`)
    await insertProps(props)
  }

  console.timeEnd('import-fanduel-odds')
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.FANDUEL_ODDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
