import dayjs from 'dayjs'
import { Map, List, Set } from 'immutable'

import { settingActions } from '@core/settings'
import { appActions } from '@core/app'
import { playerActions } from './actions'
import { createPlayer } from './player'
import { statActions } from '@core/stats'
import { rosterActions } from '@core/rosters'
import { auctionActions } from '@core/auction'

import { constants } from '@common'

const isOffseason = constants.season.isOffseason

const initialState = new Map({
  isInitializing: true,
  isPending: false,
  search: null,
  positions: new List(['QB', 'RB', 'WR', 'TE', 'K', 'DST']),
  nflTeams: new List(constants.nflTeams),
  teamIds: new List(),
  colleges: new List(constants.colleges),
  collegeDivisions: new List(constants.collegeDivisions),
  experience: new List([0, 1, -1]),
  status: new List(Object.keys(constants.status)),
  teams: new List(),
  availability: new List(constants.availability),
  week: new List([constants.season.week]),
  age: new List(),
  allAges: new List(),
  items: new Map(),
  order: 'desc',
  view: isOffseason ? 'season' : 'ros',
  orderBy: isOffseason ? 'vorp.0' : 'vorp.ros',
  watchlist: new Set(),
  cutlist: new List(),
  baselines: new Map(),
  selected: null
})

