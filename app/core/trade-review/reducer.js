import { Map, OrderedMap, List, fromJS } from 'immutable'

import { trade_review_actions } from './actions'

// Plain Map/List throughout, no Immutable Record. A Record silently drops any
// key its declaration does not list, and this is read-only display data whose
// shape is set by the API -- declaring it twice would only create a place for
// the two to disagree.
const initial_state = new Map({
  // trade_id -> Map({ perspectives, has_chains, is_pending, is_failed }), in
  // the order the API returned, which is oldest trade first.
  trades: new OrderedMap(),
  is_pending: false,
  // A refused request and a league with no trades both leave `trades` empty,
  // and the page must not report the first as the second -- the route is
  // member-only, so every anonymous visitor lands here.
  is_failed: false,
  // The lid the loaded list belongs to. A single-trade page fetches only its
  // own trade, so a list page that has never fetched this league must not read
  // a lone deep-linked trade as the whole list -- and coming back from a trade
  // must not recompute the whole review when the list is already here.
  list_lid: null
})

// The API returns one record per team per trade, two per trade, already sorted
// by date. Grouping preserves that order.
const group_by_trade = (records) => {
  let trades = new OrderedMap()
  for (const record of records) {
    const trade_id = record.trade_id
    const perspectives = trades.getIn([trade_id, 'perspectives'], new List())
    trades = trades.set(
      trade_id,
      new Map({
        perspectives: perspectives.push(fromJS(record)),
        has_chains: false,
        is_pending: false
      })
    )
  }
  return trades
}

export function trade_review_reducer(state = initial_state, { payload, type }) {
  switch (type) {
    case trade_review_actions.GET_TRADE_REVIEW_PENDING:
      return state.merge({ is_pending: true, is_failed: false })

    case trade_review_actions.GET_TRADE_REVIEW_FAILED:
      return state.merge({ is_pending: false, is_failed: true })

    case trade_review_actions.GET_TRADE_REVIEW_FULFILLED:
      return state.merge({
        trades: group_by_trade(payload.data),
        is_pending: false,
        is_failed: false,
        list_lid: payload.opts.leagueId
      })

    // Guarded rather than a bare setIn: a deep link fetches one trade before
    // the list has arrived, and setIn would otherwise conjure a trade entry
    // carrying a pending flag and no perspectives.
    case trade_review_actions.GET_TRADE_REVIEW_TRADE_PENDING:
      return state.hasIn(['trades', payload.opts.trade_id])
        ? state.setIn(['trades', payload.opts.trade_id, 'is_pending'], true)
        : state

    // A failure on an in-map trade just clears its pending flag and marks the
    // lineage unavailable. A failure on a trade the map has never seen (a stale
    // link to a trade that no longer exists) conjures an entry with no
    // perspectives so a single-trade page can say so instead of spinning
    // forever; the list filters such entries out when it renders.
    case trade_review_actions.GET_TRADE_REVIEW_TRADE_FAILED:
      return state.updateIn(['trades', payload.opts.trade_id], (trade_entry) =>
        trade_entry
          ? trade_entry.merge({ is_pending: false, is_failed: true })
          : new Map({
              perspectives: new List(),
              has_chains: false,
              is_pending: false,
              is_failed: true
            })
      )

    // The detail response is the same two records with a `chain` on every
    // asset, so it replaces the list's chainless pair rather than merging into
    // it. has_chains is what stops the page re-fetching on every expand.
    case trade_review_actions.GET_TRADE_REVIEW_TRADE_FULFILLED:
      return state.setIn(
        ['trades', payload.opts.trade_id],
        new Map({
          perspectives: fromJS(payload.data),
          has_chains: true,
          is_pending: false
        })
      )

    default:
      return state
  }
}
