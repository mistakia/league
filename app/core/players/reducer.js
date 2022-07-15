import dayjs from 'dayjs'
import { Map, List, Set } from 'immutable'

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
  watchlistOnly: false,
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
      if (payload.view === 'stats') {
        return state.merge({
          view: 'stats',
          orderBy: 'stats.pts',
          order: 'desc'
        })
      } else {
        return state.merge({ view: payload.view, week })
      }
    }

    case playerActions.SEARCH_PLAYERS:
      return state.merge({ search: payload.value })

    case playerActions.SET_PROJECTION:
    case playerActions.PUT_PROJECTION_FULFILLED: {
      const { value, type, week, pid, userId } = payload.opts
      const key = state
        .get('items')
        .get(pid)
        .get('projections')
        .findKey((p) => !p.sourceid)
      if (typeof key !== 'undefined') {
        return state.setIn(['items', pid, 'projections', key, type], value)
      }
      const newProj = { [type]: value, userid: userId, week, pid }
      return state.updateIn(['items', pid, 'projections'], (arr) =>
        arr.push(newProj)
      )
    }

    case playerActions.REMOVE_PROJECTION:
    case playerActions.DEL_PROJECTION_FULFILLED: {
      const { pid, week } = payload.opts
      return state.setIn(
        ['items', pid, 'projections'],
        state
          .getIn(['items', pid, 'projections'])
          .filter((p) => p.sourceid || p.week !== week)
      )
    }

    case playerActions.PLAYERS_SELECT_PLAYER:
      return state.merge({ selected: payload.pid })

    case playerActions.PLAYERS_DESELECT_PLAYER:
      return state.merge({ selected: null })

    case playerActions.FILTER_PLAYERS:
      return state.merge({ [payload.type]: new List(payload.values) })

    case playerActions.TOGGLE_WATCHLIST_ONLY:
      return state.merge({ watchlistOnly: !state.get('watchlistOnly') })

    case playerActions.SET_ORDER: {
      const { order, orderBy } = payload
      return state.merge({ order, orderBy, selected: null })
    }

    case playerActions.SET_PLAYER_VALUES:
      return state.withMutations((state) => {
        for (const week in payload.baselines) {
          for (const position in payload.baselines[week]) {
            for (const baseline_type in payload.baselines[week][position]) {
              state.setIn(
                ['baselines', week, position, baseline_type],
                payload.baselines[week][position][baseline_type].pid
              )
            }
          }
        }
        payload.players.forEach((p) => {
          state.mergeIn(['items', p.pid], {
            points: new Map(p.points),
            market_salary: new Map(p.market_salary),
            vorp: new Map(p.vorp),
            vorp_adj: new Map(p.vorp_adj)
          })
        })
      })

    case statActions.FILTER_STATS:
      return state.withMutations((state) => {
        state.set('isPending', true)
        const stats = constants.createFullStats()
        for (const pid of state.get('items').keys()) {
          state.setIn(['items', pid, 'stats'], new Map(stats))
        }
      })

    case playerActions.SET_PLAYER_STATS:
      return state.withMutations((state) => {
        state.set('isPending', false)
        for (const pid in payload.players) {
          if (state.get('items').get(pid)) {
            const stats = payload.players[pid]
            state.mergeIn(['items', pid, 'stats'], new Map(stats))
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
          if (players.hasIn(['items', p.pid])) {
            players.updateIn(['items', p.pid, 'projections'], (arr) =>
              arr.push(p)
            )
          }
        })
      })

    case playerActions.SEARCH_PLAYERS_FULFILLED:
      return state.withMutations((players) => {
        payload.data.forEach((playerData) => {
          if (players.hasIn(['items', playerData.pid])) {
            const data = players.getIn(['items', playerData.pid])
            players.setIn(
              ['items', playerData.pid],
              createPlayer({
                ...data.toJS(),
                ...playerData
              })
            )
          } else {
            players.setIn(['items', playerData.pid], createPlayer(playerData))
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
          if (players.hasIn(['items', playerData.pid])) {
            const data = players.getIn(['items', playerData.pid])
            players.setIn(
              ['items', playerData.pid],
              createPlayer({
                ...data.toJS(),
                ...playerData
              })
            )
          } else {
            players.setIn(['items', playerData.pid], createPlayer(playerData))
          }
        })
      })

    case playerActions.GET_PLAYER_FULFILLED:
      return state.withMutations((players) => {
        const { practice, ...player } = payload.data
        players.mergeIn(['items', payload.opts.pid], player)
        players.setIn(
          ['items', payload.opts.pid, 'practice'],
          new List(practice)
        )
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations((players) => {
        const week = isOffseason ? '0' : 'ros'
        players.merge({
          orderBy: `vorp.${week}`
        })
      })

    case playerActions.GET_CUTLIST_FULFILLED:
      return state.merge({
        cutlist: new List(payload.data)
      })

    case playerActions.TOGGLE_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { pid } = payload
      const index = cutlist.keyOf(pid)
      return state.merge({
        cutlist: index >= 0 ? cutlist.delete(index) : cutlist.push(pid)
      })
    }

    case playerActions.REORDER_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { oldIndex, newIndex } = payload
      const pid = cutlist.get(oldIndex)
      const newCutlist = cutlist.delete(oldIndex).insert(newIndex, pid)
      return state.set('cutlist', newCutlist)
    }

    case playerActions.SET_WATCHLIST:
      return state.merge({
        watchlist: new Set(payload.watchlist)
      })

    case playerActions.TOGGLE_WATCHLIST: {
      const watchlist = state.get('watchlist')
      const { pid } = payload
      return state.merge({
        watchlist: watchlist.has(pid)
          ? watchlist.delete(pid)
          : watchlist.add(pid)
      })
    }

    case playerActions.SET_PROJECTED_CONTRIBUTION:
      return state.withMutations((state) => {
        for (const pid in payload.players) {
          state.setIn(['items', pid, 'lineups'], payload.players[pid])
        }
      })

    case rosterActions.GET_ROSTERS_FULFILLED: {
      const week = constants.season.week
      const rosters = payload.data.filter((r) => r.week === week)
      return state.withMutations((state) => {
        rosters.forEach((roster) => {
          roster.players.forEach((rosterSlot) => {
            const { pid, value, type, slot, tag, extensions } = rosterSlot
            const params = {
              value,
              tag,
              type,
              tid: roster.tid,
              extensions,
              slot
            }
            if (state.hasIn(['items', pid])) {
              state.mergeIn(['items', pid], params)
            } else {
              state.setIn(['items', pid], createPlayer(params))
            }
          })
        })
      })
    }

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, pid, value, type } = payload
      return state.mergeIn(['items', pid], {
        value,
        type,
        tid,
        slot: constants.slots.BENCH
      })
    }

    case rosterActions.POST_RELEASE_FULFILLED: {
      const cutlist = state.get('cutlist')
      const { pid } = payload.data
      const index = cutlist.keyOf(pid)

      if (index >= 0) {
        state = state.set('cutlist', cutlist.delete(index))
      }

      return state.mergeIn(['items', pid], {
        value: null,
        tag: null,
        type: null,
        tid: null,
        slot: null
      })
    }

    case rosterActions.ROSTER_TRANSACTIONS:
      return state.withMutations((state) => {
        payload.data.forEach((p) => {
          const t = p.transaction
          if (t.type === constants.transactions.ROSTER_RELEASE) {
            state.mergeIn(['items', t.pid], {
              value: null,
              tag: null,
              type: null,
              tid: null,
              slot: null
            })
          } else {
            state.mergeIn(['items', t.pid], {
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
        state.mergeIn(['items', payload.opts.pid], { tag: payload.opts.tag })
        if (payload.opts.remove)
          state.mergeIn(['items', payload.opts.remove], {
            tag: constants.tags.REGULAR
          })
      })

    case rosterActions.POST_TRANSITION_TAG_FULFILLED:
    case rosterActions.PUT_TRANSITION_TAG_FULFILLED:
      return state.withMutations((state) => {
        const cutlist = state.get('cutlist')
        const { pid } = payload.data
        const index = cutlist.keyOf(pid)

        if (index >= 0) {
          state = state.set('cutlist', cutlist.delete(index))
        }

        state.mergeIn(['items', payload.data.pid], {
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
      return state.mergeIn(['items', payload.data.pid], data)
    }

    case rosterActions.PUT_ROSTER_FULFILLED: {
      return state.withMutations((state) => {
        payload.data.forEach(({ pid, slot }) =>
          state.mergeIn(['items', pid], { slot })
        )
      })
    }

    case rosterActions.POST_ACTIVATE_FULFILLED:
    case rosterActions.POST_DEACTIVATE_FULFILLED:
    case rosterActions.POST_PROTECT_FULFILLED:
    case rosterActions.POST_RESERVE_FULFILLED:
    case rosterActions.ROSTER_TRANSACTION: {
      const { pid, slot, transaction } = payload.data
      const { value, type, tid } = transaction
      return state.mergeIn(['items', pid], {
        value,
        type,
        slot,
        tid
      })
    }

    case playerActions.GET_PLAYER_TRANSACTIONS_PENDING:
      return state.setIn(
        ['items', payload.opts.pid, 'loadingTransactions'],
        true
      )

    case playerActions.GET_PLAYER_TRANSACTIONS_FAILED:
      return state.setIn(
        ['items', payload.opts.pid, 'loadingTransactions'],
        false
      )

    case playerActions.GET_PLAYER_TRANSACTIONS_FULFILLED:
      return state.mergeIn(['items', payload.opts.pid], {
        transactions: new List(payload.data),
        loadingTransactions: false
      })

    case playerActions.GET_BASELINES_FULFILLED:
      return state.withMutations((state) => {
        for (const baseline of payload.data) {
          const { week, pos, type, pid } = baseline
          state.setIn(['baselines', week, pos, type], pid)
        }
      })

    case playerActions.GET_PLAYER_PROJECTIONS_FULFILLED:
      return state.setIn(
        ['items', payload.opts.pid, 'projections'],
        new List(payload.data)
      )

    default:
      return state
  }
}
