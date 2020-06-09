import { Map, List } from 'immutable'
import { playerActions } from './actions'
import { createPlayer } from './player'

import {
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues
} from '@common'

const initialState = new Map({
  isPending: false,
  positions: new List(['QB', 'RB', 'WR', 'TE', 'K', 'DST']),
  items: new Map()
})

export function playersReducer (state = initialState, { payload, type }) {
  switch (type) {
    case playerActions.FILTER_POSITIONS:
      return state.merge({
        positions: new List(payload.positions)
      })

    case playerActions.CALCULATE_VALUES: {
      return state.withMutations(state => {
        for (const league of payload.leagues) {
          const leag = league.toJS()
          const players = payload.players.valueSeq().toJS()
          for (const player of players) {
            const { projections } = player

            // TODO weights
            player.projection = weightProjections({ projections, weights: [] })
            const { projection } = player

            // calculate points for each league
            player.points = calculatePoints({ stats: projection, ...leag })
          }

          // calculate worst starter baseline
          const baselines = calculateBaselines({ players, ...leag })
          const result = calculateValues({ players, baselines, ...leag })
          // TODO - set per league
          result.forEach(playerData => {
            state.mergeIn(['items', playerData.player], {
              projection: new Map(playerData.projection),
              points: new Map(playerData.points),
              values: new Map(playerData.values),
              vorp: new Map(playerData.vorp)
            })
          })
        }
      })
    }

    case playerActions.FETCH_PLAYER_PENDING:
      return state.merge({
        isPending: true
      })

    case playerActions.FETCH_PLAYER_FAILED:
      return state.merge({
        isPending: false
      })

    case playerActions.FETCH_PLAYERS_FULFILLED:
      return state.withMutations(players => {
        players.set('isPending', false)
        payload.data.forEach(playerData => {
          players.setIn(['items', playerData.player], createPlayer(playerData))
        })
      })

    default:
      return state
  }
}
