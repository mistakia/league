import { Odds } from 'oddslib'

import { getPlayerById } from '@core/players'
import { constants } from '@common'

export function getProps(state) {
  return state.getIn(['props', 'items'])
}

export function getFilteredProps(state) {
  const props = getProps(state)

  // filter props

  const items = props.toJS()

  for (const prop of items) {
    const playerMap = getPlayerById(state, { pid: prop.pid })
    const proj = playerMap.getIn(['projection', `${prop.wk}`], {})
    switch (prop.type) {
      case constants.player_prop_types.GAME_PASSING_YARDS:
        prop.proj = proj.py
        break

      case constants.player_prop_types.GAME_RECEIVING_YARDS:
        prop.proj = proj.recy
        break

      case constants.player_prop_types.GAME_RUSHING_YARDS:
        prop.proj = proj.ry
        break

      case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
        prop.proj = proj.pc
        break

      case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
        prop.proj = proj.tdp
        break

      case constants.player_prop_types.GAME_RECEPTIONS:
        prop.proj = proj.rec
        break

      case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
        prop.proj = proj.ints
        break

      case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
        prop.proj = proj.ra
        break

      case constants.player_prop_types.GAME_TOUCHDOWNS:
        prop.proj = proj.tdr + proj.tdrec
        break

      default:
        console.log(`unrecognized betype: ${prop.type}`)
    }

    prop.diff = prop.proj - prop.ln
    prop.abs = Math.abs(prop.diff)
    prop.odds = Odds.from('decimal', prop.diff > 0 ? prop.o : prop.u).to(
      'moneyline',
      { precision: 0 }
    )
  }

  return items.sort((a, b) => b.abs - a.abs)
}
