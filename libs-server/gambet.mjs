import fetch from 'node-fetch'
import dayjs from 'dayjs'
// import debug from 'debug'

import config from '#config'
import { constants } from '#libs-shared'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'

// const log = debug('gambet')
// debug.enable('gambet')

export const markets = {
  // pass props
  'AMERICAN_FOOTBALL:FT:PROPPSATT': player_prop_types.GAME_PASSING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FTOT:PPTOU': player_prop_types.GAME_PASSING_TOUCHDOWNS,
  'AMERICAN_FOOTBALL:FT:PROPINT': player_prop_types.GAME_PASSING_INTERCEPTIONS,
  'AMERICAN_FOOTBALL:FT:PROPPASRECYA':
    player_prop_types.GAME_PASSING_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FT:PPT': player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
  'AMERICAN_FOOTBALL:FTOT:PPCOU': player_prop_types.GAME_PASSING_COMPLETIONS,
  'AMERICAN_FOOTBALL:FT:PROPLNGPSCMP':
    player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  'AMERICAN_FOOTBALL:FTOT:PPSYOU': player_prop_types.GAME_PASSING_YARDS,
  'AMERICAN_FOOTBALL:FT:PPC': player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
  'AMERICAN_FOOTBALL:FT:PPY': player_prop_types.GAME_ALT_PASSING_YARDS,

  // rec props
  'AMERICAN_FOOTBALL:FTOT:PRCYOU': player_prop_types.GAME_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FTOT:PRCOU': player_prop_types.GAME_RECEPTIONS,
  'AMERICAN_FOOTBALL:FT:PROPLNGREC': player_prop_types.GAME_LONGEST_RECEPTION,
  'AMERICAN_FOOTBALL:FT:PRCY': player_prop_types.GAME_ALT_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FT:PRC': player_prop_types.GAME_ALT_RECEPTIONS,

  // rush props
  'AMERICAN_FOOTBALL:FTOT:PCOU': player_prop_types.GAME_RUSHING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FT:PROPRSPRCYDS':
    player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  'AMERICAN_FOOTBALL:FT:PRSY': player_prop_types.GAME_ALT_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FTOT:PRSYOU': player_prop_types.GAME_RUSHING_YARDS,
  'AMERICAN_FOOTBALL:FT:PC': player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
  'AMERICAN_FOOTBALL:FT:PROPLNGRUS': player_prop_types.GAME_LONGEST_RUSH,

  // 'AMERICAN_FOOTBALL:FT:PROPRSATT':

  // td props
  // 'AMERICAN_FOOTBALL:FT:PROPLSTTD': , LAST TOUCHDOWN SCORER
  // 'AMERICAN_FOOTBALL:FT:PROP1STTD', FIRST TOUCHDOWN SCORER
  // 'AMERICAN_FOOTBALL:FTOT:PRSTOU',
  // 'AMERICAN_FOOTBALL:FT:PRST',
  // 'AMERICAN_FOOTBALL:FT:PRCT',
  'AMERICAN_FOOTBALL:FT:PROPATD': player_prop_types.ANYTIME_TOUCHDOWN
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
