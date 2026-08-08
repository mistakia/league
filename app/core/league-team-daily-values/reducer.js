import { Map, List } from 'immutable'
import { league_team_daily_values_actions } from './actions'

export function league_team_daily_values_reducer(
  state = new Map(),
  { payload, type }
) {
  switch (type) {
    case league_team_daily_values_actions.GET_LEAGUE_TEAM_DAILY_VALUES_FULFILLED: {
      return state.withMutations((state) => {
        // clear out old values
        state.clear()

        payload.data.forEach((i) => {
          // if team doesn't exist, create it
          if (!state.has(i.tid)) {
            state.set(i.tid, new List())
          }

          state.updateIn([i.tid], (list) =>
            list.push({
              ktc_value: i.ktc_value,
              ktc_share: i.ktc_share,
              // league_team_daily_values.observed_at is timestamptz and arrives
              // as an ISO string. Every consumer of this field -- both charts'
              // x-axis and the delta cutoffs in selectors -- works in epoch
              // MILLISECONDS, which is what this column held before the retype,
              // so the conversion lands once here at the read boundary.
              timestamp: new Date(i.observed_at).getTime()
            })
          )
        })
      })
    }

    default:
      return state
  }
}
