import moment from 'moment'
import { Map, List } from 'immutable'
import { playerActions } from './actions'
import { createPlayer } from './player'

import { DEFAULT_ORDER_BY } from '@core/constants'

import {
  constants,
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues
} from '@common'

const initialState = new Map({
  isPending: false,
  search: null,
  positions: new List(['QB', 'RB', 'WR', 'TE', 'K', 'DST']),
  nflTeams: new List(constants.nflTeams),
  experience: new List([0, 1, -1]),
  health: new List(['ir', 'healthy']),
  teams: new List(),
  status: new List(['available', 'rostered']),
  week: constants.week,
  age: new List(),
  allAges: new List(),
  items: new Map(),
  order: 'desc',
  orderBy: DEFAULT_ORDER_BY,
  selected: null
})

export function playersReducer (state = initialState, { payload, type }) {
  switch (type) {
    case playerActions.SEARCH_PLAYERS:
      return state.merge({ search: payload.value })

    case playerActions.PUT_PROJECTION_FULFILLED: {
      const { value, type, week, playerId, userId } = payload.opts
      const key = state.get('items').get(playerId).get('projections').findKey(p => p.userid)
      if (key) {
        return state.setIn(['items', playerId, 'projections', key, type], value)
      }
      const newProj = { [type]: value, userid: userId, week, player: playerId }
      return state.updateIn(['items', playerId, 'projections'], arr => arr.push(newProj))
    }

    case playerActions.DEL_PROJECTION_FULFILLED: {
      const { playerId } = payload.opts
      return state.setIn(['items', playerId, 'projections'],
        state.getIn(['items', playerId, 'projections']).filter(p => !p.userid)
      )
    }

    case playerActions.PLAYERS_SELECT_PLAYER:
      return state.merge({ selected: payload.player })

    case playerActions.PLAYERS_DESELECT_PLAYER:
      return state.merge({ selected: null })

    case playerActions.FILTER_PLAYERS:
      return state.merge({ [payload.type]: new List(payload.values) })

    case playerActions.SET_ORDER: {
      const { order, orderBy } = payload
      return state.merge({ order, orderBy, selected: null })
    }

    case playerActions.CALCULATE_VALUES: {
      return state.withMutations(state => {
        const { userId } = payload
        for (const league of payload.leagues) {
          const leag = league.toJS()
          const players = payload.players.valueSeq().toJS()
          for (const player of players) {
            const { projections } = player

            player.projection = weightProjections({
              projections,
              weights: payload.sources,
              userId
            })
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

        const now = moment()
        const ages = []
        payload.data.map(p => {
          const age = parseInt(now.diff(moment(p.dob), 'years'), 10)
          if (!isNaN(age)) ages.push(age)
        })

        const distinctAges = Array.from(new Set(ages)).sort((a, b) => a - b)
        players.set('age', new List(distinctAges))
        players.set('allAges', new List(distinctAges))

        // TODO - get colleges

        payload.data.forEach(playerData => {
          players.setIn(['items', playerData.player], createPlayer(playerData))
        })
      })

    case playerActions.GET_PLAYER_STATS_FULFILLED:
      return state.withMutations(players => {
        players.setIn(['items', payload.opts.playerId, 'games'], new List(payload.data.games))
      })

    default:
      return state
  }
}
