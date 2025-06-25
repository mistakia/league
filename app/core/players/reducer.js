import { Map, List, Set } from 'immutable'

import { player_actions } from './actions'
import { createPlayer } from './player'
import { statActions } from '@core/stats'
import { roster_actions } from '@core/rosters'
import { auctionActions } from '@core/auction'
import { appActions } from '@core/app'
import { data_view_request_actions } from '@core/data-view-request/actions'
import DefaultPlayersViews, {
  default_players_view_key,
  default_players_view_order_by
} from './default-players-views'

import { constants, league_has_starting_position } from '@libs-shared'

export const default_player_filter_options = {
  search: null,
  positions: new List(constants.positions),
  nflTeams: new List(constants.nflTeams),
  highlight_teamIds: new List(),
  teamIds: new List(),
  colleges: new List(constants.colleges),
  collegeDivisions: new List(constants.collegeDivisions),
  nfl_draft_rounds: new List(constants.nfl_draft_rounds),
  experience: new List([0, 1, -1]),
  selected_nfl_statuses: new List(Object.keys(constants.player_nfl_status)),
  teams: new List(),
  availability: new List(constants.availability)
}

const initialState = new Map({
  isPending: false,
  allPlayersLoaded: false,
  allPlayersPending: false,
  leaguePlayersLoaded: false,
  leaguePlayersPending: false,
  week: new List([constants.fantasy_season_week]),
  items: new Map(),
  order: 'desc',
  selected_players_page_view: default_players_view_key,
  players_page_views: new Map(DefaultPlayersViews),
  orderBy: default_players_view_order_by,
  watchlist: new Set(),
  watchlistOnly: false,
  cutlist: new List(),
  baselines: new Map(),
  selected: null,
  ...default_player_filter_options
})