export function playersReducer(state = initialState, { payload, type }) {
  switch (type) {
    case playerActions.SET_PLAYERS_VIEW: {
      // TODO - reset orderBy
      const week =
        payload.view === 'season'
          ? new List([0])
          : new List([Math.max(constants.season.week, 1)])
      return state.merge({ view: payload.view, week })
    }

    case playerActions.SEARCH_PLAYERS:
      return state.merge({ search: payload.value })

    case playerActions.SET_PROJECTION:
    case playerActions.PUT_PROJECTION_FULFILLED: {
      const { value, type, week, playerId, userId } = payload.opts
      const key = state
        .get('items')
        .get(playerId)
        .get('projections')
        .findKey((p) => !p.sourceid)
      if (typeof key !== 'undefined') {
        return state.setIn(['items', playerId, 'projections', key, type], value)
      }
      const newProj = { [type]: value, userid: userId, week, player: playerId }
      return state.updateIn(['items', playerId, 'projections'], (arr) =>
        arr.push(newProj)
      )
    }

    case playerActions.REMOVE_PROJECTION:
    case playerActions.DEL_PROJECTION_FULFILLED: {
      const { playerId, week } = payload.opts
      return state.setIn(
        ['items', playerId, 'projections'],
        state
          .getIn(['items', playerId, 'projections'])
          .filter((p) => p.sourceid || p.week !== week)
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
      return state.withMutations((state) => {
        for (const week in payload.baselines) {
          for (const b in payload.baselines[week]) {
            for (const type in payload.baselines[week][b]) {
              state.setIn(
                ['baselines', week, b, type],
                payload.baselines[week][b][type].player
              )
            }
          }
        }
        payload.players.forEach((p) => {
          state.mergeIn(['items', p.player], {
            points: new Map(p.points),
            market_salary: new Map(p.market_salary),
            market_salary_adj: new Map(p.market_salary_adj),
            vorp: new Map(p.vorp),
            vorp_adj: new Map(p.vorp_adj)
          })
        })
      })

    case statActions.FILTER_STATS:
      return state.withMutations((state) => {
        state.set('isPending', true)
        const stats = constants.createFullStats()
        for (const player of state.get('items').keys()) {
          state.setIn(['items', player, 'stats'], new Map(stats))
        }
      })

    case playerActions.SET_PLAYER_STATS:
      return state.withMutations((state) => {
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

    case playerActions.GET_PROJECTIONS_FULFILLED:
      return state.withMutations((players) => {
        payload.data.forEach((p) => {
          if (players.hasIn(['items', p.player])) {
            players.updateIn(['items', p.player, 'projections'], (arr) =>
              arr.push(p)
            )
          }
        })
      })

    case playerActions.SEARCH_PLAYERS_FULFILLED:
      return state.withMutations((players) => {
        payload.data.forEach((playerData) => {
          if (players.hasIn(['items', playerData.player])) {
            const data = players.getIn(['items', playerData.player])
            players.setIn(
              ['items', playerData.player],
              createPlayer({
                ...data.toJS(),
                ...playerData
              })
            )
          } else {
            players.setIn(
              ['items', playerData.player],
              createPlayer(playerData)
            )
          }
        })
      })

    case playerActions.FETCH_PLAYERS_FULFILLED:
      return state.withMutations((players) => {
        players.set('isInitializing', false)
        players.set('isPending', false)

        const now = dayjs()
        const ages = []
        payload.data.forEach((p) => {
          const age = parseInt(now.diff(dayjs(p.dob), 'years'), 10)
          if (!isNaN(age)) ages.push(age)
        })

        const distinctAges = Array.from(new Set(ages)).sort((a, b) => a - b)
        players.set('age', new List(distinctAges))
        players.set('allAges', new List(distinctAges))

        payload.data.forEach((playerData) => {
          if (players.hasIn(['items', playerData.player])) {
            const data = players.getIn(['items', playerData.player])
            players.setIn(
              ['items', playerData.player],
              createPlayer({
                ...data.toJS(),
                ...playerData
              })
            )
          } else {
            players.setIn(
              ['items', playerData.player],
              createPlayer(playerData)
            )
          }
        })
      })

    case playerActions.GET_PLAYER_FULFILLED:
      return state.withMutations((players) => {
        const { practice, ...player } = payload.data
        players.mergeIn(['items', payload.opts.playerId], player)
        players.setIn(
          ['items', payload.opts.playerId, 'practice'],
          new List(practice)
        )
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations((players) => {
        const week = isOffseason ? '0' : 'ros'
        players.merge({
          orderBy: `vorp.${week}`
        })

        if (payload.data.user.qbb) {
          players.setIn(['baselines', 'QB', 'manual'], payload.data.user.qbb)
        }

        if (payload.data.user.rbb) {
          players.setIn(['baselines', 'RB', 'manual'], payload.data.user.rbb)
        }

        if (payload.data.user.wrb) {
          players.setIn(['baselines', 'WR', 'manual'], payload.data.user.wrb)
        }

        if (payload.data.user.teb) {
          players.setIn(['baselines', 'TE', 'manual'], payload.data.user.teb)
        }
      })

    case settingActions.SET_BASELINES:
    case settingActions.PUT_BASELINES_FULFILLED:
      return state.withMutations((players) => {
        for (const pos in payload.data) {
          players.setIn(['baselines', pos, 'manual'], payload.data[pos])
        }
      })

    /* case settingActions.SET_SETTING:
     * case settingActions.PUT_SETTING_FULFILLED: {
     *   if (payload.opts.type !== 'vbaseline') {
     *     return state
     *   }
     *   const value = payload.data ? payload.data.value : payload.opts.value
     *   const week = isOffseason ? '0' : 'ros'
     *   return state.merge({ orderBy: `vorp.${week}.${value}` })
     * }
     */
    case playerActions.GET_CUTLIST_FULFILLED:
      return state.merge({
        cutlist: new List(payload.data)
      })

    case playerActions.TOGGLE_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { player } = payload
      const index = cutlist.keyOf(player)
      return state.merge({
        cutlist: index >= 0 ? cutlist.delete(index) : cutlist.push(player)
      })
    }

    case playerActions.REORDER_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { oldIndex, newIndex } = payload
      const player = cutlist.get(oldIndex)
      const newCutlist = cutlist.delete(oldIndex).insert(newIndex, player)
      return state.set('cutlist', newCutlist)
    }

    case playerActions.SET_WATCHLIST:
      return state.merge({
        watchlist: new Set(payload.watchlist)
      })

    case playerActions.TOGGLE_WATCHLIST: {
      const watchlist = state.get('watchlist')
      const { playerId } = payload
      return state.merge({
        watchlist: watchlist.has(playerId)
          ? watchlist.delete(playerId)
          : watchlist.add(playerId)
      })
    }

    case playerActions.SET_PROJECTED_CONTRIBUTION:
      return state.withMutations((state) => {
        for (const playerId in payload.players) {
          state.setIn(['items', playerId, 'lineups'], payload.players[playerId])
        }
      })

    case rosterActions.GET_ROSTERS_FULFILLED: {
      const week = Math.min(constants.season.week, constants.season.finalWeek)
      const rosters = payload.data.filter((r) => r.week === week)
      return state.withMutations((state) => {
        rosters.forEach((roster) => {
          roster.players.forEach((rosterSlot) => {
            const { player, value, type, slot, tag } = rosterSlot
            const params = {
              value,
              tag,
              type,
              tid: roster.tid,
              slot
            }
            if (state.hasIn(['items', player])) {
              state.mergeIn(['items', player], params)
            } else {
              state.setIn(['items', player], createPlayer(params))
            }
          })
        })
      })
    }

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, player, value, type } = payload
      return state.mergeIn(['items', player], {
        value,
        type,
        tid,
        slot: constants.slots.BENCH
      })
    }

    case rosterActions.POST_RELEASE_FULFILLED:
      return state.mergeIn(['items', payload.data.player], {
        value: null,
        tag: null,
        type: null,
        tid: null,
        slot: null
      })

    case rosterActions.ROSTER_TRANSACTIONS:
      return state.withMutations((state) => {
        payload.data.forEach((p) => {
          const t = p.transaction
          if (t.type === constants.transactions.ROSTER_RELEASE) {
            state.mergeIn(['items', t.player], {
              value: null,
              tag: null,
              type: null,
              tid: null,
              slot: null
            })
          } else {
            state.mergeIn(['items', t.player], {
              value: t.value,
              type: t.type,
              tid: t.tid,
              slot: p.slot
            })
          }
        })
      })

    case rosterActions.POST_TAG_FULFILLED:
      return state.withMutations((state) => {
        state.mergeIn(['items', payload.opts.player], { tag: payload.opts.tag })
        if (payload.opts.remove)
          state.mergeIn(['items', payload.opts.remove], {
            tag: constants.tags.REGULAR
          })
      })

    case rosterActions.POST_TRANSITION_TAG_FULFILLED:
    case rosterActions.PUT_TRANSITION_TAG_FULFILLED:
      return state.withMutations((state) => {
        state.mergeIn(['items', payload.data.player], {
          tag: constants.tags.TRANSITION,
          bid: payload.data.bid
        })

        if (payload.data.remove)
          state.mergeIn(['items', payload.data.remove], {
            tag: constants.tags.REGULAR
          })
      })

    case rosterActions.DELETE_TRANSITION_TAG_FULFILLED:
    case rosterActions.DELETE_TAG_FULFILLED: {
      const data = { bid: null }
      if (
        !payload.data.player_tid ||
        payload.data.player_tid === payload.data.tid
      ) {
        data.tag = constants.tags.REGULAR
      }
      return state.mergeIn(['items', payload.data.player], data)
    }

    case rosterActions.PUT_ROSTER_FULFILLED: {
      return state.withMutations((state) => {
        payload.data.forEach(({ player, slot }) =>
          state.mergeIn(['items', player], { slot })
        )
      })
    }

    case rosterActions.POST_ACTIVATE_FULFILLED:
    case rosterActions.POST_DEACTIVATE_FULFILLED:
    case rosterActions.POST_PROTECT_FULFILLED:
    case rosterActions.POST_RESERVE_FULFILLED:
    case rosterActions.ROSTER_TRANSACTION: {
      const { player, slot, transaction } = payload.data
      const { value, type, tid } = transaction
      return state.mergeIn(['items', player], {
        value,
        type,
        slot,
        tid
      })
    }

    case playerActions.GET_PLAYER_TRANSACTIONS_PENDING:
      return state.setIn(
        ['items', payload.opts.player, 'loadingTransactions'],
        true
      )

    case playerActions.GET_PLAYER_TRANSACTIONS_FAILED:
      return state.setIn(
        ['items', payload.opts.player, 'loadingTransactions'],
        false
      )

    case playerActions.GET_PLAYER_TRANSACTIONS_FULFILLED:
      return state.mergeIn(['items', payload.opts.player], {
        transactions: new List(payload.data),
        loadingTransactions: false
      })

    case playerActions.GET_BASELINES_FULFILLED:
      return state.withMutations((state) => {
        for (const baseline of payload.data) {
          const { week, pos, type, player } = baseline
          state.setIn(['baselines', week, pos, type], player)
        }
      })

    default:
      return state
  }
}
