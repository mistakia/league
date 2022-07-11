import { Map } from 'immutable'

import { standingsActions } from './actions'
import { constants } from '@common'

const initialState = new Map({
  year: constants.season.year
})

export function standingsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case standingsActions.STANDINGS_SELECT_YEAR:
      return state.merge({
        year: payload.year
      })

    default:
      return state
  }
}
