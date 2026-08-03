import { Map, OrderedMap, List, fromJS } from 'immutable'

import { trade_review_actions } from './actions'

// Plain Map/List throughout, no Immutable Record. A Record silently drops any
// key its declaration does not list, and this is read-only display data whose
// shape is set by the API -- declaring it twice would only create a place for
// the two to disagree.
const initial_state = new Map({
  // trade_uid -> Map({ perspectives, has_chains, is_pending }), in the order
  // the API returned, which is oldest trade first.
  trades: new OrderedMap(),
  is_pending: false
})

// The API returns one record per team per trade, two per trade, already sorted
// by date. Grouping preserves that order.
const group_by_trade = (records) => {
  let trades = new OrderedMap()
  for (const record of records) {
    const trade_uid = record.trade_uid
    const perspectives = trades.getIn([trade_uid, 'perspectives'], new List())
    trades = trades.set(
      trade_uid,
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
      return state.merge({ is_pending: true })

    case trade_review_actions.GET_TRADE_REVIEW_FAILED:
      return state.merge({ is_pending: false })

    case trade_review_actions.GET_TRADE_REVIEW_FULFILLED:
      return state.merge({
        trades: group_by_trade(payload.data),
        is_pending: false
      })

    // Guarded rather than a bare setIn: a deep link fetches one trade before
    // the list has arrived, and setIn would otherwise conjure a trade entry
    // carrying a pending flag and no perspectives.
    case trade_review_actions.GET_TRADE_REVIEW_TRADE_PENDING:
      return state.hasIn(['trades', payload.opts.trade_uid])
        ? state.setIn(['trades', payload.opts.trade_uid, 'is_pending'], true)
        : state

    case trade_review_actions.GET_TRADE_REVIEW_TRADE_FAILED:
      return state.hasIn(['trades', payload.opts.trade_uid])
        ? state.setIn(['trades', payload.opts.trade_uid, 'is_pending'], false)
        : state

    // The detail response is the same two records with a `chain` on every
    // asset, so it replaces the list's chainless pair rather than merging into
    // it. has_chains is what stops the page re-fetching on every expand.
    case trade_review_actions.GET_TRADE_REVIEW_TRADE_FULFILLED:
      return state.setIn(
        ['trades', payload.opts.trade_uid],
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
