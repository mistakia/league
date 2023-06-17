import fetch from 'node-fetch'
import dayjs from 'dayjs'
// import debug from 'debug'

import config from '#config'
import { constants } from '#libs-shared'

// const log = debug('gambet')
// debug.enable('gambet')

export const markets = {
  // pass props
  'AMERICAN_FOOTBALL:FT:PROPPSATT':
    constants.player_prop_types.GAME_PASSING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FTOT:PPTOU':
    constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
  'AMERICAN_FOOTBALL:FT:PROPINT':
    constants.player_prop_types.GAME_PASSING_INTERCEPTIONS,
  'AMERICAN_FOOTBALL:FT:PROPPASRECYA':
    constants.player_prop_types.GAME_PASSING_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FT:PPT':
    constants.player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
  'AMERICAN_FOOTBALL:FTOT:PPCOU':
    constants.player_prop_types.GAME_PASSING_COMPLETIONS,
  'AMERICAN_FOOTBALL:FT:PROPLNGPSCMP':
    constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  'AMERICAN_FOOTBALL:FTOT:PPSYOU':
    constants.player_prop_types.GAME_PASSING_YARDS,
  'AMERICAN_FOOTBALL:FT:PPC':
    constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
  'AMERICAN_FOOTBALL:FT:PPY':
    constants.player_prop_types.GAME_ALT_PASSING_YARDS,

  // rec props
  'AMERICAN_FOOTBALL:FTOT:PRCYOU':
    constants.player_prop_types.GAME_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FTOT:PRCOU': constants.player_prop_types.GAME_RECEPTIONS,
  'AMERICAN_FOOTBALL:FT:PROPLNGREC':
    constants.player_prop_types.GAME_LONGEST_RECEPTION,
  'AMERICAN_FOOTBALL:FT:PRCY':
    constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FT:PRC': constants.player_prop_types.GAME_ALT_RECEPTIONS,

  // rush props
  'AMERICAN_FOOTBALL:FTOT:PCOU':
    constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FT:PROPRSPRCYDS':
    constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FT:PRSY':
    constants.player_prop_types.GAME_ALT_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FTOT:PRSYOU':
    constants.player_prop_types.GAME_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FT:PC':
    constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FT:PROPLNGRUS':
    constants.player_prop_types.GAME_LONGEST_RUSH,

  // 'AMERICAN_FOOTBALL:FT:PROPRSATT':

  // td props
  // 'AMERICAN_FOOTBALL:FT:PROPLSTTD': , LAST TOUCHDOWN SCORER
  // 'AMERICAN_FOOTBALL:FT:PROP1STTD', FIRST TOUCHDOWN SCORER
  // 'AMERICAN_FOOTBALL:FTOT:PRSTOU',
  // 'AMERICAN_FOOTBALL:FT:PRST',
  // 'AMERICAN_FOOTBALL:FT:PRCT',
  'AMERICAN_FOOTBALL:FT:PROPATD':
    constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
  // 'AMERICAN_FOOTBALL:FT:PROPRCTD': ,
  // 'AMERICAN_FOOTBALL:FT:PROPRSTD'
}

export const get_events = async () => {
  const url = `${config.gambet_api_url}/en/prematch/football/nfl`

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' }
  })
  const data = await res.json()

  const week_end = constants.season.week_end
  if (
    data &&
    data.models &&
    data.models['744'] &&
    data.models['744'].data &&
    data.models['744'].data.events
  ) {
    const events = data.models['744'].data.events.filter((event) =>
      dayjs(event.date).isBefore(week_end)
    )

    return events
  }

  return []
}

export const get_event_markets = async ({ event_url }) => {
  const url = `${config.gambet_api_url}${event_url}`

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' }
  })
  const data = await res.json()

  if (
    data &&
    data.models &&
    data.models['742'] &&
    data.models['742'].data &&
    data.models['742'].data.event &&
    data.models['742'].data.event.markets
  ) {
    return data.models['742'].data.event.markets
  }

  return []
}
