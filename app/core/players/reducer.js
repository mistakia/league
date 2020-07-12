import moment from 'moment'
import { Map, List, Set } from 'immutable'

import { settingActions } from '@core/settings'
import { appActions } from '@core/app'
import { playerActions } from './actions'
import { createPlayer } from './player'
import { statActions } from '@core/stats'

import { constants } from '@common'

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
  view: 'seasproj',
  orderBy: 'vorp.available',
  watchlist: new Set(),
  selected: null
})

export function playersReducer (state = initialState, { payload, type }) {
  switch (type) {
    case playerActions.SET_PLAYERS_VIEW:
      return state.merge({ view: payload.view })

    case playerActions.SEARCH_PLAYERS:
      return state.merge({ search: payload.value })

    case playerActions.SET_PROJECTION:
    case playerActions.PUT_PROJECTION_FULFILLED: {
      const { value, type, week, playerId, userId } = payload.opts
      const key = state.get('items').get(playerId).get('projections').findKey(p => !p.sourceid)
      if (key) {
        return state.setIn(['items', playerId, 'projections', key, type], value)
      }
      const newProj = { [type]: value, userid: userId, week, player: playerId }
      return state.updateIn(['items', playerId, 'projections'], arr => arr.push(newProj))
    }

    case playerActions.REMOVE_PROJECTION:
    case playerActions.DEL_PROJECTION_FULFILLED: {
      const { playerId } = payload.opts
      return state.setIn(['items', playerId, 'projections'],
        state.getIn(['items', playerId, 'projections']).filter(p => p.sourceid)
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

    case playerActions.SET_PLAYER_VALUES:
      return state.withMutations(state => {
        state.set('isPending', false)
        payload.players.forEach(playerData => {
          state.mergeIn(['items', playerData.player], {
            projection: new Map(playerData.projection),
            points: new Map(playerData.points),
            values: new Map(playerData.values),
            vorp: new Map(playerData.vorp)
          })
        })
      })

    case statActions.FILTER_STATS:
      return state.withMutations(state => {
        state.set('isPending', true)
        const stats = constants.createFullStats()
        for (const player of state.get('items').keys()) {
          state.setIn(['items', player, 'stats'], new Map(stats))
        }
      })

    case playerActions.SET_PLAYER_STATS:
      return state.withMutations(state => {
        state.set('isPending', false)
        for (const player in payload.players) {
          if (state.get('items').get(player)) {
            const stats = payload.players[player]
            state.mergeIn(['items', player, 'stats'], new Map(stats))
          }
        }
      })

    case playerActions.FETCH_PLAYERS_PENDING:
      return state.merge({
        isPending: true
      })

    case playerActions.FETCH_PLAYERS_FAILED:
      return state.merge({
        isPending: false
      })

    case playerActions.FETCH_PLAYERS_FULFILLED:
      return state.withMutations(players => {
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

    case appActions.AUTH_FULFILLED:
      return state.merge({
        orderBy: `vorp.${payload.data.user.vbaseline}`
      })

    case settingActions.SET_SETTING:
    case settingActions.PUT_SETTING_FULFILLED:
      if (payload.opts.type === 'vbaseline') {
        const value = payload.data ? payload.data.value : payload.opts.value
        return state.merge({
          orderBy: `vorp.${value}`
        })
      }
      return state

    case playerActions.SET_WATCHLIST:
      return state.merge({
        watchlist: new Set(payload.watchlist)
      })

    case playerActions.TOGGLE_WATCHLIST: {
      const watchlist = state.get('watchlist')
      const { playerId } = payload
      return state.merge({
        watchlist: watchlist.has(playerId) ? watchlist.delete(playerId) : watchlist.add(playerId)
      })
    }

    default:
      return state
  }
}
