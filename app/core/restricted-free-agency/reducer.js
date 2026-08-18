import { Map, List, fromJS } from 'immutable'

import { restricted_free_agency_actions } from './actions'
import { current_season } from '#constants'

const initial_state = new Map({
  auctions: new List(),
  year: current_season.year,
  is_pending: false
})

export function restricted_free_agency_reducer(
  state = initial_state,
  { payload, type }
) {
  switch (type) {
    case restricted_free_agency_actions.SELECT_RESTRICTED_FREE_AGENCY_YEAR:
      // Clear the previous season's auctions rather than leaving them on screen
      // under the new year's heading while the request is in flight.
      return state.merge({
        year: payload.year,
        auctions: new List(),
        is_pending: true
      })

    case restricted_free_agency_actions.GET_RESTRICTED_FREE_AGENCY_AUCTIONS_PENDING:
      return state.merge({ is_pending: true })

    case restricted_free_agency_actions.GET_RESTRICTED_FREE_AGENCY_AUCTIONS_FAILED:
      return state.merge({ is_pending: false })

    case restricted_free_agency_actions.GET_RESTRICTED_FREE_AGENCY_AUCTIONS_FULFILLED:
      return state.merge({
        auctions: fromJS(payload.data),
        is_pending: false
      })

    default:
      return state
  }
}
