import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague, rosterActions } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'
import { constants } from '@common'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (rosters, league, teams) => {
    let ps_count_max = 0
    let bench_count_max = 0
    for (const roster of rosters.values()) {
      const ps_count = roster.players.filter(
        (r) => r.slot === constants.slots.PS || r.slot === constants.slots.PSP
      )
      ps_count_max = Math.max(ps_count.size, ps_count_max)

      const bench_count = roster.players.filter(
        (r) => r.slot === constants.slots.BENCH
      )
      bench_count_max = Math.max(bench_count.size, bench_count_max)
    }

    return { rosters, league, teams, ps_count_max, bench_count_max }
  }
)

const mapDispatchToProps = {
  exportRosters: rosterActions.exportRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(RostersPage)