export function playersReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED: {
      const league = payload.data.leagues[0]
      if (league) {
        return state.merge({
          positions: new List(
            constants.positions.filter((pos) =>
              league_has_starting_position({ pos, league })
            )
          )
        })
      }
      return state
    }

    case player_actions.SELECT_PLAYERS_PAGE_VIEW: {
      const view = state.getIn(['players_page_views', payload.view_key])
      return state.merge({
        selected_players_page_view: payload.view_key,
        orderBy: view.order_by,
        order: 'desc',
        week: new List([Math.max(constants.fantasy_season_week, 1)])
      })
    }

    case player_actions.SEARCH_PLAYERS:
      return state.merge({ search: payload.value })

    case player_actions.SET_PROJECTION:
    case player_actions.PUT_PROJECTION_FULFILLED: {
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

    case player_actions.REMOVE_PROJECTION:
    case player_actions.DEL_PROJECTION_FULFILLED: {
      const { pid, week } = payload.opts
      return state.setIn(
        ['items', pid, 'projections'],
        state
          .getIn(['items', pid, 'projections'])
          .filter((p) => p.sourceid || p.week !== week)
      )
    }

    case player_actions.PLAYERS_SELECT_PLAYER:
      return state.merge({ selected: payload.pid })

    case auctionActions.AUCTION_SELECT_PLAYER:
    case player_actions.PLAYERS_DESELECT_PLAYER:
      return state.merge({ selected: null })

    case player_actions.FILTER_PLAYERS:
      return state.merge({ [payload.type]: new List(payload.values) })

    case player_actions.TOGGLE_WATCHLIST_ONLY:
      return state.merge({ watchlistOnly: !state.get('watchlistOnly') })

    case player_actions.SET_PLAYERS_PAGE_ORDER: {
      const { order, orderBy } = payload
      return state.merge({ order, orderBy, selected: null })
    }

    case player_actions.SET_PLAYER_VALUES:
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
            pts_added: new Map(p.pts_added),
            salary_adj_pts_added: new Map(p.salary_adj_pts_added)
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

    case player_actions.SET_PLAYER_STATS:
      return state.withMutations((state) => {
        state.set('isPending', false)

        // clear player stats
        for (const pid of state.get('items').keys()) {
          state.deleteIn(['items', pid, 'stats'])
        }

        // set new stats
        for (const pid in payload.players) {
          if (state.get('items').get(pid)) {
            const stats = payload.players[pid]
            state.mergeIn(['items', pid, 'stats'], new Map(stats))
          }
        }
      })

    case player_actions.GET_PROJECTIONS_FULFILLED:
      return state.withMutations((players) => {
        payload.data.forEach((p) => {
          if (players.hasIn(['items', p.pid])) {
            players.updateIn(['items', p.pid, 'projections'], (arr) =>
              arr.push(p)
            )
          }
        })
      })

    case player_actions.SEARCH_PLAYERS_FULFILLED:
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

    case player_actions.FETCH_LEAGUE_PLAYERS_PENDING:
      return state.set('leaguePlayersPending', true)

    case player_actions.FETCH_ALL_PLAYERS_PENDING:
      return state.set('allPlayersPending', true)

    case player_actions.FETCH_ALL_PLAYERS_FULFILLED:
    case player_actions.FETCH_TEAM_PLAYERS_FULFILLED:
    case player_actions.FETCH_LEAGUE_PLAYERS_FULFILLED:
    case player_actions.FETCH_PLAYERS_FULFILLED: {
      return state.withMutations((players) => {
        if (type === player_actions.FETCH_ALL_PLAYERS_FULFILLED) {
          players.set('allPlayersLoaded', true)
          players.set('allPlayersPending', false)
        } else if (type === player_actions.FETCH_LEAGUE_PLAYERS_FULFILLED) {
          players.set('leaguePlayersLoaded', true)
          players.set('leaguePlayersPending', false)
        }
        players.set('isPending', false)

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
    }

    case player_actions.GET_PLAYER_FULFILLED:
      return state.withMutations((players) => {
        players.mergeIn(['items', payload.opts.pid], payload.data)
      })

    case player_actions.GET_PLAYER_PRACTICES_FULFILLED:
      return state.withMutations((players) => {
        players.setIn(
          ['items', payload.opts.pid, 'practice'],
          new List(payload.data)
        )
      })

    case player_actions.GET_CUTLIST_FULFILLED:
      return state.merge({
        cutlist: new List(payload.data)
      })

    case player_actions.TOGGLE_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { pid } = payload
      if (!pid) {
        return state
      }

      const index = cutlist.keyOf(pid)
      return state.merge({
        cutlist: index >= 0 ? cutlist.delete(index) : cutlist.push(pid)
      })
    }

    case player_actions.REORDER_CUTLIST: {
      const cutlist = state.get('cutlist')
      const { oldIndex, newIndex } = payload
      const pid = cutlist.get(oldIndex)
      const newCutlist = cutlist.delete(oldIndex).insert(newIndex, pid)
      return state.set('cutlist', newCutlist)
    }

    case player_actions.SET_WATCHLIST:
      return state.merge({
        watchlist: new Set(payload.watchlist)
      })

    case player_actions.TOGGLE_WATCHLIST: {
      const watchlist = state.get('watchlist')
      const { pid } = payload
      return state.merge({
        watchlist: watchlist.has(pid)
          ? watchlist.delete(pid)
          : watchlist.add(pid)
      })
    }

    case player_actions.SET_PROJECTED_CONTRIBUTION:
      return state.withMutations((state) => {
        for (const pid in payload.players) {
          state.setIn(['items', pid, 'lineups'], payload.players[pid])
        }
      })

    case roster_actions.GET_ROSTERS_FULFILLED: {
      const week = Math.min(
        constants.fantasy_season_week,
        constants.season.finalWeek
      )
      const rosters = payload.data.filter((r) => r.week === week)
      return state.withMutations((state) => {
        rosters.forEach((roster) => {
          roster.players.forEach((rosterSlot) => {
            const {
              pid,
              value,
              type,
              slot,
              tag,
              extensions,
              transition_tag_processed,
              transition_tag_nominated,
              transition_tag_announced
            } = rosterSlot
            const params = {
              value,
              tag,
              type,
              tid: roster.tid,
              extensions,
              slot,
              transition_tag_processed,
              transition_tag_nominated,
              transition_tag_announced
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

    case roster_actions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
      return state.withMutations((state) => {
        // Clear transition_tag_nominated for all players
        state.get('items').forEach((player, pid) => {
          if (player.get('transition_tag_nominated')) {
            state.setIn(['items', pid, 'transition_tag_nominated'], null)
          }
        })

        // Set transition_tag_nominated for the nominated player
        state.setIn(
          ['items', payload.opts.pid, 'transition_tag_nominated'],
          payload.data.nominated
        )
      })

    case roster_actions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
      return state.setIn(
        ['items', payload.opts.pid, 'transition_tag_nominated'],
        null
      )

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, pid, value, type } = payload
      return state.mergeIn(['items', pid], {
        value,
        type,
        tid,
        slot: constants.slots.BENCH
      })
    }

    case roster_actions.POST_RELEASE_FULFILLED: {
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

    case roster_actions.ROSTER_TRANSACTIONS:
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

    case roster_actions.POST_TAG_FULFILLED:
      return state.withMutations((state) => {
        state.mergeIn(['items', payload.opts.pid], { tag: payload.opts.tag })
        if (payload.opts.remove)
          state.mergeIn(['items', payload.opts.remove], {
            tag: constants.tags.REGULAR
          })
      })

    case roster_actions.POST_TRANSITION_TAG_FULFILLED:
    case roster_actions.PUT_TRANSITION_TAG_FULFILLED:
      return state.withMutations((state) => {
        const cutlist = state.get('cutlist')
        const { pid } = payload.data
        const index = cutlist.keyOf(pid)

        if (index >= 0) {
          state = state.set('cutlist', cutlist.delete(index))
        }

        state.mergeIn(['items', payload.data.pid], {
          tag: constants.tags.TRANSITION,
          bid: payload.data.bid,
          restricted_free_agency_conditional_releases:
            payload.data.release || []
        })

        if (payload.data.remove)
          state.mergeIn(['items', payload.data.remove], {
            tag: constants.tags.REGULAR
          })
      })

    case roster_actions.DELETE_TRANSITION_TAG_FULFILLED:
    case roster_actions.DELETE_TAG_FULFILLED: {
      const data = {
        bid: null,
        restricted_free_agency_conditional_releases: null
      }
      if (
        !payload.data.player_tid ||
        payload.data.player_tid === payload.data.tid
      ) {
        data.tag = constants.tags.REGULAR
      }
      return state.mergeIn(['items', payload.data.pid], data)
    }

    case roster_actions.PUT_ROSTER_FULFILLED: {
      return state.withMutations((state) => {
        payload.data.forEach(({ pid, slot }) =>
          state.mergeIn(['items', pid], { slot })
        )
      })
    }

    case roster_actions.POST_ACTIVATE_FULFILLED:
    case roster_actions.POST_DEACTIVATE_FULFILLED:
    case roster_actions.POST_PROTECT_FULFILLED:
    case roster_actions.POST_RESERVE_FULFILLED:
    case roster_actions.ROSTER_TRANSACTION: {
      const { pid, slot, transaction } = payload.data
      const { value, type, tid } = transaction
      return state.mergeIn(['items', pid], {
        value,
        type,
        slot,
        tid
      })
    }

    case player_actions.GET_PLAYER_TRANSACTIONS_PENDING:
      return state.setIn(
        ['items', payload.opts.pid, 'loadingTransactions'],
        true
      )

    case player_actions.GET_PLAYER_TRANSACTIONS_FAILED:
      return state.setIn(
        ['items', payload.opts.pid, 'loadingTransactions'],
        false
      )

    case player_actions.GET_PLAYER_TRANSACTIONS_FULFILLED:
      return state.mergeIn(['items', payload.opts.pid], {
        transactions: new List(payload.data),
        loadingTransactions: false
      })

    case player_actions.GET_BASELINES_FULFILLED:
      return state.withMutations((state) => {
        for (const baseline of payload.data) {
          const { week, pos, type, pid } = baseline
          state.setIn(['baselines', week, pos, type], pid)
        }
      })

    case player_actions.GET_PLAYER_PROJECTIONS_PENDING:
      return state.setIn(
        ['items', payload.opts.pid, 'loading_projections'],
        true
      )

    case player_actions.GET_PLAYER_PROJECTIONS_FAILED:
      return state.setIn(
        ['items', payload.opts.pid, 'loading_projections'],
        false
      )

    case player_actions.GET_PLAYER_PROJECTIONS_FULFILLED:
      return state.withMutations((state) => {
        state.setIn(
          ['items', payload.opts.pid, 'projections'],
          new List(payload.data)
        )
        state.setIn(['items', payload.opts.pid, 'loading_projections'], false)
      })

    case player_actions.RESET_PLAYER_FILTER_OPTIONS:
      return state.merge({ ...default_player_filter_options })

    case data_view_request_actions.DATA_VIEW_RESULT:
      return state.withMutations((players) => {
        payload.result.forEach((row) => {
          const formatted_player_data = {
            pid: row.pid,
            fname: row.fname,
            lname: row.lname
          }

          if (row.pos) {
            formatted_player_data.pos = row.pos
          }

          if (players.hasIn(['items', row.pid])) {
            const data = players.getIn(['items', row.pid])
            players.setIn(
              ['items', row.pid],
              createPlayer({
                ...data.toJS(),
                ...formatted_player_data
              })
            )
          } else {
            players.setIn(
              ['items', row.pid],
              createPlayer(formatted_player_data)
            )
          }
        })
      })

    case player_actions.GET_PLAYER_BETTING_MARKETS_FULFILLED:
      return state.withMutations((state) => {
        state.setIn(
          ['items', payload.opts.pid, 'betting_markets'],
          new List(payload.data)
        )
      })

    default:
      return state
  }
}
