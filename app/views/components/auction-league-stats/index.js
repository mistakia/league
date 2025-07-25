import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_rosters_for_current_league,
  get_current_league
} from '@core/selectors'
import { Roster } from '@libs-shared'

import AuctionLeagueStats from './auction-league-stats'

const map_state_to_props = createSelector(
  get_rosters_for_current_league,
  get_current_league,
  (roster_records, league) => {
    const rosters = []
    for (const roster of roster_records.valueSeq()) {
      const r = new Roster({ roster: roster.toJS(), league })
      rosters.push(r)
    }

    return {
      remaining_salary_space: rosters.reduce((acc, roster) => {
        return acc + (roster.availableCap > 0 ? roster.availableCap : 0)
      }, 0),
      remaining_active_roster_space: rosters.reduce((acc, roster) => {
        return acc + roster.availableSpace
      }, 0)
    }
  }
)

export default connect(map_state_to_props)(AuctionLeagueStats)
