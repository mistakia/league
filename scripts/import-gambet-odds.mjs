import debug from 'debug'
import oddslib from 'oddslib'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, team_aliases } from '#common'
import { isMain, gambet, wait, getPlayer, insertProps } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-gambet-odds')
debug.enable('import-gambet-odds,get-player,gambet')

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

const import_gambet_odds = async () => {
  // do not pull in props outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    return
  }

  log('importing gambet odds')

  const timestamp = Math.round(Date.now() / 1000)
  const props = []
  const missing = []

  const supported_markets = Object.keys(gambet.markets)

  const events = await gambet.get_events()

  for (const event of events) {
    const event_markets = await gambet.get_event_markets({
      event_url: event.eventUrl
    })

    const teams = [
      team_aliases[event.awayTeam.name],
      team_aliases[event.homeTeam.name]
    ]

    for (const market of event_markets) {
      // ignore unsupported markets
      if (!supported_markets.includes(market.type)) {
        continue
      }

      let player_row
      const params = {
        name: format_player_name(market.name),
        teams
      }

      try {
        player_row = await getPlayer(params)
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        missing.push({
          market,
          ...params
        })
        continue
      }

      const prop = {}
      prop.pid = player_row.pid
      prop.prop_type = gambet.markets[market.type]
      prop.id = market.id
      prop.timestamp = timestamp
      prop.week = constants.season.week
      prop.year = constants.season.year
      prop.sourceid = constants.sources.GAMBET_DC
      prop.active = Boolean(market.displayed)
      prop.live = Boolean(market.isLive)

      const is_alt_line = constants.player_prop_types_alts.includes(
        prop.prop_type
      )
      if (is_alt_line) {
        for (const odd of market.odds) {
          let ln

          try {
            const re = /(?<line>\d+)+/gi
            const re_result = re.exec(odd.short)
            ln = Number(re_result.groups.line) - 0.5
          } catch (err) {
            log(err)
          }

          if (!ln || isNaN(ln)) {
            continue
          }

          props.push({
            ln,
            o: odd.odd,
            o_am: Math.round(oddslib.from('decimal', odd.odd).to('moneyline')),
            ...prop
          })
        }
      } else {
        prop.ln = market.lines.length ? Number(market.lines[0]) : null

        const under_odds = market.odds.find(
          (o) => o.type === 'Under' || o.type === 'No'
        )
        const over_odds = market.odds.find(
          (o) => o.type === 'Over' || o.type === 'Yes'
        )

        prop.o = over_odds ? Number(over_odds.odd) : null
        prop.o_am = prop.o
          ? Math.round(oddslib.from('decimal', prop.o).to('moneyline'))
          : null
        prop.u = under_odds ? Number(under_odds.odd) : null
        prop.u_am = prop.u
          ? Math.round(oddslib.from('decimal', prop.u).to('moneyline'))
          : null

        props.push(prop)
      }
    }

    await wait(5000)
  }

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
}

export const job = async () => {
  let error
  try {
    await import_gambet_odds()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GAMBET_ODDS,
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

export default import_gambet_odds
