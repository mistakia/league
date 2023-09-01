import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague, getCurrentLeague } from '@core/selectors'
import { Roster } from '@libs-shared'

import AuctionLeagueStats from './auction-league-stats'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  (roster_records, league) => {
    const rosters = []
    for (const roster of roster_records.valueSeq()) {
      const r = new Roster({ roster: roster.toJS(), league })
      rosters.push(r)
    }

    return {
      remaining_salary_space: rosters.reduce((acc, roster) => {
        return acc + roster.availableCap
      }, 0),
      remaining_active_roster_space: rosters.reduce((acc, roster) => {
        return acc + roster.availableSpace
      }, 0)
    }
  }
)

export default connect(mapStateToProps)(AuctionLeagueStats)
